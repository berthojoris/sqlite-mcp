/**
 * Database layer for SQLite MCP Server
 * Provides connection pooling, query execution, and schema management
 */
import { DatabaseConfig, QueryResult, SchemaInfo, ConnectionPoolStats } from '../types';
import { Logger } from 'winston';
export declare class DatabaseManager {
    private static instance;
    private db;
    private config;
    private logger;
    private connectionPool;
    private activeConnections;
    private maxConnections;
    private constructor();
    static getInstance(config: DatabaseConfig, logger: Logger): DatabaseManager;
    /**
     * Initialize database connection
     */
    initialize(): Promise<void>;
    /**
     * Create a new database connection
     */
    private createConnection;
    /**
     * Initialize connection pool
     */
    private initializeConnectionPool;
    /**
     * Get a connection from the pool
     */
    private getConnection;
    /**
     * Return connection to pool
     */
    private returnConnection;
    /**
     * Set up database configuration
     */
    private setupDatabase;
    /**
     * Create audit tables
     */
    private createAuditTables;
    /**
     * Execute a query safely with parameters
     */
    executeQuery(query: string, parameters?: any[], clientId?: string): QueryResult;
    /**
     * Execute multiple queries in a transaction
     */
    executeTransaction(queries: Array<{
        query: string;
        parameters?: any[];
    }>, clientId?: string): QueryResult;
    /**
     * Get database schema information
     */
    getSchemaInfo(): SchemaInfo;
    /**
     * Get table information
     */
    private getTables;
    /**
     * Get column information for a table
     */
    private getTableColumns;
    /**
     * Get primary key columns for a table
     */
    private getPrimaryKey;
    /**
     * Get foreign key information for a table
     */
    private getForeignKeys;
    /**
     * Get indexes for a table
     */
    private getTableIndexes;
    /**
     * Get views information
     */
    private getViews;
    /**
     * Get indexes information
     */
    private getIndexes;
    /**
     * Get triggers information
     */
    private getTriggers;
    /**
     * Get connection pool statistics
     */
    getConnectionPoolStats(): ConnectionPoolStats;
    /**
     * Backup database to file
     */
    backupDatabase(backupPath: string): Promise<void>;
    /**
     * Close all database connections
     */
    close(): void;
}
export default DatabaseManager;
//# sourceMappingURL=index.d.ts.map