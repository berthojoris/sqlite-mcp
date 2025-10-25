"use strict";
/**
 * Database layer for SQLite MCP Server
 * Provides connection pooling, query execution, and schema management
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DatabaseManager = void 0;
const better_sqlite3_1 = __importDefault(require("better-sqlite3"));
const fs = __importStar(require("fs"));
class DatabaseManager {
    constructor(config, logger) {
        this.db = null;
        this.connectionPool = [];
        this.activeConnections = 0;
        this.config = config;
        this.logger = logger;
        this.maxConnections = config.maxConnections || 10;
    }
    static getInstance(config, logger) {
        if (!DatabaseManager.instance) {
            DatabaseManager.instance = new DatabaseManager(config, logger);
        }
        return DatabaseManager.instance;
    }
    /**
     * Initialize database connection
     */
    async initialize() {
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
        }
        catch (error) {
            this.logger.error('Failed to initialize database', { error });
            throw error;
        }
    }
    /**
     * Create a new database connection
     */
    createConnection() {
        const options = {
            timeout: this.config.timeout || 30000,
            verbose: (message) => this.logger.debug('SQLite:', message)
        };
        if (this.config.readOnly) {
            options.readonly = true;
        }
        const db = new better_sqlite3_1.default(this.config.path, options);
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
    async initializeConnectionPool() {
        for (let i = 0; i < Math.min(3, this.maxConnections); i++) {
            try {
                const connection = this.createConnection();
                this.connectionPool.push(connection);
            }
            catch (error) {
                this.logger.warn('Failed to create pooled connection', { error, index: i });
            }
        }
    }
    /**
     * Get a connection from the pool
     */
    getConnection() {
        if (this.connectionPool.length > 0) {
            const connection = this.connectionPool.pop();
            this.activeConnections++;
            return connection;
        }
        if (this.activeConnections < this.maxConnections) {
            this.activeConnections++;
            return this.createConnection();
        }
        // If no connections available, use main connection
        return this.db;
    }
    /**
     * Return connection to pool
     */
    returnConnection(connection) {
        if (connection !== this.db && this.connectionPool.length < 3) {
            this.connectionPool.push(connection);
            this.activeConnections--;
        }
        else if (connection !== this.db) {
            try {
                connection.close();
                this.activeConnections--;
            }
            catch (error) {
                this.logger.warn('Error closing connection', { error });
            }
        }
    }
    /**
     * Set up database configuration
     */
    setupDatabase() {
        if (!this.db)
            return;
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
        }
        catch (error) {
            this.logger.error('Failed to setup database configuration', { error });
        }
    }
    /**
     * Create audit tables
     */
    createAuditTables() {
        if (!this.db)
            return;
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
        }
        catch (error) {
            this.logger.error('Failed to create audit tables', { error });
        }
    }
    /**
     * Execute a query safely with parameters
     */
    executeQuery(query, parameters = [], clientId = 'unknown') {
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
            let result;
            if (isSelect) {
                // SELECT queries
                const stmt = connection.prepare(query);
                const data = stmt.all(...parameters);
                result = {
                    success: true,
                    data,
                    executionTime: Date.now() - startTime
                };
            }
            else {
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
        }
        catch (error) {
            const executionTime = Date.now() - startTime;
            const errorMessage = error.message;
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
        }
        finally {
            this.returnConnection(connection);
        }
    }
    /**
     * Execute multiple queries in a transaction
     */
    executeTransaction(queries, clientId = 'unknown') {
        const startTime = Date.now();
        const connection = this.getConnection();
        try {
            this.logger.debug('Starting transaction', { clientId, queryCount: queries.length });
            const transaction = connection.transaction((queries) => {
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
        }
        catch (error) {
            const executionTime = Date.now() - startTime;
            const errorMessage = error.message;
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
        }
        finally {
            this.returnConnection(connection);
        }
    }
    /**
     * Get database schema information
     */
    getSchemaInfo() {
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
        }
        catch (error) {
            this.logger.error('Failed to get schema info', { error });
            throw error;
        }
    }
    /**
     * Get table information
     */
    getTables() {
        const tablesQuery = `
      SELECT name, type 
      FROM sqlite_master 
      WHERE type IN ('table', 'view') 
      AND name NOT LIKE 'sqlite_%'
      ORDER BY name
    `;
        const tables = this.db.prepare(tablesQuery).all();
        return tables.map(table => {
            const columns = this.getTableColumns(table.name);
            const primaryKey = this.getPrimaryKey(table.name);
            const foreignKeys = this.getForeignKeys(table.name);
            const indexes = this.getTableIndexes(table.name);
            return {
                name: table.name,
                type: table.type,
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
    getTableColumns(tableName) {
        const columnsQuery = `PRAGMA table_info(${tableName})`;
        const columns = this.db.prepare(columnsQuery).all();
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
    getPrimaryKey(tableName) {
        const columnsQuery = `PRAGMA table_info(${tableName})`;
        const columns = this.db.prepare(columnsQuery).all();
        return columns
            .filter(col => col.pk > 0)
            .sort((a, b) => a.pk - b.pk)
            .map(col => col.name);
    }
    /**
     * Get foreign key information for a table
     */
    getForeignKeys(tableName) {
        const fkQuery = `PRAGMA foreign_key_list(${tableName})`;
        return this.db.prepare(fkQuery).all();
    }
    /**
     * Get indexes for a table
     */
    getTableIndexes(tableName) {
        const indexQuery = `PRAGMA index_list(${tableName})`;
        const indexes = this.db.prepare(indexQuery).all();
        return indexes.map(idx => idx.name);
    }
    /**
     * Get views information
     */
    getViews() {
        const viewsQuery = `
      SELECT name, sql as definition
      FROM sqlite_master 
      WHERE type = 'view'
      ORDER BY name
    `;
        return this.db.prepare(viewsQuery).all();
    }
    /**
     * Get indexes information
     */
    getIndexes() {
        const indexesQuery = `
      SELECT name, tbl_name as tableName, sql
      FROM sqlite_master 
      WHERE type = 'index'
      AND name NOT LIKE 'sqlite_%'
      ORDER BY name
    `;
        return this.db.prepare(indexesQuery).all();
    }
    /**
     * Get triggers information
     */
    getTriggers() {
        const triggersQuery = `
      SELECT name, tbl_name as tableName, sql as definition
      FROM sqlite_master 
      WHERE type = 'trigger'
      ORDER BY name
    `;
        return this.db.prepare(triggersQuery).all();
    }
    /**
     * Get connection pool statistics
     */
    getConnectionPoolStats() {
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
    async backupDatabase(backupPath) {
        if (!this.db) {
            throw new Error('Database not initialized');
        }
        try {
            const backupDb = new better_sqlite3_1.default(backupPath);
            this.db.backup(backupDb);
            backupDb.close();
            this.logger.info('Database backup completed', { backupPath });
        }
        catch (error) {
            this.logger.error('Database backup failed', { error: error.message, backupPath });
            throw error;
        }
    }
    /**
     * Bulk insert operation with relational data support
     */
    async bulkInsert(data) {
        const startTime = new Date();
        const batchSize = data.options?.batchSize || 1000;
        const continueOnError = data.options?.continueOnError || false;
        const insertRelatedData = data.options?.insertRelatedData || false;
        const progress = {
            totalRecords: data.records.length,
            processedRecords: 0,
            successfulRecords: 0,
            failedRecords: 0,
            currentBatch: 0,
            totalBatches: Math.ceil(data.records.length / batchSize),
            startTime,
            errors: []
        };
        const affectedTables = new Set([data.mainTable]);
        const connection = this.getConnection();
        try {
            // Begin transaction
            const transaction = connection.transaction(() => {
                // First, handle related data if specified
                const relatedDataMappings = new Map();
                if (insertRelatedData && data.relatedData) {
                    for (const [tableName, tableData] of Object.entries(data.relatedData)) {
                        affectedTables.add(tableName);
                        const valueMapping = new Map();
                        relatedDataMappings.set(tableName, valueMapping);
                        // Insert related records and track ID mappings
                        for (const relatedRecord of tableData.records) {
                            try {
                                const columns = Object.keys(relatedRecord);
                                const placeholders = columns.map(() => '?').join(', ');
                                const insertSql = `INSERT INTO ${tableName} (${columns.join(', ')}) VALUES (${placeholders})`;
                                const stmt = connection.prepare(insertSql);
                                const result = stmt.run(...Object.values(relatedRecord));
                                // Map original value to new ID for foreign key references
                                for (const [localColumn, mapping] of Object.entries(tableData.foreignKeyMappings)) {
                                    if (relatedRecord[mapping.referencedColumn] !== undefined) {
                                        valueMapping.set(relatedRecord[mapping.referencedColumn], result.lastInsertRowid);
                                    }
                                }
                            }
                            catch (error) {
                                if (!continueOnError)
                                    throw error;
                                progress.errors.push({
                                    recordIndex: -1,
                                    record: relatedRecord,
                                    error: error.message,
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
                            const columns = Object.keys(record);
                            const placeholders = columns.map(() => '?').join(', ');
                            const insertSql = `INSERT INTO ${data.mainTable} (${columns.join(', ')}) VALUES (${placeholders})`;
                            const stmt = connection.prepare(insertSql);
                            stmt.run(...Object.values(record));
                            progress.successfulRecords++;
                        }
                        catch (error) {
                            progress.failedRecords++;
                            progress.errors.push({
                                recordIndex,
                                record: batch[j],
                                error: error.message,
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
        }
        catch (error) {
            this.logger.error('Bulk insert failed', { error: error.message });
            throw error;
        }
        finally {
            this.returnConnection(connection);
        }
    }
    /**
     * Bulk update operation with progress tracking
     */
    async bulkUpdate(data) {
        const startTime = new Date();
        const batchSize = data.options?.batchSize || 1000;
        const continueOnError = data.options?.continueOnError || false;
        const progress = {
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
                            const setClause = Object.keys(update.data)
                                .map(key => `${key} = ?`)
                                .join(', ');
                            const whereClause = Object.keys(update.where)
                                .map(key => `${key} = ?`)
                                .join(' AND ');
                            const updateSql = `UPDATE ${data.table} SET ${setClause} WHERE ${whereClause}`;
                            const stmt = connection.prepare(updateSql);
                            const result = stmt.run(...Object.values(update.data), ...Object.values(update.where));
                            if (result.changes > 0) {
                                progress.successfulRecords++;
                            }
                            else {
                                progress.failedRecords++;
                                progress.errors.push({
                                    recordIndex,
                                    record: update,
                                    error: 'No rows affected - record may not exist',
                                    timestamp: new Date()
                                });
                            }
                        }
                        catch (error) {
                            progress.failedRecords++;
                            progress.errors.push({
                                recordIndex,
                                record: update,
                                error: error.message,
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
        }
        catch (error) {
            this.logger.error('Bulk update failed', { error: error.message });
            throw error;
        }
        finally {
            this.returnConnection(connection);
        }
    }
    /**
     * Bulk delete operation with cascading support
     */
    async bulkDelete(data) {
        const startTime = new Date();
        const batchSize = data.options?.batchSize || 1000;
        const continueOnError = data.options?.continueOnError || false;
        const cascadeDelete = data.options?.cascadeDelete || false;
        const progress = {
            totalRecords: data.conditions.length,
            processedRecords: 0,
            successfulRecords: 0,
            failedRecords: 0,
            currentBatch: 0,
            totalBatches: Math.ceil(data.conditions.length / batchSize),
            startTime,
            errors: []
        };
        const affectedTables = new Set([data.table]);
        const connection = this.getConnection();
        try {
            // Get foreign key relationships if cascade delete is enabled
            let foreignKeyTables = [];
            if (cascadeDelete) {
                const fkQuery = `
          SELECT DISTINCT m.name as table_name
          FROM sqlite_master m
          JOIN pragma_foreign_key_list(m.name) fk ON fk.table = ?
          WHERE m.type = 'table'
        `;
                const fkResult = connection.prepare(fkQuery).all(data.table);
                foreignKeyTables = fkResult.map((row) => row.table_name);
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
                                    const whereClause = Object.keys(condition)
                                        .map(key => `${key} = ?`)
                                        .join(' AND ');
                                    const cascadeDeleteSql = `DELETE FROM ${fkTable} WHERE ${whereClause}`;
                                    const cascadeStmt = connection.prepare(cascadeDeleteSql);
                                    cascadeStmt.run(...Object.values(condition));
                                }
                            }
                            // Delete from main table
                            const whereClause = Object.keys(condition)
                                .map(key => `${key} = ?`)
                                .join(' AND ');
                            const deleteSql = `DELETE FROM ${data.table} WHERE ${whereClause}`;
                            const stmt = connection.prepare(deleteSql);
                            const result = stmt.run(...Object.values(condition));
                            if (result.changes > 0) {
                                progress.successfulRecords++;
                            }
                            else {
                                progress.failedRecords++;
                                progress.errors.push({
                                    recordIndex,
                                    record: condition,
                                    error: 'No rows affected - record may not exist',
                                    timestamp: new Date()
                                });
                            }
                        }
                        catch (error) {
                            progress.failedRecords++;
                            progress.errors.push({
                                recordIndex,
                                record: condition,
                                error: error.message,
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
        }
        catch (error) {
            this.logger.error('Bulk delete failed', { error: error.message });
            throw error;
        }
        finally {
            this.returnConnection(connection);
        }
    }
    /**
     * Close all database connections
     */
    close() {
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
        }
        catch (error) {
            this.logger.error('Error closing database connections', { error });
        }
    }
}
exports.DatabaseManager = DatabaseManager;
exports.default = DatabaseManager;
//# sourceMappingURL=index.js.map