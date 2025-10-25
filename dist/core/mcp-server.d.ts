/**
 * Core MCP Server implementation for SQLite
 * Implements the Model Context Protocol for SQLite database operations
 */
import { DatabaseManager } from '../database';
import { SecurityManager } from '../security';
import { ConfigManager } from '../config';
import { Logger } from 'winston';
import { PermissionType } from '../types';
export declare class MCPSQLiteServer {
    private server;
    private databaseManager;
    private securityManager;
    private configManager;
    private logger;
    private clientPermissions;
    constructor(databaseManager: DatabaseManager, securityManager: SecurityManager, configManager: ConfigManager, logger: Logger);
    /**
     * Set up MCP protocol handlers
     */
    private setupHandlers;
    /**
     * Extract client ID from request (simplified implementation)
     */
    private extractClientId;
    /**
     * Get available tools based on permissions
     */
    private getAvailableTools;
    /**
     * Handle tool calls
     */
    private handleToolCall;
    /**
     * Handle SQL query execution
     */
    private handleQuery;
    /**
     * Handle data insertion
     */
    private handleInsert;
    /**
     * Handle data update
     */
    private handleUpdate;
    /**
     * Handle data deletion
     */
    private handleDelete;
    /**
     * Handle schema information request
     */
    private handleSchema;
    /**
     * Handle tables list request
     */
    private handleTables;
    /**
     * Handle transaction execution
     */
    private handleTransaction;
    /**
     * Handle database backup
     */
    private handleBackup;
    /**
     * Handle bulk insert operation
     */
    private handleBulkInsert;
    /**
     * Handle bulk update operation
     */
    private handleBulkUpdate;
    /**
     * Handle bulk delete operation
     */
    private handleBulkDelete;
    /**
     * Set client permissions
     */
    setClientPermissions(clientId: string, permissions: PermissionType[]): void;
    /**
     * Start the MCP server
     */
    start(): Promise<void>;
    /**
     * Stop the MCP server
     */
    stop(): Promise<void>;
}
export default MCPSQLiteServer;
//# sourceMappingURL=mcp-server.d.ts.map