/**
 * Database layer for SQLite MCP Server
 * Provides connection pooling, query execution, and schema management
 */

import Database from 'better-sqlite3';
import { 
  DatabaseConfig, 
  QueryResult, 
  SchemaInfo, 
  TableInfo, 
  ColumnInfo, 
  ConnectionPoolStats,
  BulkOperationResult,
  BulkOperationProgress,
  BulkOperationError,
  BulkInsertData,
  BulkUpdateData,
  BulkDeleteData,
  RelationalDataMap
} from '../types';
import { Logger } from 'winston';
import * as path from 'path';
import * as fs from 'fs';
import { safeIdentifier, isValidIdentifier } from '../utils';
import { PACKAGE_VERSION, SERVER_FEATURES } from '../version';

export class DatabaseManager {
  private static instances: Map<string, DatabaseManager> = new Map();
  private db: Database.Database | null = null;
  private config: DatabaseConfig;
  private logger: Logger;
  private connectionPool: Database.Database[] = [];
  private activeConnections = 0;
  private maxConnections: number;
  private readonly readablePragmas = new Set([
    'application_id',
    'auto_vacuum',
    'busy_timeout',
    'cache_size',
    'cache_spill',
    'case_sensitive_like',
    'cell_size_check',
    'compile_options',
    'database_list',
    'defer_foreign_keys',
    'encoding',
    'foreign_keys',
    'freelist_count',
    'function_list',
    'ignore_check_constraints',
    'incremental_vacuum',
    'index_list',
    'integrity_check',
    'journal_mode',
    'journal_size_limit',
    'locking_mode',
    'mmap_size',
    'module_list',
    'optimize',
    'page_count',
    'page_size',
    'pragma_list',
    'quick_check',
    'read_uncommitted',
    'recursive_triggers',
    'reverse_unordered_selects',
    'secure_delete',
    'synchronous',
    'table_list',
    'temp_store',
    'threads',
    'trusted_schema',
    'user_version',
    'wal_autocheckpoint',
    'wal_checkpoint'
  ]);
  private readonly writablePragmas = new Set([
    'application_id',
    'auto_vacuum',
    'busy_timeout',
    'cache_size',
    'cache_spill',
    'case_sensitive_like',
    'defer_foreign_keys',
    'foreign_keys',
    'ignore_check_constraints',
    'journal_mode',
    'journal_size_limit',
    'locking_mode',
    'mmap_size',
    'read_uncommitted',
    'recursive_triggers',
    'reverse_unordered_selects',
    'secure_delete',
    'synchronous',
    'temp_store',
    'threads',
    'trusted_schema',
    'user_version',
    'wal_autocheckpoint'
  ]);

  private constructor(config: DatabaseConfig, logger: Logger) {
    this.config = config;
    this.logger = logger;
    this.maxConnections = config.maxConnections || 10;
  }

  /**
   * Get or create a DatabaseManager instance for the given config
   * Uses database path as key to allow multiple database connections
   */
  public static getInstance(config: DatabaseConfig, logger: Logger): DatabaseManager {
    const key = config.path;
    
    if (!DatabaseManager.instances.has(key)) {
      DatabaseManager.instances.set(key, new DatabaseManager(config, logger));
    }
    
    return DatabaseManager.instances.get(key)!;
  }

  /**
   * Remove instance from cache (useful for testing or reconnecting)
   */
  public static removeInstance(dbPath: string): void {
    const instance = DatabaseManager.instances.get(dbPath);
    if (instance) {
      instance.close();
      DatabaseManager.instances.delete(dbPath);
    }
  }

  /**
   * Clear all instances
   */
  public static clearAllInstances(): void {
    for (const [path, instance] of DatabaseManager.instances) {
      instance.close();
    }
    DatabaseManager.instances.clear();
  }

  /**
   * Initialize database connection
   */
  public async initialize(): Promise<void> {
    try {
      this.logger.info('Initializing database connection', { path: this.config.path });

      // Check if database file exists before connection
      const isNewDatabase = this.config.path !== ':memory:' && !fs.existsSync(this.config.path);
      
      if (isNewDatabase) {
        this.logger.info('Creating new SQLite database file', { path: this.config.path });
      }

      // Create main database connection (SQLite will auto-create the file)
      this.db = this.createConnection();
      
      if (isNewDatabase) {
        this.logger.info('New SQLite database file created successfully', { path: this.config.path });
      }
      
      // Initialize connection pool
      await this.initializeConnectionPool();

      // Set up database configuration
      this.setupDatabase();

      // Create audit tables if they don't exist
      this.createAuditTables();

      this.logger.info('Database initialized successfully', { 
        path: this.config.path,
        isNewDatabase,
        readOnly: this.config.readOnly 
      });
    } catch (error) {
      this.logger.error('Failed to initialize database', { error });
      throw error;
    }
  }

  /**
   * Create a new database connection
   */
  private createConnection(): Database.Database {
    const options: Database.Options = {
      timeout: this.config.timeout || 30000,
      verbose: (message) => this.logger.debug('SQLite:', message)
    };

    if (this.config.readOnly) {
      options.readonly = true;
    }

    const db = new Database(this.config.path, options);

    // Configure database settings
    if (this.config.enableWAL && !this.config.readOnly) {
      db.pragma('journal_mode = WAL');
    }

    if (this.config.busyTimeout) {
      db.pragma(`busy_timeout = ${this.config.busyTimeout}`);
    }

    // Enable foreign keys
    db.pragma('foreign_keys = ON');

    // Set synchronous mode for better performance
    db.pragma('synchronous = NORMAL');

    return db;
  }

  /**
   * Initialize connection pool
   */
  private async initializeConnectionPool(): Promise<void> {
    for (let i = 0; i < Math.min(3, this.maxConnections); i++) {
      try {
        const connection = this.createConnection();
        this.connectionPool.push(connection);
      } catch (error) {
        this.logger.warn('Failed to create pooled connection', { error, index: i });
      }
    }
  }

  /**
   * Get a connection from the pool
   */
  private getConnection(): Database.Database {
    if (this.connectionPool.length > 0) {
      const connection = this.connectionPool.pop()!;
      this.activeConnections++;
      return connection;
    }

    if (this.activeConnections < this.maxConnections) {
      this.activeConnections++;
      return this.createConnection();
    }

    // If no connections available, use main connection
    return this.db!;
  }

  /**
   * Return connection to pool
   */
  private returnConnection(connection: Database.Database): void {
    if (connection !== this.db && this.connectionPool.length < 3) {
      this.connectionPool.push(connection);
      this.activeConnections--;
    } else if (connection !== this.db) {
      try {
        connection.close();
        this.activeConnections--;
      } catch (error) {
        this.logger.warn('Error closing connection', { error });
      }
    }
  }

