/**
 * Database layer for SQLite MCP Server
 * Provides connection pooling, query execution, and schema management
 */

import Database from 'better-sqlite3';
import { DatabaseConfig, QueryResult, SchemaInfo, TableInfo, ColumnInfo, ConnectionPoolStats } from '../types';
import { Logger } from 'winston';
import * as path from 'path';
import * as fs from 'fs';

export class DatabaseManager {
  private static instance: DatabaseManager;
  private db: Database.Database | null = null;
  private config: DatabaseConfig;
  private logger: Logger;
  private connectionPool: Database.Database[] = [];
  private activeConnections = 0;
  private maxConnections: number;

  private constructor(config: DatabaseConfig, logger: Logger) {
    this.config = config;
    this.logger = logger;
    this.maxConnections = config.maxConnections || 10;
  }

  public static getInstance(config: DatabaseConfig, logger: Logger): DatabaseManager {
    if (!DatabaseManager.instance) {
      DatabaseManager.instance = new DatabaseManager(config, logger);
    }
    return DatabaseManager.instance;
  }

  /**
   * Initialize database connection
   */
  public async initialize(): Promise<void> {
    try {
      this.logger.info('Initializing database connection', { path: this.config.path });

      // Create main database connection
      this.db = this.createConnection();
      
      // Initialize connection pool
      await this.initializeConnectionPool();

      // Set up database configuration
      this.setupDatabase();

      // Create audit tables if they don't exist
      this.createAuditTables();

      this.logger.info('Database initialized successfully');
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
        version: '1.0.0',
        initialized_at: new Date().toISOString(),
        features: JSON.stringify(['audit_logging', 'connection_pooling', 'schema_introspection'])
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

      // Determine query type
      const normalizedQuery = query.trim().toUpperCase();
      const isSelect = normalizedQuery.startsWith('SELECT');
      const isInsert = normalizedQuery.startsWith('INSERT');

      let result: QueryResult;

      if (isSelect) {
        // SELECT queries
        const stmt = connection.prepare(query);
        const data = stmt.all(...parameters);
        
        result = {
          success: true,
          data,
          executionTime: Date.now() - startTime
        };
      } else {
        // INSERT, UPDATE, DELETE queries
        const stmt = connection.prepare(query);
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
    const columnsQuery = `PRAGMA table_info(${tableName})`;
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
    const columnsQuery = `PRAGMA table_info(${tableName})`;
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
    const fkQuery = `PRAGMA foreign_key_list(${tableName})`;
    return this.db!.prepare(fkQuery).all();
  }

  /**
   * Get indexes for a table
   */
  private getTableIndexes(tableName: string): string[] {
    const indexQuery = `PRAGMA index_list(${tableName})`;
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
      const backupDb = new Database(backupPath);
      (this.db as any).backup(backupDb);
      backupDb.close();
      
      this.logger.info('Database backup completed', { backupPath });
    } catch (error) {
      this.logger.error('Database backup failed', { error: (error as Error).message, backupPath });
      throw error;
    }
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