  /**
   * Set up database configuration
   */
  private setupDatabase(): void {
    if (!this.db) return;

    try {
      // Create configuration table if it doesn't exist
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS mcp_config (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Insert or update server info
      const serverInfo = {
        version: PACKAGE_VERSION,
        initialized_at: new Date().toISOString(),
        features: JSON.stringify(SERVER_FEATURES)
      };

      const stmt = this.db.prepare(`
        INSERT OR REPLACE INTO mcp_config (key, value, updated_at) 
        VALUES (?, ?, CURRENT_TIMESTAMP)
      `);

      for (const [key, value] of Object.entries(serverInfo)) {
        stmt.run(key, value);
      }

    } catch (error) {
      this.logger.error('Failed to setup database configuration', { error });
    }
  }

  /**
   * Create audit tables
   */
  private createAuditTables(): void {
    if (!this.db) return;

    try {
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS audit_log (
          log_id TEXT PRIMARY KEY,
          client_id TEXT NOT NULL,
          operation_type TEXT NOT NULL,
          query_hash TEXT,
          result_status TEXT NOT NULL,
          executed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          execution_time_ms INTEGER,
          error_message TEXT
        );

        CREATE INDEX IF NOT EXISTS idx_audit_log_client_id ON audit_log(client_id);
        CREATE INDEX IF NOT EXISTS idx_audit_log_executed_at ON audit_log(executed_at DESC);
        CREATE INDEX IF NOT EXISTS idx_audit_log_status ON audit_log(result_status);
      `);
    } catch (error) {
      this.logger.error('Failed to create audit tables', { error });
    }
  }

  /**
   * Execute a query safely with parameters
   */
  public executeQuery(
    query: string, 
    parameters: any[] = [], 
    clientId: string = 'unknown'
  ): QueryResult {
    const startTime = Date.now();
    const connection = this.getConnection();

    try {
      this.logger.debug('Executing query', { 
        clientId, 
        queryLength: query.length,
        paramCount: parameters.length 
      });

      const stmt = connection.prepare(query);
      const normalizedQuery = query.trim().toUpperCase();
      const isInsert = normalizedQuery.startsWith('INSERT');

      let result: QueryResult;

      if (stmt.reader) {
        const data = stmt.all(...parameters);

        result = {
          success: true,
          data,
          rowsAffected: data.length,
          executionTime: Date.now() - startTime
        };
      } else {
        const info = stmt.run(...parameters);

        result = {
          success: true,
          rowsAffected: info.changes,
          lastInsertRowid: isInsert ? Number(info.lastInsertRowid) : undefined,
          executionTime: Date.now() - startTime
        };
      }

      this.logger.debug('Query executed successfully', { 
        clientId, 
        executionTime: result.executionTime,
        rowsAffected: result.rowsAffected 
      });

      return result;

    } catch (error) {
      const executionTime = Date.now() - startTime;
      const errorMessage = (error as Error).message;
      this.logger.error('Query execution failed', { 
        clientId, 
        error: errorMessage, 
        executionTime 
      });

      return {
        success: false,
        error: errorMessage,
        executionTime
      };
    } finally {
      this.returnConnection(connection);
    }
  }

  /**
   * Execute multiple queries in a transaction
   */
  public executeTransaction(
    queries: Array<{ query: string; parameters?: any[] }>,
    clientId: string = 'unknown'
  ): QueryResult {
    const startTime = Date.now();
    const connection = this.getConnection();

    try {
      this.logger.debug('Starting transaction', { clientId, queryCount: queries.length });

      const transaction = connection.transaction((queries: Array<{ query: string; parameters?: any[] }>) => {
        const results = [];
        for (const { query, parameters = [] } of queries) {
          const stmt = connection.prepare(query);
          const result = stmt.run(...parameters);
          results.push(result);
        }
        return results;
      });

      const results = transaction(queries);
      const executionTime = Date.now() - startTime;

      this.logger.debug('Transaction completed successfully', { 
        clientId, 
        executionTime,
        queryCount: queries.length 
      });

      return {
        success: true,
        data: results,
        executionTime
      };

    } catch (error) {
      const executionTime = Date.now() - startTime;
      const errorMessage = (error as Error).message;
      this.logger.error('Transaction failed', { 
        clientId, 
        error: errorMessage, 
        executionTime 
      });

      return {
        success: false,
        error: errorMessage,
        executionTime
      };
    } finally {
      this.returnConnection(connection);
    }
  }

  /**
   * Get database schema information
   */
  public getSchemaInfo(): SchemaInfo {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    try {
      const tables = this.getTables();
      const views = this.getViews();
      const indexes = this.getIndexes();
      const triggers = this.getTriggers();

      return {
        tables,
        views,
        indexes,
        triggers
      };
    } catch (error) {
      this.logger.error('Failed to get schema info', { error });
      throw error;
    }
  }

  /**
   * Get table information
   */
  private getTables(): TableInfo[] {
    const tablesQuery = `
      SELECT name, type 
      FROM sqlite_master 
      WHERE type IN ('table', 'view') 
      AND name NOT LIKE 'sqlite_%'
      ORDER BY name
    `;

    const tables = this.db!.prepare(tablesQuery).all() as Array<{ name: string; type: string }>;

    return tables.map(table => {
      const columns = this.getTableColumns(table.name);
      const primaryKey = this.getPrimaryKey(table.name);
      const foreignKeys = this.getForeignKeys(table.name);
      const indexes = this.getTableIndexes(table.name);

      return {
        name: table.name,
        type: table.type as 'table' | 'view',
        columns,
        primaryKey,
        foreignKeys,
        indexes
      };
    });
  }

  /**
   * Get column information for a table
   */
  private getTableColumns(tableName: string): ColumnInfo[] {
    // Validate table name to prevent SQL injection in PRAGMA
    if (!isValidIdentifier(tableName)) {
      throw new Error(`Invalid table name: ${tableName}`);
    }
    const columnsQuery = `PRAGMA table_info("${tableName}")`;
    const columns = this.db!.prepare(columnsQuery).all() as Array<{
      cid: number;
      name: string;
      type: string;
      notnull: number;
      dflt_value: any;
      pk: number;
    }>;

    return columns.map(col => ({
      name: col.name,
      type: col.type,
      nullable: col.notnull === 0,
      defaultValue: col.dflt_value,
      primaryKey: col.pk > 0,
      autoIncrement: col.pk > 0 && col.type.toUpperCase().includes('INTEGER')
    }));
  }

  /**
   * Get primary key columns for a table
   */
  private getPrimaryKey(tableName: string): string[] {
    // Validate table name to prevent SQL injection in PRAGMA
    if (!isValidIdentifier(tableName)) {
      throw new Error(`Invalid table name: ${tableName}`);
    }
    const columnsQuery = `PRAGMA table_info("${tableName}")`;
    const columns = this.db!.prepare(columnsQuery).all() as Array<{
      name: string;
      pk: number;
    }>;

    return columns
      .filter(col => col.pk > 0)
      .sort((a, b) => a.pk - b.pk)
      .map(col => col.name);
  }

  /**
   * Get foreign key information for a table
   */
  private getForeignKeys(tableName: string): any[] {
    // Validate table name to prevent SQL injection in PRAGMA
    if (!isValidIdentifier(tableName)) {
      throw new Error(`Invalid table name: ${tableName}`);
    }
    const fkQuery = `PRAGMA foreign_key_list("${tableName}")`;
    return this.db!.prepare(fkQuery).all();
  }

  /**
   * Get indexes for a table
   */
  private getTableIndexes(tableName: string): string[] {
    // Validate table name to prevent SQL injection in PRAGMA
    if (!isValidIdentifier(tableName)) {
      throw new Error(`Invalid table name: ${tableName}`);
    }
    const indexQuery = `PRAGMA index_list("${tableName}")`;
    const indexes = this.db!.prepare(indexQuery).all() as Array<{ name: string }>;
    return indexes.map(idx => idx.name);
  }

  /**
   * Get views information
   */
  private getViews(): any[] {
    const viewsQuery = `
      SELECT name, sql as definition
      FROM sqlite_master 
      WHERE type = 'view'
      ORDER BY name
    `;
    return this.db!.prepare(viewsQuery).all();
  }

  /**
   * Get indexes information
   */
  private getIndexes(): any[] {
    const indexesQuery = `
      SELECT name, tbl_name as tableName, sql
      FROM sqlite_master 
      WHERE type = 'index'
      AND name NOT LIKE 'sqlite_%'
      ORDER BY name
    `;
    return this.db!.prepare(indexesQuery).all();
  }

  /**
   * Get triggers information
   */
  private getTriggers(): any[] {
    const triggersQuery = `
      SELECT name, tbl_name as tableName, sql as definition
      FROM sqlite_master 
      WHERE type = 'trigger'
      ORDER BY name
    `;
    return this.db!.prepare(triggersQuery).all();
  }

  /**
   * Get connection pool statistics
   */
  public getConnectionPoolStats(): ConnectionPoolStats {
    return {
      totalConnections: this.connectionPool.length + this.activeConnections + 1, // +1 for main connection
      activeConnections: this.activeConnections,
      idleConnections: this.connectionPool.length,
      waitingRequests: 0 // Simple implementation doesn't track waiting requests
    };
  }

  /**
   * Backup database to file
   */
  public async backupDatabase(backupPath: string): Promise<void> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    try {
      // Use better-sqlite3's backup API correctly
      await this.db.backup(backupPath);
      
      this.logger.info('Database backup completed', { backupPath });
    } catch (error) {
      this.logger.error('Database backup failed', { error: (error as Error).message, backupPath });
      throw error;
    }
  }

  /**
   * Bulk insert operation with relational data support
   */
  public async bulkInsert(data: BulkInsertData): Promise<BulkOperationResult> {
    const startTime = new Date();
    const batchSize = data.options?.batchSize || 1000;
    const continueOnError = data.options?.continueOnError || false;
    const insertRelatedData = data.options?.insertRelatedData || false;
    
    const progress: BulkOperationProgress = {
      totalRecords: data.records.length,
      processedRecords: 0,
      successfulRecords: 0,
      failedRecords: 0,
      currentBatch: 0,
      totalBatches: Math.ceil(data.records.length / batchSize),
      startTime,
      errors: []
    };

    const affectedTables = new Set<string>([data.mainTable]);
    const connection = this.getConnection();

    try {
      // Begin transaction
      const transaction = connection.transaction(() => {
        // First, handle related data if specified
        const relatedDataMappings = new Map<string, Map<any, any>>();
        
        if (insertRelatedData && data.relatedData) {
          for (const [tableName, tableData] of Object.entries(data.relatedData)) {
            affectedTables.add(tableName);
            const valueMapping = new Map<any, any>();
            relatedDataMappings.set(tableName, valueMapping);
            
            // Insert related records and track ID mappings
            for (const relatedRecord of tableData.records) {
              try {
                const safeTableName = safeIdentifier(tableName, 'table name');
                const columns = Object.keys(relatedRecord);
                const safeColumns = columns.map(col => safeIdentifier(col, 'column name'));
                const placeholders = columns.map(() => '?').join(', ');
                const insertSql = `INSERT INTO ${safeTableName} (${safeColumns.join(', ')}) VALUES (${placeholders})`;
                const stmt = connection.prepare(insertSql);
                const result = stmt.run(...Object.values(relatedRecord));
                
                // Map original value to new ID for foreign key references
                for (const [localColumn, mapping] of Object.entries(tableData.foreignKeyMappings)) {
                  if (relatedRecord[mapping.referencedColumn] !== undefined) {
                    valueMapping.set(relatedRecord[mapping.referencedColumn], result.lastInsertRowid);
                  }
                }
              } catch (error) {
                if (!continueOnError) throw error;
                progress.errors.push({
                  recordIndex: -1,
                  record: relatedRecord,
                  error: (error as Error).message,
                  timestamp: new Date()
                });
              }
            }
          }
        }

        // Process main table data in batches
        for (let i = 0; i < data.records.length; i += batchSize) {
          const batch = data.records.slice(i, i + batchSize);
          progress.currentBatch++;
          
          for (let j = 0; j < batch.length; j++) {
            const record = { ...batch[j] };
            const recordIndex = i + j;
            
            try {
              // Replace foreign key values with mapped IDs if needed
              if (insertRelatedData && data.relatedData) {
                for (const [tableName, tableData] of Object.entries(data.relatedData)) {
                  const mapping = relatedDataMappings.get(tableName);
                  if (mapping) {
                    for (const [localColumn, fkMapping] of Object.entries(tableData.foreignKeyMappings)) {
                      if (record[localColumn] !== undefined && mapping.has(record[localColumn])) {
                        record[localColumn] = mapping.get(record[localColumn]);
                      }
                    }
                  }
                }
              }
              
              const safeMainTable = safeIdentifier(data.mainTable, 'table name');
              const columns = Object.keys(record);
              const safeColumns = columns.map(col => safeIdentifier(col, 'column name'));
              const placeholders = columns.map(() => '?').join(', ');
              const insertSql = `INSERT INTO ${safeMainTable} (${safeColumns.join(', ')}) VALUES (${placeholders})`;
              const stmt = connection.prepare(insertSql);
              stmt.run(...Object.values(record));
              
              progress.successfulRecords++;
            } catch (error) {
              progress.failedRecords++;
              progress.errors.push({
                recordIndex,
                record: batch[j],
                error: (error as Error).message,
                timestamp: new Date()
              });
              
              if (!continueOnError) {
                throw error;
              }
            }
            
            progress.processedRecords++;
            
            // Call progress callback if provided
            if (data.options?.progressCallback) {
              const elapsed = Date.now() - startTime.getTime();
              const recordsPerMs = progress.processedRecords / elapsed;
              const remainingRecords = progress.totalRecords - progress.processedRecords;
              progress.estimatedTimeRemaining = remainingRecords / recordsPerMs;
              
              data.options.progressCallback(progress);
            }
          }
        }
      });

      transaction();

      const executionTime = Date.now() - startTime.getTime();
      
      return {
        success: progress.failedRecords === 0 || continueOnError,
        progress,
        executionTime,
        summary: {
          totalRecords: progress.totalRecords,
          successfulRecords: progress.successfulRecords,
          failedRecords: progress.failedRecords,
          affectedTables: Array.from(affectedTables)
        }
      };

    } catch (error) {
      this.logger.error('Bulk insert failed', { error: (error as Error).message });
      throw error;
    } finally {
      this.returnConnection(connection);
    }
  }

  /**
   * Bulk update operation with progress tracking
   */
  public async bulkUpdate(data: BulkUpdateData): Promise<BulkOperationResult> {
    const startTime = new Date();
    const batchSize = data.options?.batchSize || 1000;
    const continueOnError = data.options?.continueOnError || false;
    
    const progress: BulkOperationProgress = {
      totalRecords: data.updates.length,
      processedRecords: 0,
      successfulRecords: 0,
      failedRecords: 0,
      currentBatch: 0,
      totalBatches: Math.ceil(data.updates.length / batchSize),
      startTime,
      errors: []
    };

    const connection = this.getConnection();

    try {
      const transaction = connection.transaction(() => {
        for (let i = 0; i < data.updates.length; i += batchSize) {
          const batch = data.updates.slice(i, i + batchSize);
          progress.currentBatch++;
          
          for (let j = 0; j < batch.length; j++) {
            const update = batch[j];
            const recordIndex = i + j;
            
            try {
              const safeTable = safeIdentifier(data.table, 'table name');
              const setClause = Object.keys(update.data)
                .map(key => `${safeIdentifier(key, 'column name')} = ?`)
                .join(', ');
              
              const whereClause = Object.keys(update.where)
                .map(key => `${safeIdentifier(key, 'column name')} = ?`)
                .join(' AND ');
              
              const updateSql = `UPDATE ${safeTable} SET ${setClause} WHERE ${whereClause}`;
              const stmt = connection.prepare(updateSql);
              const result = stmt.run(...Object.values(update.data), ...Object.values(update.where));
              
              if (result.changes > 0) {
                progress.successfulRecords++;
              } else {
                progress.failedRecords++;
                progress.errors.push({
                  recordIndex,
                  record: update,
                  error: 'No rows affected - record may not exist',
                  timestamp: new Date()
                });
              }
            } catch (error) {
              progress.failedRecords++;
              progress.errors.push({
                recordIndex,
                record: update,
                error: (error as Error).message,
                timestamp: new Date()
              });
              
              if (!continueOnError) {
                throw error;
              }
            }
            
            progress.processedRecords++;
            
            if (data.options?.progressCallback) {
              const elapsed = Date.now() - startTime.getTime();
              const recordsPerMs = progress.processedRecords / elapsed;
              const remainingRecords = progress.totalRecords - progress.processedRecords;
              progress.estimatedTimeRemaining = remainingRecords / recordsPerMs;
              
              data.options.progressCallback(progress);
            }
          }
        }
      });

      transaction();

      const executionTime = Date.now() - startTime.getTime();
      
      return {
        success: progress.failedRecords === 0 || continueOnError,
        progress,
        executionTime,
        summary: {
          totalRecords: progress.totalRecords,
          successfulRecords: progress.successfulRecords,
          failedRecords: progress.failedRecords,
          affectedTables: [data.table]
        }
      };

    } catch (error) {
      this.logger.error('Bulk update failed', { error: (error as Error).message });
      throw error;
    } finally {
      this.returnConnection(connection);
    }
  }

  /**
   * Bulk delete operation with cascading support
   */
  public async bulkDelete(data: BulkDeleteData): Promise<BulkOperationResult> {
    const startTime = new Date();
    const batchSize = data.options?.batchSize || 1000;
    const continueOnError = data.options?.continueOnError || false;
    const cascadeDelete = data.options?.cascadeDelete || false;
    
    const progress: BulkOperationProgress = {
      totalRecords: data.conditions.length,
      processedRecords: 0,
      successfulRecords: 0,
      failedRecords: 0,
      currentBatch: 0,
      totalBatches: Math.ceil(data.conditions.length / batchSize),
      startTime,
      errors: []
    };

    const affectedTables = new Set<string>([data.table]);
    const connection = this.getConnection();

    try {
      // Get foreign key relationships if cascade delete is enabled
      let foreignKeyTables: string[] = [];
      if (cascadeDelete) {
        const fkQuery = `
          SELECT DISTINCT m.name as table_name
          FROM sqlite_master m
          JOIN pragma_foreign_key_list(m.name) fk ON fk.table = ?
          WHERE m.type = 'table'
        `;
        const fkResult = connection.prepare(fkQuery).all(data.table);
        foreignKeyTables = fkResult.map((row: any) => row.table_name);
        foreignKeyTables.forEach(table => affectedTables.add(table));
      }

      const transaction = connection.transaction(() => {
        for (let i = 0; i < data.conditions.length; i += batchSize) {
          const batch = data.conditions.slice(i, i + batchSize);
          progress.currentBatch++;
          
          for (let j = 0; j < batch.length; j++) {
            const condition = batch[j];
            const recordIndex = i + j;
            
            try {
              // Handle cascade delete first
              if (cascadeDelete && foreignKeyTables.length > 0) {
                for (const fkTable of foreignKeyTables) {
                  const safeFkTable = safeIdentifier(fkTable, 'table name');
                  const whereClause = Object.keys(condition)
                    .map(key => `${safeIdentifier(key, 'column name')} = ?`)
                    .join(' AND ');
                  
                  const cascadeDeleteSql = `DELETE FROM ${safeFkTable} WHERE ${whereClause}`;
                  const cascadeStmt = connection.prepare(cascadeDeleteSql);
                  cascadeStmt.run(...Object.values(condition));
                }
              }
              
              // Delete from main table
              const safeTable = safeIdentifier(data.table, 'table name');
              const whereClause = Object.keys(condition)
                .map(key => `${safeIdentifier(key, 'column name')} = ?`)
                .join(' AND ');
              
              const deleteSql = `DELETE FROM ${safeTable} WHERE ${whereClause}`;
              const stmt = connection.prepare(deleteSql);
              const result = stmt.run(...Object.values(condition));
              
              if (result.changes > 0) {
                progress.successfulRecords++;
              } else {
                progress.failedRecords++;
                progress.errors.push({
                  recordIndex,
                  record: condition,
                  error: 'No rows affected - record may not exist',
                  timestamp: new Date()
                });
              }
            } catch (error) {
              progress.failedRecords++;
              progress.errors.push({
                recordIndex,
                record: condition,
                error: (error as Error).message,
                timestamp: new Date()
              });
              
              if (!continueOnError) {
                throw error;
              }
            }
            
            progress.processedRecords++;
            
            if (data.options?.progressCallback) {
              const elapsed = Date.now() - startTime.getTime();
              const recordsPerMs = progress.processedRecords / elapsed;
              const remainingRecords = progress.totalRecords - progress.processedRecords;
              progress.estimatedTimeRemaining = remainingRecords / recordsPerMs;
              
              data.options.progressCallback(progress);
            }
          }
        }
      });

      transaction();

      const executionTime = Date.now() - startTime.getTime();
      
      return {
        success: progress.failedRecords === 0 || continueOnError,
        progress,
        executionTime,
        summary: {
          totalRecords: progress.totalRecords,
          successfulRecords: progress.successfulRecords,
          failedRecords: progress.failedRecords,
          affectedTables: Array.from(affectedTables)
        }
      };

    } catch (error) {
      this.logger.error('Bulk delete failed', { error: (error as Error).message });
      throw error;
    } finally {
      this.returnConnection(connection);
    }
  }

  /**
   * Analyze table relationships
   */
  public analyzeTableRelations(tableName: string, depth: number = 1, analysisType: 'incoming' | 'outgoing' | 'both' = 'both'): any {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    // Validate table name
    if (!isValidIdentifier(tableName)) {
      throw new Error(`Invalid table name: ${tableName}`);
    }

    try {
      const outgoing = (analysisType === 'outgoing' || analysisType === 'both') 
        ? this.getOutgoingRelations(tableName)
        : [];

      const incoming = (analysisType === 'incoming' || analysisType === 'both')
        ? this.getIncomingRelations(tableName)
        : [];

      const relatedTables = new Set<string>();
      outgoing.forEach(rel => relatedTables.add(rel.referenced_table));
      incoming.forEach(rel => relatedTables.add(rel.source_table));

      // Build relationship tree if depth > 1
      let relationshipTree: any = {};
      if (depth > 1) {
        relationshipTree = this.buildRelationshipTree(tableName, depth - 1, new Set([tableName]), analysisType);
      }

      return {
        success: true,
        table: tableName,
        outgoing: outgoing.map(rel => ({
          local_column: rel.from,
          referenced_table: rel.table,
          referenced_column: rel.to,
          cascade_delete: rel.on_delete === 'CASCADE',
          cascade_update: rel.on_update === 'CASCADE',
          on_delete: rel.on_delete,
          on_update: rel.on_update
        })),
        incoming: incoming,
        relatedTables: Array.from(relatedTables),
        stats: {
          totalOutgoing: outgoing.length,
          totalIncoming: incoming.length,
          totalRelatedTables: relatedTables.size
        },
        relationshipTree: depth > 1 ? relationshipTree : undefined
      };
    } catch (error) {
      this.logger.error('Failed to analyze table relations', { table: tableName, error });
      throw error;
    }
  }

  /**
   * Get outgoing relations (foreign keys this table references)
   */
  private getOutgoingRelations(tableName: string): any[] {
    const fkQuery = `PRAGMA foreign_key_list("${tableName}")`;
    return this.db!.prepare(fkQuery).all();
  }

  /**
   * Get incoming relations (tables that reference this table)
   */
  private getIncomingRelations(tableName: string): any[] {
    const incomingQuery = `
      SELECT 
        m.name as source_table,
        fk."from" as source_column,
        fk."to" as local_column,
        fk.table as referenced_table,
        fk.on_delete,
        fk.on_update
      FROM sqlite_master m
      JOIN pragma_foreign_key_list(m.name) fk ON fk.table = ?
      WHERE m.type = 'table'
      ORDER BY m.name
    `;
    
    try {
      return this.db!.prepare(incomingQuery).all(tableName) as any[];
    } catch (error) {
      this.logger.debug('Could not retrieve incoming relations with pragma_foreign_key_list', { error });
      // Fallback: manually query all tables
      return this.getIncomingRelationsFallback(tableName);
    }
  }

  /**
   * Fallback method to get incoming relations if pragma_foreign_key_list is not available
   */
  private getIncomingRelationsFallback(tableName: string): any[] {
    const tablesQuery = `
      SELECT name FROM sqlite_master 
      WHERE type = 'table' 
      AND name NOT LIKE 'sqlite_%'
      ORDER BY name
    `;
    
    const tables = this.db!.prepare(tablesQuery).all() as Array<{ name: string }>;
    const incoming: any[] = [];

    for (const table of tables) {
      const fkQuery = `PRAGMA foreign_key_list("${table.name}")`;
      const foreignKeys = this.db!.prepare(fkQuery).all() as any[];
      
      for (const fk of foreignKeys) {
        if (fk.table === tableName) {
          incoming.push({
            source_table: table.name,
            source_column: fk.from,
            local_column: fk.to,
            referenced_table: fk.table,
            on_delete: fk.on_delete,
            on_update: fk.on_update
          });
        }
      }
    }

    return incoming;
  }

  /**
   * Build relationship tree for deep analysis
   */
  private buildRelationshipTree(
    tableName: string,
    depth: number,
    visited: Set<string>,
    analysisType: 'incoming' | 'outgoing' | 'both'
  ): any {
    if (depth <= 0 || visited.has(tableName)) {
      return {};
    }

    visited.add(tableName);
    const tree: any = {};

    try {
      const outgoing = this.getOutgoingRelations(tableName);
      const incoming = this.getIncomingRelations(tableName);

      if (analysisType === 'outgoing' || analysisType === 'both') {
        tree.outgoing = outgoing.map(rel => ({
          table: rel.table,
          relations: this.buildRelationshipTree(rel.table, depth - 1, visited, analysisType)
        }));
      }

      if (analysisType === 'incoming' || analysisType === 'both') {
        tree.incoming = incoming.map(rel => ({
          table: rel.source_table,
          relations: this.buildRelationshipTree(rel.source_table, depth - 1, visited, analysisType)
        }));
      }
    } catch (error) {
      this.logger.debug('Error building relationship tree', { table: tableName, error });
    }

    return tree;
  }

  /**
   * Create a view
   */
  public createView(viewName: string, selectQuery: string, ifNotExists: boolean = false): any {
    if (!this.db) throw new Error('Database not initialized');
    
    const safeViewName = safeIdentifier(viewName, 'view name');
    const query = `CREATE VIEW ${ifNotExists ? 'IF NOT EXISTS ' : ''}${safeViewName} AS ${selectQuery}`;
    
    try {
      this.db.exec(query);
      return {
        success: true,
        message: `View ${viewName} created successfully`,
        executionTime: 0
      };
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
        executionTime: 0
      };
    }
  }

  /**
   * Drop a view
   */
  public dropView(viewName: string, ifExists: boolean = false): any {
    if (!this.db) throw new Error('Database not initialized');
    
    const safeViewName = safeIdentifier(viewName, 'view name');
    const query = `DROP VIEW ${ifExists ? 'IF EXISTS ' : ''}${safeViewName}`;
    
    try {
      this.db.exec(query);
      return {
        success: true,
        message: `View ${viewName} dropped successfully`,
        executionTime: 0
      };
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
        executionTime: 0
      };
    }
  }

  /**
   * Get view information
   */
  public getViewInfo(viewName: string): any {
    if (!this.db) throw new Error('Database not initialized');
    
    if (!isValidIdentifier(viewName)) {
      throw new Error(`Invalid view name: ${viewName}`);
    }

    const viewQuery = `
      SELECT name, sql as definition, type
      FROM sqlite_master 
      WHERE type = 'view' 
      AND name = ?
    `;
    
    const view = this.db.prepare(viewQuery).get(viewName);
    
    if (!view) {
      throw new Error(`View ${viewName} not found`);
    }

    return view;
  }

  /**
   * List all views
   */
  public listViews(): any[] {
    if (!this.db) throw new Error('Database not initialized');
    
    const query = `
      SELECT name, sql as definition, type
      FROM sqlite_master 
      WHERE type = 'view'
      ORDER BY name
    `;
    
    return this.db.prepare(query).all();
  }

  /**
   * Get index information
   */
  public getIndexInfo(indexName: string): any {
    if (!this.db) throw new Error('Database not initialized');
    
    if (!isValidIdentifier(indexName)) {
      throw new Error(`Invalid index name: ${indexName}`);
    }

    const indexQuery = `
      SELECT name, tbl_name as table_name, sql, unique
      FROM sqlite_master 
      WHERE type = 'index' 
      AND name = ?
    `;
    
    const index = this.db.prepare(indexQuery).get(indexName);
    
    if (!index) {
      throw new Error(`Index ${indexName} not found`);
    }

    // Get index columns
    const columnsQuery = `PRAGMA index_info("${indexName}")`;
    const columns = this.db.prepare(columnsQuery).all();

    return {
      ...index,
      columns: columns.map((col: any) => ({
        name: col.name,
        seqno: col.seqno,
        desc: col.desc === 1
      }))
    };
  }

  /**
   * List all indexes
   */
  public listIndexes(): any[] {
    if (!this.db) throw new Error('Database not initialized');
    
    const query = `
      SELECT name, tbl_name as table_name, sql, unique
      FROM sqlite_master 
      WHERE type = 'index'
      AND name NOT LIKE 'sqlite_%'
      ORDER BY name
    `;
    
    return this.db.prepare(query).all();
  }

  /**
   * Analyze index to get statistics
   */
  public analyzeIndex(indexName: string): any {
    if (!this.db) throw new Error('Database not initialized');
    
    try {
      // Run ANALYZE on the index
      this.db.exec(`ANALYZE ${safeIdentifier(indexName, 'index name')}`);
      
      // Get index statistics
      const statsQuery = `
        SELECT 
          sqlite_stat1.name as index_name,
          sqlite_stat1.stat as statistics
        FROM sqlite_stat1
        WHERE name = ?
      `;
      
      const stats = this.db.prepare(statsQuery).get(indexName) as any;
      
      return {
        success: true,
        index: indexName,
        statistics: stats ? stats.statistics : null,
        analyzed_at: new Date().toISOString()
      };
    } catch (error) {
      throw new Error(`Failed to analyze index: ${(error as Error).message}`);
    }
  }

  /**
   * List all constraints
   */
  public listConstraints(tableName?: string): any[] {
    if (!this.db) throw new Error('Database not initialized');
    
    if (tableName && !isValidIdentifier(tableName)) {
      throw new Error(`Invalid table name: ${tableName}`);
    }

    const query = `
      SELECT 
        m.name as table_name,
        CASE 
          WHEN type = 'c' THEN 'CHECK'
          WHEN type = 'u' THEN 'UNIQUE'
          WHEN type = 'f' THEN 'FOREIGN KEY'
          WHEN type = 'pk' THEN 'PRIMARY KEY'
          ELSE type
        END as constraint_type,
        p.cid as constraint_id,
        p.name as column_name
      FROM sqlite_master m
      JOIN pragma_table_info(m.name) p ON 1=1
      WHERE m.type = 'table'
      ${tableName ? `AND m.name = ?` : ''}
      ORDER BY m.name, p.cid
    `;
    
    if (tableName) {
      return this.db.prepare(query).all(tableName);
    } else {
      return this.db.prepare(query).all();
    }
  }

  /**
   * List foreign keys
   */
  public listForeignKeys(tableName?: string): any[] {
    if (!this.db) throw new Error('Database not initialized');
    
    if (tableName && !isValidIdentifier(tableName)) {
      throw new Error(`Invalid table name: ${tableName}`);
    }

    let result: any[] = [];

    if (tableName) {
      // Get foreign keys for specific table
      const fkQuery = `PRAGMA foreign_key_list("${tableName}")`;
      result = this.db.prepare(fkQuery).all();
    } else {
      // Get all foreign keys from all tables
      const tablesQuery = `
        SELECT name FROM sqlite_master 
        WHERE type = 'table' 
        AND name NOT LIKE 'sqlite_%'
      `;
      
      const tables = this.db.prepare(tablesQuery).all() as Array<{ name: string }>;
      
      for (const table of tables) {
        const fkQuery = `PRAGMA foreign_key_list("${table.name}")`;
        const fks = this.db.prepare(fkQuery).all() as any[];
        fks.forEach(fk => {
          result.push({
            ...fk,
            table_name: table.name
          });
        });
      }
    }

    return result.map(fk => ({
      table: fk.table_name || tableName,
      column: fk.from,
      referenced_table: fk.table,
      referenced_column: fk.to,
      seq: fk.seq,
      on_delete: fk.on_delete,
      on_update: fk.on_update
    }));
  }

  /**
   * Clone a table (structure and data)
   */
  public cloneTable(sourceTable: string, targetTable: string, includeData: boolean = true): any {
    if (!this.db) throw new Error('Database not initialized');
    
    if (!isValidIdentifier(sourceTable) || !isValidIdentifier(targetTable)) {
      throw new Error('Invalid table name');
    }

    const connection = this.getConnection();
    
    try {
      const transaction = connection.transaction(() => {
        // Get CREATE TABLE statement
        const createStmt = connection.prepare(`
          SELECT sql FROM sqlite_master 
          WHERE type = 'table' AND name = ?
        `).get(sourceTable) as any;

        if (!createStmt || !createStmt.sql) {
          throw new Error(`Source table ${sourceTable} not found`);
        }

        // Modify CREATE TABLE statement for target
        let createQuery = createStmt.sql.replace(
          new RegExp(`\\b${sourceTable}\\b`, 'i'),
          targetTable
        );

        // Execute CREATE TABLE
        connection.exec(createQuery);

        // Copy data if requested
        if (includeData) {
          const copyQuery = `INSERT INTO ${safeIdentifier(targetTable, 'table name')} SELECT * FROM ${safeIdentifier(sourceTable, 'table name')}`;
          connection.exec(copyQuery);
        }
      });

      transaction();

      return {
        success: true,
        message: `Table ${sourceTable} cloned to ${targetTable}`,
        executionTime: 0
      };
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
        executionTime: 0
      };
    } finally {
      this.returnConnection(connection);
    }
  }

  /**
   * Compare table structures
   */
  public compareTableStructure(table1: string, table2: string): any {
    if (!this.db) throw new Error('Database not initialized');
    
    if (!isValidIdentifier(table1) || !isValidIdentifier(table2)) {
      throw new Error('Invalid table name');
    }

    const getColumns = (tableName: string) => {
      const query = `PRAGMA table_info("${tableName}")`;
      return this.db!.prepare(query).all() as any[];
    };

    const cols1 = getColumns(table1);
    const cols2 = getColumns(table2);

    const differences = {
      only_in_table1: [] as any[],
      only_in_table2: [] as any[],
      different_types: [] as any[],
      same_structure: true
    };

    const cols2ByName = new Map(cols2.map((c: any) => [c.name, c]));

    // Find differences
    for (const col1 of cols1) {
      if (!cols2ByName.has(col1.name)) {
        differences.only_in_table1.push(col1);
        differences.same_structure = false;
      } else {
        const col2 = cols2ByName.get(col1.name);
        if (col1.type !== col2.type) {
          differences.different_types.push({
            column: col1.name,
            type_in_table1: col1.type,
            type_in_table2: col2.type
          });
          differences.same_structure = false;
        }
      }
    }

    for (const col2 of cols2) {
      if (!new Map(cols1.map((c: any) => [c.name, c])).has(col2.name)) {
        differences.only_in_table2.push(col2);
        differences.same_structure = false;
      }
    }

    return differences;
  }

  /**
   * Copy table data
   */
  public copyTableData(sourceTable: string, targetTable: string, whereClause?: string): any {
    if (!this.db) throw new Error('Database not initialized');
    
    if (!isValidIdentifier(sourceTable) || !isValidIdentifier(targetTable)) {
      return {
        success: false,
        error: 'Invalid table name',
        executionTime: 0
      };
    }

    try {
      const baseSql = `INSERT INTO ${safeIdentifier(targetTable, 'table name')} SELECT * FROM ${safeIdentifier(sourceTable, 'table name')}`;
      const query = whereClause ? `${baseSql} WHERE ${whereClause}` : baseSql;
      
      const result = this.db.prepare(query).run();

      return {
        success: true,
        rowsCopied: result.changes,
        executionTime: 0
      };
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
        executionTime: 0
      };
    }
  }

  /**
   * Get CREATE TABLE statement
   */
  public getCreateTableStatement(tableName: string): any {
    if (!this.db) throw new Error('Database not initialized');
    
    if (!isValidIdentifier(tableName)) {
      throw new Error(`Invalid table name: ${tableName}`);
    }

    const query = `
      SELECT sql as create_statement
      FROM sqlite_master 
      WHERE type = 'table' 
      AND name = ?
    `;
    
    const result = this.db.prepare(query).get(tableName);
    
    if (!result) {
      throw new Error(`Table ${tableName} not found`);
    }

    return result;
  }

  /**
   * Restore database from SQL file
   */
  public async restoreFromSQL(sqlPath: string): Promise<any> {
    if (!this.db) throw new Error('Database not initialized');
    
    try {
      if (!fs.existsSync(sqlPath)) {
        return {
          success: false,
          error: `SQL file not found: ${sqlPath}`,
          executionTime: 0
        };
      }

      const sqlContent = fs.readFileSync(sqlPath, 'utf-8');
      const connection = this.getConnection();

      try {
        const transaction = connection.transaction(() => {
          connection.exec(sqlContent);
        });

        transaction();

        return {
          success: true,
          message: 'Database restored successfully',
          executionTime: 0
        };
      } finally {
        this.returnConnection(connection);
      }
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
        executionTime: 0
      };
    }
  }

  /**
   * Backup specific table to SQL file
   */
  public backupTable(tableName: string, backupPath: string): any {
    if (!this.db) throw new Error('Database not initialized');
    
    if (!isValidIdentifier(tableName)) {
      return {
        success: false,
        error: 'Invalid table name',
        executionTime: 0
      };
    }

    try {
      const createStmt = this.getCreateTableStatement(tableName);
      const query = `SELECT * FROM ${safeIdentifier(tableName, 'table name')}`;
      const data = this.db.prepare(query).all() as any[];

      // Build INSERT statements
      let sqlContent = createStmt.create_statement + ';\n\n';
      
      if (data.length > 0) {
        const columns = Object.keys(data[0]);
        for (const row of data) {
          const values = columns.map(col => {
            const val = (row as any)[col];
            if (val === null) return 'NULL';
            if (typeof val === 'string') return `'${val.replace(/'/g, "''")}'`;
            return val;
          });
          sqlContent += `INSERT INTO ${safeIdentifier(tableName, 'table name')} VALUES (${values.join(', ')});\n`;
        }
      }

      fs.writeFileSync(backupPath, sqlContent);

      return {
        success: true,
        message: `Table ${tableName} backed up successfully`,
        rowsBackedUp: data.length,
        executionTime: 0
      };
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
        executionTime: 0
      };
    }
  }

  /**
   * Get column statistics for analysis
   */
  public getColumnStatistics(tableName: string): any {
    if (!this.db) throw new Error('Database not initialized');
    if (!isValidIdentifier(tableName)) throw new Error(`Invalid table name: ${tableName}`);

    try {
      const columns = this.getTableColumns(tableName);
      const stats = [];

      for (const col of columns) {
        const query = `
          SELECT 
            COUNT(*) as total_rows,
            COUNT(DISTINCT "${col.name}") as distinct_count,
            COUNT(*) - COUNT("${col.name}") as null_count
          FROM "${tableName}"
        `;
        
        const result = this.db.prepare(query).get() as any;
        
        let minVal, maxVal, avgVal;
        if (col.type.toUpperCase().includes('INT') || col.type.toUpperCase().includes('REAL')) {
          const numQuery = `
            SELECT MIN("${col.name}") as min_val, MAX("${col.name}") as max_val, 
                   AVG("${col.name}") as avg_val FROM "${tableName}" WHERE "${col.name}" IS NOT NULL
          `;
          const numResult = this.db.prepare(numQuery).get() as any;
          minVal = numResult?.min_val;
          maxVal = numResult?.max_val;
          avgVal = numResult?.avg_val;
        }

        stats.push({
          columnName: col.name,
          columnType: col.type,
          totalRows: result.total_rows,
          distinctCount: result.distinct_count,
          nullCount: result.null_count,
          nullPercentage: (result.null_count / result.total_rows * 100).toFixed(2),
          minValue: minVal,
          maxValue: maxVal,
          averageValue: avgVal ? parseFloat(avgVal.toFixed(4)) : null
        });
      }

      return {
        success: true,
        tableName,
        statistics: stats,
        executionTime: 0
      };
    } catch (error) {
      this.logger.error('Failed to get column statistics', { error });
      throw error;
    }
  }

  /**
   * Get database summary information
   */
  public getDatabaseSummary(): any {
    if (!this.db) throw new Error('Database not initialized');

    try {
      const schema = this.getSchemaInfo();
      
      // Calculate database size
      let dbSize = 0;
      if (this.config.path !== ':memory:' && fs.existsSync(this.config.path)) {
        dbSize = fs.statSync(this.config.path).size;
      }

      // Count total rows across all tables
      let totalRows = 0;
      for (const table of schema.tables) {
        if (table.type === 'table') {
          const countQuery = `SELECT COUNT(*) as count FROM "${table.name}"`;
          const result = this.db.prepare(countQuery).get() as any;
          totalRows += result.count;
        }
      }

      // Get database pragma settings
      const pragmaQuery = this.db.prepare(`PRAGMA database_list`).all() as any[];
      
      return {
        success: true,
        summary: {
          filePath: this.config.path,
          databaseSize: dbSize,
          databaseSizeFormatted: this.formatBytes(dbSize),
          tableCount: schema.tables.filter(t => t.type === 'table').length,
          viewCount: schema.tables.filter(t => t.type === 'view').length,
          totalRows,
          indexCount: schema.indexes.length,
          triggerCount: schema.triggers.length,
          readOnly: this.config.readOnly,
          walEnabled: this.db.pragma('journal_mode') === 'wal'
        },
        executionTime: 0
      };
    } catch (error) {
      this.logger.error('Failed to get database summary', { error });
      throw error;
    }
  }

  /**
   * Get schema as ERD (Entity Relationship Diagram) data
   */
  public getSchemaERD(): any {
    if (!this.db) throw new Error('Database not initialized');

    try {
      const schema = this.getSchemaInfo();
      const entities = [];
      const relationships = [];

      for (const table of schema.tables) {
        if (table.type === 'view') continue;

        entities.push({
          name: table.name,
          columns: table.columns.map(col => ({
            name: col.name,
            type: col.type,
            nullable: col.nullable,
            isPrimary: col.primaryKey
          })),
          primaryKey: table.primaryKey
        });

        // Add relationships from foreign keys
        if (table.foreignKeys) {
          for (const fk of table.foreignKeys) {
            relationships.push({
              source: table.name,
              sourceColumn: fk.columnName,
              target: fk.referencedTable,
              targetColumn: fk.referencedColumn,
              type: 'many-to-one',
              onDelete: fk.onDelete || 'RESTRICT',
              onUpdate: fk.onUpdate || 'RESTRICT'
            });
          }
        }
      }

      return {
        success: true,
        entities,
        relationships,
        executionTime: 0
      };
    } catch (error) {
      this.logger.error('Failed to get schema ERD', { error });
      throw error;
    }
  }

  /**
   * Get schema as RAG context for AI models
   */
  public getSchemaRAGContext(): any {
    if (!this.db) throw new Error('Database not initialized');

    try {
      const schema = this.getSchemaInfo();
      let context = '# Database Schema Context\n\n';

      context += '## Tables\n\n';
      for (const table of schema.tables) {
        if (table.type === 'view') continue;

        context += `### ${table.name}\n`;
        context += `**Primary Key**: ${table.primaryKey?.join(', ') || 'None'}\n\n`;
        context += '**Columns**:\n';

        for (const col of table.columns) {
          const nullable = col.nullable ? 'NULL' : 'NOT NULL';
          context += `- ${col.name} (${col.type}) - ${nullable}`;
          if (col.defaultValue) context += ` DEFAULT ${col.defaultValue}`;
          context += '\n';
        }

        if (table.foreignKeys && table.foreignKeys.length > 0) {
          context += '\n**Foreign Keys**:\n';
          for (const fk of table.foreignKeys) {
            context += `- ${fk.columnName} → ${fk.referencedTable}(${fk.referencedColumn})\n`;
          }
        }

        context += '\n';
      }

      context += '## Views\n\n';
      for (const view of schema.tables.filter(t => t.type === 'view')) {
        context += `### ${view.name}\n`;
        context += `Columns: ${view.columns.map(c => c.name).join(', ')}\n\n`;
      }

      return {
        success: true,
        context,
        executionTime: 0
      };
    } catch (error) {
      this.logger.error('Failed to get schema RAG context', { error });
      throw error;
    }
  }

  /**
   * Analyze SQL query for execution plan
   */
  public analyzeQuery(query: string): any {
    if (!this.db) throw new Error('Database not initialized');

    try {
      // Get EXPLAIN QUERY PLAN output
      const explainQuery = `EXPLAIN QUERY PLAN ${query}`;
      const plan = this.db.prepare(explainQuery).all() as any[];

      // Get basic statistics about the query
      const normalized = query.trim().toUpperCase();
      const isSelect = normalized.startsWith('SELECT');
      const isModifying = normalized.startsWith('INSERT') || normalized.startsWith('UPDATE') || normalized.startsWith('DELETE');

      // Parse query to extract tables and columns
      const tableMatch = normalized.match(/FROM\s+(\w+)|JOIN\s+(\w+)/g) || [];
      const tables = tableMatch.map(m => m.replace(/FROM\s+|JOIN\s+/i, '')).filter((v, i, a) => a.indexOf(v) === i);

      return {
        success: true,
        analysis: {
          queryType: isSelect ? 'SELECT' : isModifying ? 'MODIFY' : 'OTHER',
          tables,
          complexity: tables.length > 2 ? 'HIGH' : tables.length > 1 ? 'MEDIUM' : 'LOW',
          executionPlan: plan
        },
        executionTime: 0
      };
    } catch (error) {
      this.logger.error('Failed to analyze query', { error });
      throw error;
    }
  }

  /**
   * Get optimization hints for a query
   */
  public getOptimizationHints(query: string): any {
    if (!this.db) throw new Error('Database not initialized');

    try {
      const hints = [];
      const normalized = query.trim().toUpperCase();

      // Check for common performance issues
      if (normalized.includes('SELECT *')) {
        hints.push({
          severity: 'MEDIUM',
          issue: 'SELECT * used',
          recommendation: 'Specify exact columns needed instead of using SELECT *'
        });
      }

      if (normalized.includes('OR') && !normalized.includes('IN')) {
        hints.push({
          severity: 'MEDIUM',
          issue: 'Multiple OR conditions',
          recommendation: 'Consider using IN clause for better performance'
        });
      }

      if (normalized.includes('LIKE') && normalized.match(/LIKE\s+'%/)) {
        hints.push({
          severity: 'HIGH',
          issue: 'LIKE with leading wildcard',
          recommendation: 'Leading wildcards prevent index usage. Consider restructuring the query'
        });
      }

      if (normalized.includes('NOT IN')) {
        hints.push({
          severity: 'LOW',
          issue: 'NOT IN used',
          recommendation: 'Consider using NOT EXISTS or LEFT JOIN for better performance'
        });
      }

      // Check for missing indexes
      const tableMatch = normalized.match(/FROM\s+(\w+)|JOIN\s+(\w+)/g) || [];
      const tables = tableMatch.map(m => m.replace(/FROM\s+|JOIN\s+/i, '')).filter((v, i, a) => a.indexOf(v) === i);

      for (const table of tables) {
        if (isValidIdentifier(table)) {
          try {
            const columns = this.getTableColumns(table);
            const tableIndexes = this.getTableIndexes(table);

            for (const col of columns) {
              if (normalized.includes(`WHERE`) && normalized.includes(col.name) && !tableIndexes.includes(col.name)) {
                hints.push({
                  severity: 'MEDIUM',
                  issue: `Column ${col.name} in WHERE clause without index`,
                  recommendation: `Consider creating an index on ${table}.${col.name}`
                });
              }
            }
          } catch (e) {
            // Skip if table analysis fails
          }
        }
      }

      if (hints.length === 0) {
        hints.push({
          severity: 'LOW',
          issue: 'Query appears optimized',
          recommendation: 'No obvious optimization issues detected'
        });
      }

      return {
        success: true,
        query,
        hints,
        executionTime: 0
      };
    } catch (error) {
      this.logger.error('Failed to get optimization hints', { error });
      throw error;
    }
  }

  /**
   * Perform database health check
   */
  public getDatabaseHealthCheck(): any {
    if (!this.db) throw new Error('Database not initialized');

    try {
      const checks = [];

      // PRAGMA integrity_check
      const integrityResult = this.db.prepare('PRAGMA integrity_check').all() as any[];
      const integrityOk = integrityResult.length === 1 && integrityResult[0].integrity_check === 'ok';
      checks.push({
        name: 'Database Integrity',
        status: integrityOk ? 'OK' : 'FAILED',
        details: integrityResult.length === 1 ? integrityResult[0].integrity_check : integrityResult.map(r => r.integrity_check).join('; ')
      });

      // PRAGMA quick_check
      const quickCheckResult = this.db.prepare('PRAGMA quick_check').all() as any[];
      const quickCheckOk = quickCheckResult.length === 1 && quickCheckResult[0].quick_check === 'ok';
      checks.push({
        name: 'Quick Check',
        status: quickCheckOk ? 'OK' : 'WARNING',
        details: quickCheckOk ? 'No issues detected' : quickCheckResult.length + ' issues found'
      });

      // Foreign key consistency
      const fkCheck = this.db.prepare('PRAGMA foreign_key_check').all() as any[];
      checks.push({
        name: 'Foreign Key Consistency',
        status: fkCheck.length === 0 ? 'OK' : 'FAILED',
        details: fkCheck.length === 0 ? 'All foreign keys valid' : fkCheck.length + ' violations found'
      });

      // Check for orphaned tables
      const schema = this.getSchemaInfo();
      checks.push({
        name: 'Schema Validity',
        status: schema.tables.length > 0 ? 'OK' : 'WARNING',
        details: `${schema.tables.length} tables, ${schema.views.length} views, ${schema.indexes.length} indexes`
      });

      const overallStatus = checks.every(c => c.status === 'OK') ? 'HEALTHY' : 'NEEDS_ATTENTION';

      return {
        success: true,
        status: overallStatus,
        checks,
        executionTime: 0
      };
    } catch (error) {
      this.logger.error('Failed to get health check', { error });
      throw error;
    }
  }

  /**
   * Find unused indexes
   */
  public getUnusedIndexes(): any {
    if (!this.db) throw new Error('Database not initialized');

    try {
      const allIndexes = this.listIndexes();
      const schema = this.getSchemaInfo();
      const unusedIndexes = [];

      for (const index of allIndexes) {
        // Check if index columns are used in WHERE clauses of typical queries
        // For SQLite, we can check if the index is referenced in PRAGMA index_info
        const indexInfo = this.getIndexInfo(index.name);
        
        // An index is considered unused if no queries typically reference it
        // Since SQLite doesn't track usage, we flag indexes that match auto-generated patterns
        const isAutoGenerated = index.name.startsWith('sqlite_autoindex_');
        
        if (!isAutoGenerated) {
          // Check if this is a duplicate or redundant index
          const isDuplicate = allIndexes.some(idx => 
            idx.name !== index.name && 
            JSON.stringify(idx.columns) === JSON.stringify(index.columns) &&
            idx.name < index.name
          );

          if (!isDuplicate) {
            unusedIndexes.push({
              indexName: index.name,
              tableName: index.tableName,
              columns: index.columns,
              isUnique: index.isUnique,
              status: 'POTENTIALLY_UNUSED',
              recommendation: 'Monitor usage or consider dropping if not used'
            });
          }
        }
      }

      return {
        success: true,
        totalIndexes: allIndexes.length,
        potentiallyUnusedCount: unusedIndexes.length,
        unusedIndexes,
        executionTime: 0
      };
    } catch (error) {
      this.logger.error('Failed to get unused indexes', { error });
      throw error;
    }
  }

  /**
   * Insert or update a record using SQLite ON CONFLICT.
   */
  public upsertRecord(
    tableName: string,
    data: Record<string, any>,
    conflictColumns: string[],
    updateColumns?: string[],
    clientId: string = 'unknown'
  ): QueryResult {
    const startTime = Date.now();
    const connection = this.getConnection();

    try {
      if (!data || typeof data !== 'object' || Array.isArray(data) || Object.keys(data).length === 0) {
        throw new Error('data must be a non-empty object');
      }
      if (!Array.isArray(conflictColumns) || conflictColumns.length === 0) {
        throw new Error('conflictColumns must contain at least one column');
      }

      const columns = Object.keys(data);
      const columnSet = new Set(columns);
      for (const col of conflictColumns) {
        if (!columnSet.has(col)) {
          throw new Error(`Conflict column "${col}" is missing from data`);
        }
      }

      const safeTable = safeIdentifier(tableName, 'table name');
      const safeColumns = columns.map(col => safeIdentifier(col, 'column name'));
      const safeConflictColumns = conflictColumns.map(col => safeIdentifier(col, 'conflict column name'));
      const columnsToUpdate = updateColumns && updateColumns.length > 0
        ? updateColumns
        : columns.filter(col => !conflictColumns.includes(col));

      for (const col of columnsToUpdate) {
        if (!columnSet.has(col)) {
          throw new Error(`Update column "${col}" is missing from data`);
        }
      }

      const placeholders = columns.map(() => '?').join(', ');
      const conflictClause = `ON CONFLICT (${safeConflictColumns.join(', ')})`;
      const updateClause = columnsToUpdate.length > 0
        ? `DO UPDATE SET ${columnsToUpdate
          .map(col => `${safeIdentifier(col, 'update column name')} = excluded.${safeIdentifier(col, 'update column name')}`)
          .join(', ')}`
        : 'DO NOTHING';
      const query = `INSERT INTO ${safeTable} (${safeColumns.join(', ')}) VALUES (${placeholders}) ${conflictClause} ${updateClause}`;
      const info = connection.prepare(query).run(...columns.map(col => data[col]));

      return {
        success: true,
        rowsAffected: info.changes,
        lastInsertRowid: Number(info.lastInsertRowid),
        executionTime: Date.now() - startTime
      };
    } catch (error) {
      this.logger.error('Upsert failed', { clientId, error: (error as Error).message });
      return {
        success: false,
        error: (error as Error).message,
        executionTime: Date.now() - startTime
      };
    } finally {
      this.returnConnection(connection);
    }
  }

  /**
   * Read, update, or list safe SQLite PRAGMA settings.
   */
  public managePragma(operation: 'get' | 'set' | 'list', pragma?: string, value?: any): any {
    if (!this.db) throw new Error('Database not initialized');

    const startTime = Date.now();

    if (operation === 'list') {
      const data = Array.from(this.readablePragmas)
        .sort()
        .map(name => ({
          name,
          writable: this.writablePragmas.has(name)
        }));

      return {
        success: true,
        data,
        executionTime: Date.now() - startTime
      };
    }

    if (!pragma) {
      throw new Error('pragma is required');
    }

    const pragmaName = this.normalizePragmaName(pragma);

    if (operation === 'set') {
      if (!this.writablePragmas.has(pragmaName)) {
        throw new Error(`PRAGMA "${pragmaName}" is read-only or not allowed to be changed`);
      }

      const formattedValue = this.formatPragmaValue(value);
      this.db.pragma(`${pragmaName} = ${formattedValue}`);
    }

    return {
      success: true,
      pragma: pragmaName,
      value: this.db.pragma(pragmaName),
      writable: this.writablePragmas.has(pragmaName),
      executionTime: Date.now() - startTime
    };
  }

  /**
   * Run SQLite integrity_check or quick_check.
   */
  public runIntegrityCheck(checkType: 'integrity' | 'quick' = 'quick', maxErrors: number = 100): any {
    if (!this.db) throw new Error('Database not initialized');

    const startTime = Date.now();
    const safeMaxErrors = Math.min(Math.max(Number(maxErrors) || 100, 1), 10000);
    const pragmaName = checkType === 'integrity' ? 'integrity_check' : 'quick_check';
    const rows = this.db.prepare(`PRAGMA ${pragmaName}(${safeMaxErrors})`).all() as any[];
    const resultKey = pragmaName;
    const ok = rows.length === 1 && rows[0][resultKey] === 'ok';

    return {
      success: true,
      checkType,
      ok,
      issues: ok ? [] : rows.map(row => row[resultKey]),
      raw: rows,
      executionTime: Date.now() - startTime
    };
  }

  /**
   * Run SQLite foreign_key_check globally or for a specific table.
   */
  public runForeignKeyCheck(tableName?: string): any {
    if (!this.db) throw new Error('Database not initialized');

    const startTime = Date.now();
    const query = tableName
      ? `PRAGMA foreign_key_check(${safeIdentifier(tableName, 'table name')})`
      : 'PRAGMA foreign_key_check';
    const violations = this.db.prepare(query).all() as any[];

    return {
      success: true,
      tableName,
      ok: violations.length === 0,
      violationCount: violations.length,
      violations,
      executionTime: Date.now() - startTime
    };
  }

  /**
   * Run VACUUM or incremental_vacuum maintenance.
   */
  public vacuumDatabase(mode: 'full' | 'incremental' = 'full', pages?: number): any {
    if (!this.db) throw new Error('Database not initialized');

    const startTime = Date.now();

    if (mode === 'incremental') {
      const safePages = pages === undefined ? undefined : Math.min(Math.max(Number(pages) || 0, 0), 1000000);
      this.db.exec(safePages && safePages > 0 ? `PRAGMA incremental_vacuum(${safePages})` : 'PRAGMA incremental_vacuum');
    } else {
      this.db.exec('VACUUM');
    }

    return {
      success: true,
      mode,
      pages,
      executionTime: Date.now() - startTime
    };
  }

  /**
   * Run ANALYZE, REINDEX, or PRAGMA optimize.
   */
  public analyzeDatabase(operation: 'analyze' | 'reindex' | 'optimize' = 'analyze', target?: string): any {
    if (!this.db) throw new Error('Database not initialized');

    const startTime = Date.now();
    let result: any = null;

    switch (operation) {
      case 'analyze':
        this.db.exec(target ? `ANALYZE ${safeIdentifier(target, 'ANALYZE target')}` : 'ANALYZE');
        break;
      case 'reindex':
        this.db.exec(target ? `REINDEX ${safeIdentifier(target, 'REINDEX target')}` : 'REINDEX');
        break;
      case 'optimize':
        result = this.db.pragma('optimize');
        break;
      default:
        throw new Error(`Unknown analysis operation: ${operation}`);
    }

    return {
      success: true,
      operation,
      target,
      result,
      executionTime: Date.now() - startTime
    };
  }

  /**
   * Run WAL checkpoint with a validated mode.
   */
  public runWalCheckpoint(mode: 'PASSIVE' | 'FULL' | 'RESTART' | 'TRUNCATE' = 'PASSIVE'): any {
    if (!this.db) throw new Error('Database not initialized');

    const startTime = Date.now();
    const normalizedMode = String(mode || 'PASSIVE').toUpperCase();
    const allowedModes = new Set(['PASSIVE', 'FULL', 'RESTART', 'TRUNCATE']);

    if (!allowedModes.has(normalizedMode)) {
      throw new Error('mode must be one of PASSIVE, FULL, RESTART, TRUNCATE');
    }

    const result = this.db.prepare(`PRAGMA wal_checkpoint(${normalizedMode})`).all();

    return {
      success: true,
      mode: normalizedMode,
      result,
      executionTime: Date.now() - startTime
    };
  }

  /**
   * Explain a SQL query without executing its data-changing form.
   */
  public explainQueryPlan(query: string, parameters: any[] = [], includeBytecode: boolean = false): any {
    if (!this.db) throw new Error('Database not initialized');

    const startTime = Date.now();
    const plan = this.db.prepare(`EXPLAIN QUERY PLAN ${query}`).all(...parameters);
    const bytecode = includeBytecode
      ? this.db.prepare(`EXPLAIN ${query}`).all(...parameters)
      : undefined;

    return {
      success: true,
      plan,
      bytecode,
      executionTime: Date.now() - startTime
    };
  }

  /**
   * Inspect a table using SQLite-native PRAGMA metadata plus optional sample rows.
   */
  public inspectTable(tableName: string, sampleLimit: number = 0): any {
    if (!this.db) throw new Error('Database not initialized');
    if (!isValidIdentifier(tableName)) throw new Error(`Invalid table name: ${tableName}`);

    const startTime = Date.now();
    const safeTable = safeIdentifier(tableName, 'table name');
    const safeSampleLimit = Math.min(Math.max(Number(sampleLimit) || 0, 0), 100);
    const columns = this.db.prepare(`PRAGMA table_xinfo(${safeTable})`).all() as any[];
    const indexes = this.db.prepare(`PRAGMA index_list(${safeTable})`).all() as any[];
    const indexDetails = indexes.map(index => ({
      ...index,
      columns: this.db!.prepare(`PRAGMA index_xinfo(${safeIdentifier(index.name, 'index name')})`).all()
    }));
    const foreignKeys = this.db.prepare(`PRAGMA foreign_key_list(${safeTable})`).all();
    const triggers = this.db.prepare(`
      SELECT name, sql as definition
      FROM sqlite_master
      WHERE type = 'trigger' AND tbl_name = ?
      ORDER BY name
    `).all(tableName);
    const createStatement = this.db.prepare(`
      SELECT sql
      FROM sqlite_master
      WHERE type IN ('table', 'view') AND name = ?
    `).get(tableName);
    const rowCount = this.db.prepare(`SELECT COUNT(*) as count FROM ${safeTable}`).get() as { count: number };
    const sampleRows = safeSampleLimit > 0
      ? this.db.prepare(`SELECT * FROM ${safeTable} LIMIT ?`).all(safeSampleLimit)
      : [];

    return {
      success: true,
      tableName,
      columns,
      indexes: indexDetails,
      foreignKeys,
      triggers,
      createStatement,
      rowCount: rowCount.count,
      sampleRows,
      executionTime: Date.now() - startTime
    };
  }

  private normalizePragmaName(pragma: string): string {
    const normalized = pragma.trim().toLowerCase();

    if (!/^[a-z_]+$/.test(normalized)) {
      throw new Error(`Invalid PRAGMA name: ${pragma}`);
    }
    if (!this.readablePragmas.has(normalized)) {
      throw new Error(`PRAGMA "${normalized}" is not in the safe allowlist`);
    }

    return normalized;
  }

  private formatPragmaValue(value: any): string {
    if (value === undefined || value === null) {
      throw new Error('PRAGMA value is required');
    }
    if (typeof value === 'boolean') {
      return value ? 'ON' : 'OFF';
    }
    if (typeof value === 'number') {
      if (!Number.isFinite(value)) {
        throw new Error('PRAGMA numeric value must be finite');
      }
      return String(value);
    }
    if (typeof value === 'string') {
      if (value.length > 256 || value.includes('\x00')) {
        throw new Error('Invalid PRAGMA string value');
      }
      return `'${value.replace(/'/g, "''")}'`;
    }

    throw new Error('PRAGMA value must be a string, number, or boolean');
  }

  /**
   * Helper function to format bytes to human readable
   */
  private formatBytes(bytes: number, decimals: number = 2): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  }

  /**
   * Close all database connections
   */
  public close(): void {
    try {
      // Close pooled connections
      for (const connection of this.connectionPool) {
        connection.close();
      }
      this.connectionPool = [];

      // Close main connection
      if (this.db) {
        this.db.close();
        this.db = null;
      }

      this.activeConnections = 0;
      this.logger.info('Database connections closed');
    } catch (error) {
      this.logger.error('Error closing database connections', { error });
    }
  }
}

export default DatabaseManager;