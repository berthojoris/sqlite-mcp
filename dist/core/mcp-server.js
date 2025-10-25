"use strict";
/**
 * Core MCP Server implementation for SQLite
 * Implements the Model Context Protocol for SQLite database operations
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.MCPSQLiteServer = void 0;
const index_js_1 = require("@modelcontextprotocol/sdk/server/index.js");
const stdio_js_1 = require("@modelcontextprotocol/sdk/server/stdio.js");
const types_js_1 = require("@modelcontextprotocol/sdk/types.js");
class MCPSQLiteServer {
    constructor(databaseManager, securityManager, configManager, logger) {
        this.clientPermissions = new Map();
        this.databaseManager = databaseManager;
        this.securityManager = securityManager;
        this.configManager = configManager;
        this.logger = logger;
        // Initialize MCP server
        this.server = new index_js_1.Server({
            name: 'sqlite-mcp-server',
            version: '1.0.0',
            description: 'SQLite database server implementing the Model Context Protocol'
        }, {
            capabilities: {
                tools: {},
                resources: {},
                prompts: {}
            }
        });
        this.setupHandlers();
    }
    /**
     * Set up MCP protocol handlers
     */
    setupHandlers() {
        // List available tools
        this.server.setRequestHandler(types_js_1.ListToolsRequestSchema, async () => {
            return {
                tools: this.getAvailableTools()
            };
        });
        // Handle tool calls
        this.server.setRequestHandler(types_js_1.CallToolRequestSchema, async (request) => {
            const { name, arguments: args } = request.params;
            const clientId = this.extractClientId(request);
            this.logger.info('Tool call received', {
                tool: name,
                clientId,
                argsKeys: Object.keys(args || {})
            });
            try {
                return await this.handleToolCall(name, args || {}, clientId);
            }
            catch (error) {
                this.logger.error('Tool call failed', {
                    tool: name,
                    clientId,
                    error: error.message
                });
                return {
                    content: [
                        {
                            type: 'text',
                            text: `Error executing tool ${name}: ${error.message}`
                        }
                    ],
                    isError: true
                };
            }
        });
    }
    /**
     * Extract client ID from request (simplified implementation)
     */
    extractClientId(request) {
        // In a real implementation, this would extract the client ID from the request context
        return request.meta?.clientId || 'default';
    }
    /**
     * Get available tools based on permissions
     */
    getAvailableTools() {
        const tools = [
            {
                name: 'sqlite_query',
                description: 'Execute a SQL query on the SQLite database',
                inputSchema: {
                    type: 'object',
                    properties: {
                        query: {
                            type: 'string',
                            description: 'SQL query to execute'
                        },
                        parameters: {
                            type: 'array',
                            description: 'Parameters for the SQL query',
                            items: { type: 'string' }
                        }
                    },
                    required: ['query']
                },
                requiredPermissions: ['read', 'execute']
            },
            {
                name: 'sqlite_insert',
                description: 'Insert data into a SQLite table',
                inputSchema: {
                    type: 'object',
                    properties: {
                        table: {
                            type: 'string',
                            description: 'Table name to insert into'
                        },
                        data: {
                            type: 'object',
                            description: 'Data to insert as key-value pairs'
                        }
                    },
                    required: ['table', 'data']
                },
                requiredPermissions: ['create']
            },
            {
                name: 'sqlite_update',
                description: 'Update data in a SQLite table',
                inputSchema: {
                    type: 'object',
                    properties: {
                        table: {
                            type: 'string',
                            description: 'Table name to update'
                        },
                        data: {
                            type: 'object',
                            description: 'Data to update as key-value pairs'
                        },
                        where: {
                            type: 'object',
                            description: 'WHERE conditions as key-value pairs'
                        }
                    },
                    required: ['table', 'data', 'where']
                },
                requiredPermissions: ['update']
            },
            {
                name: 'sqlite_delete',
                description: 'Delete data from a SQLite table',
                inputSchema: {
                    type: 'object',
                    properties: {
                        table: {
                            type: 'string',
                            description: 'Table name to delete from'
                        },
                        where: {
                            type: 'object',
                            description: 'WHERE conditions as key-value pairs'
                        }
                    },
                    required: ['table', 'where']
                },
                requiredPermissions: ['delete']
            },
            {
                name: 'sqlite_schema',
                description: 'Get database schema information',
                inputSchema: {
                    type: 'object',
                    properties: {
                        table: {
                            type: 'string',
                            description: 'Specific table name (optional)'
                        }
                    }
                },
                requiredPermissions: ['list']
            },
            {
                name: 'sqlite_tables',
                description: 'List all tables in the database',
                inputSchema: {
                    type: 'object',
                    properties: {}
                },
                requiredPermissions: ['list']
            },
            {
                name: 'sqlite_transaction',
                description: 'Execute multiple queries in a transaction',
                inputSchema: {
                    type: 'object',
                    properties: {
                        queries: {
                            type: 'array',
                            description: 'Array of queries to execute in transaction',
                            items: {
                                type: 'object',
                                properties: {
                                    query: { type: 'string' },
                                    parameters: { type: 'array', items: { type: 'string' } }
                                },
                                required: ['query']
                            }
                        }
                    },
                    required: ['queries']
                },
                requiredPermissions: ['transaction']
            },
            {
                name: 'sqlite_backup',
                description: 'Create a backup of the database',
                inputSchema: {
                    type: 'object',
                    properties: {
                        path: {
                            type: 'string',
                            description: 'Backup file path'
                        }
                    },
                    required: ['path']
                },
                requiredPermissions: ['utility']
            },
            {
                name: 'sqlite_bulk_insert',
                description: 'Bulk insert data with relational support and progress tracking',
                inputSchema: {
                    type: 'object',
                    properties: {
                        mainTable: {
                            type: 'string',
                            description: 'Main table name to insert into'
                        },
                        records: {
                            type: 'array',
                            description: 'Array of records to insert',
                            items: { type: 'object' }
                        },
                        relatedData: {
                            type: 'object',
                            description: 'Related table data with foreign key mappings'
                        },
                        options: {
                            type: 'object',
                            description: 'Bulk insert options',
                            properties: {
                                batchSize: { type: 'number', description: 'Batch size for processing' },
                                continueOnError: { type: 'boolean', description: 'Continue processing on errors' },
                                validateForeignKeys: { type: 'boolean', description: 'Validate foreign key constraints' },
                                insertRelatedData: { type: 'boolean', description: 'Insert related table data first' }
                            }
                        }
                    },
                    required: ['mainTable', 'records']
                },
                requiredPermissions: ['create']
            },
            {
                name: 'sqlite_bulk_update',
                description: 'Bulk update data with progress tracking',
                inputSchema: {
                    type: 'object',
                    properties: {
                        table: {
                            type: 'string',
                            description: 'Table name to update'
                        },
                        updates: {
                            type: 'array',
                            description: 'Array of update operations',
                            items: {
                                type: 'object',
                                properties: {
                                    data: { type: 'object', description: 'Data to update' },
                                    where: { type: 'object', description: 'WHERE conditions' }
                                },
                                required: ['data', 'where']
                            }
                        },
                        options: {
                            type: 'object',
                            description: 'Bulk update options',
                            properties: {
                                batchSize: { type: 'number', description: 'Batch size for processing' },
                                continueOnError: { type: 'boolean', description: 'Continue processing on errors' },
                                validateForeignKeys: { type: 'boolean', description: 'Validate foreign key constraints' }
                            }
                        }
                    },
                    required: ['table', 'updates']
                },
                requiredPermissions: ['update']
            },
            {
                name: 'sqlite_bulk_delete',
                description: 'Bulk delete data with cascading support and progress tracking',
                inputSchema: {
                    type: 'object',
                    properties: {
                        table: {
                            type: 'string',
                            description: 'Table name to delete from'
                        },
                        conditions: {
                            type: 'array',
                            description: 'Array of WHERE conditions for deletion',
                            items: { type: 'object' }
                        },
                        options: {
                            type: 'object',
                            description: 'Bulk delete options',
                            properties: {
                                batchSize: { type: 'number', description: 'Batch size for processing' },
                                continueOnError: { type: 'boolean', description: 'Continue processing on errors' },
                                cascadeDelete: { type: 'boolean', description: 'Enable cascade delete for related records' }
                            }
                        }
                    },
                    required: ['table', 'conditions']
                },
                requiredPermissions: ['delete']
            }
        ];
        // Convert to MCP Tool format
        return tools.map(tool => ({
            name: tool.name,
            description: tool.description,
            inputSchema: tool.inputSchema
        }));
    }
    /**
     * Handle tool calls
     */
    async handleToolCall(toolName, args, clientId) {
        // Check permissions
        const clientPermissions = this.clientPermissions.get(clientId) || [];
        switch (toolName) {
            case 'sqlite_query':
                return this.handleQuery(args, clientId, clientPermissions);
            case 'sqlite_insert':
                return this.handleInsert(args, clientId, clientPermissions);
            case 'sqlite_update':
                return this.handleUpdate(args, clientId, clientPermissions);
            case 'sqlite_delete':
                return this.handleDelete(args, clientId, clientPermissions);
            case 'sqlite_schema':
                return this.handleSchema(args, clientId, clientPermissions);
            case 'sqlite_tables':
                return this.handleTables(args, clientId, clientPermissions);
            case 'sqlite_transaction':
                return this.handleTransaction(args, clientId, clientPermissions);
            case 'sqlite_backup':
                return this.handleBackup(args, clientId, clientPermissions);
            case 'sqlite_bulk_insert':
                return this.handleBulkInsert(args, clientId, clientPermissions);
            case 'sqlite_bulk_update':
                return this.handleBulkUpdate(args, clientId, clientPermissions);
            case 'sqlite_bulk_delete':
                return this.handleBulkDelete(args, clientId, clientPermissions);
            default:
                throw new Error(`Unknown tool: ${toolName}`);
        }
    }
    /**
     * Handle SQL query execution
     */
    async handleQuery(args, clientId, permissions) {
        const { query, parameters = [] } = args;
        // Check permissions
        if (!permissions.includes('read') && !permissions.includes('execute')) {
            throw new Error('Insufficient permissions for query execution');
        }
        // Validate and sanitize query
        const validation = await this.securityManager.validateQuery(query, parameters, permissions, clientId);
        if (!validation.isValid) {
            throw new Error(`Query validation failed: ${validation.reason}`);
        }
        // Execute query
        const result = this.databaseManager.executeQuery(query, parameters, clientId);
        if (!result.success) {
            throw new Error(result.error || 'Query execution failed');
        }
        return {
            content: [
                {
                    type: 'text',
                    text: JSON.stringify({
                        success: true,
                        data: result.data,
                        rowsAffected: result.rowsAffected,
                        executionTime: result.executionTime
                    }, null, 2)
                }
            ]
        };
    }
    /**
     * Handle data insertion
     */
    async handleInsert(args, clientId, permissions) {
        const { table, data } = args;
        if (!permissions.includes('create')) {
            throw new Error('Insufficient permissions for insert operation');
        }
        // Build INSERT query
        const columns = Object.keys(data);
        const placeholders = columns.map(() => '?').join(', ');
        const query = `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`;
        const parameters = Object.values(data);
        // Validate query
        const validation = await this.securityManager.validateQuery(query, parameters, permissions, clientId);
        if (!validation.isValid) {
            throw new Error(`Insert validation failed: ${validation.reason}`);
        }
        // Execute insert
        const result = this.databaseManager.executeQuery(query, parameters, clientId);
        if (!result.success) {
            throw new Error(result.error || 'Insert operation failed');
        }
        return {
            content: [
                {
                    type: 'text',
                    text: JSON.stringify({
                        success: true,
                        lastInsertRowid: result.lastInsertRowid,
                        rowsAffected: result.rowsAffected,
                        executionTime: result.executionTime
                    }, null, 2)
                }
            ]
        };
    }
    /**
     * Handle data update
     */
    async handleUpdate(args, clientId, permissions) {
        const { table, data, where } = args;
        if (!permissions.includes('update')) {
            throw new Error('Insufficient permissions for update operation');
        }
        // Build UPDATE query
        const setClause = Object.keys(data).map(key => `${key} = ?`).join(', ');
        const whereClause = Object.keys(where).map(key => `${key} = ?`).join(' AND ');
        const query = `UPDATE ${table} SET ${setClause} WHERE ${whereClause}`;
        const parameters = [...Object.values(data), ...Object.values(where)];
        // Validate query
        const validation = await this.securityManager.validateQuery(query, parameters, permissions, clientId);
        if (!validation.isValid) {
            throw new Error(`Update validation failed: ${validation.reason}`);
        }
        // Execute update
        const result = this.databaseManager.executeQuery(query, parameters, clientId);
        if (!result.success) {
            throw new Error(result.error || 'Update operation failed');
        }
        return {
            content: [
                {
                    type: 'text',
                    text: JSON.stringify({
                        success: true,
                        rowsAffected: result.rowsAffected,
                        executionTime: result.executionTime
                    }, null, 2)
                }
            ]
        };
    }
    /**
     * Handle data deletion
     */
    async handleDelete(args, clientId, permissions) {
        const { table, where } = args;
        if (!permissions.includes('delete')) {
            throw new Error('Insufficient permissions for delete operation');
        }
        // Build DELETE query
        const whereClause = Object.keys(where).map(key => `${key} = ?`).join(' AND ');
        const query = `DELETE FROM ${table} WHERE ${whereClause}`;
        const parameters = Object.values(where);
        // Validate query
        const validation = await this.securityManager.validateQuery(query, parameters, permissions, clientId);
        if (!validation.isValid) {
            throw new Error(`Delete validation failed: ${validation.reason}`);
        }
        // Execute delete
        const result = this.databaseManager.executeQuery(query, parameters, clientId);
        if (!result.success) {
            throw new Error(result.error || 'Delete operation failed');
        }
        return {
            content: [
                {
                    type: 'text',
                    text: JSON.stringify({
                        success: true,
                        rowsAffected: result.rowsAffected,
                        executionTime: result.executionTime
                    }, null, 2)
                }
            ]
        };
    }
    /**
     * Handle schema information request
     */
    async handleSchema(args, clientId, permissions) {
        if (!permissions.includes('list')) {
            throw new Error('Insufficient permissions for schema access');
        }
        const { table } = args;
        const schema = this.databaseManager.getSchemaInfo();
        let result = schema;
        if (table) {
            // Filter for specific table
            result = {
                tables: schema.tables.filter(t => t.name === table),
                views: schema.views?.filter((v) => v.name === table) || [],
                indexes: schema.indexes?.filter((i) => i.tableName === table) || [],
                triggers: schema.triggers?.filter((t) => t.tableName === table) || []
            };
        }
        return {
            content: [
                {
                    type: 'text',
                    text: JSON.stringify(result, null, 2)
                }
            ]
        };
    }
    /**
     * Handle tables list request
     */
    async handleTables(args, clientId, permissions) {
        if (!permissions.includes('list')) {
            throw new Error('Insufficient permissions for table listing');
        }
        const schema = this.databaseManager.getSchemaInfo();
        const tables = schema.tables.map(table => ({
            name: table.name,
            type: table.type,
            columnCount: table.columns.length
        }));
        return {
            content: [
                {
                    type: 'text',
                    text: JSON.stringify({ tables }, null, 2)
                }
            ]
        };
    }
    /**
     * Handle transaction execution
     */
    async handleTransaction(args, clientId, permissions) {
        const { queries } = args;
        if (!permissions.includes('transaction')) {
            throw new Error('Insufficient permissions for transaction execution');
        }
        // Validate all queries in the transaction
        for (const queryObj of queries) {
            const validation = await this.securityManager.validateQuery(queryObj.query, queryObj.parameters || [], permissions, clientId);
            if (!validation.isValid) {
                throw new Error(`Transaction validation failed: ${validation.reason}`);
            }
        }
        // Execute transaction
        const result = this.databaseManager.executeTransaction(queries, clientId);
        if (!result.success) {
            throw new Error(result.error || 'Transaction execution failed');
        }
        return {
            content: [
                {
                    type: 'text',
                    text: JSON.stringify({
                        success: true,
                        results: result.data,
                        executionTime: result.executionTime
                    }, null, 2)
                }
            ]
        };
    }
    /**
     * Handle database backup
     */
    async handleBackup(args, clientId, permissions) {
        const { path } = args;
        if (!permissions.includes('utility')) {
            throw new Error('Insufficient permissions for backup operation');
        }
        try {
            await this.databaseManager.backupDatabase(path);
            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify({
                            success: true,
                            message: `Database backed up to ${path}`,
                            timestamp: new Date().toISOString()
                        }, null, 2)
                    }
                ]
            };
        }
        catch (error) {
            throw new Error(`Backup failed: ${error.message}`);
        }
    }
    /**
     * Handle bulk insert operation
     */
    async handleBulkInsert(args, clientId, permissions) {
        const { mainTable, records, relatedData = {}, options = {} } = args;
        // Check permissions
        if (!permissions.includes('create')) {
            throw new Error('Insufficient permissions for bulk insert operation');
        }
        try {
            const result = await this.databaseManager.bulkInsert({
                mainTable,
                records,
                relatedData,
                options
            });
            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify({
                            success: result.success,
                            executionTime: result.executionTime,
                            summary: {
                                totalRecords: result.summary.totalRecords,
                                successfulRecords: result.summary.successfulRecords,
                                failedRecords: result.summary.failedRecords,
                                errors: result.progress.errors,
                                affectedTables: result.summary.affectedTables
                            },
                            progress: result.progress
                        }, null, 2)
                    }
                ]
            };
        }
        catch (error) {
            throw new Error(`Bulk insert failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    /**
     * Handle bulk update operation
     */
    async handleBulkUpdate(args, clientId, permissions) {
        const { table, updates, options = {} } = args;
        // Check permissions
        if (!permissions.includes('update')) {
            throw new Error('Insufficient permissions for bulk update operation');
        }
        try {
            const result = await this.databaseManager.bulkUpdate({
                table,
                updates,
                options
            });
            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify({
                            success: result.success,
                            executionTime: result.executionTime,
                            summary: {
                                totalRecords: result.summary.totalRecords,
                                successfulRecords: result.summary.successfulRecords,
                                failedRecords: result.summary.failedRecords,
                                errors: result.progress.errors
                            },
                            progress: result.progress
                        }, null, 2)
                    }
                ]
            };
        }
        catch (error) {
            throw new Error(`Bulk update failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    /**
     * Handle bulk delete operation
     */
    async handleBulkDelete(args, clientId, permissions) {
        const { table, conditions, options = {} } = args;
        // Check permissions
        if (!permissions.includes('delete')) {
            throw new Error('Insufficient permissions for bulk delete operation');
        }
        try {
            const result = await this.databaseManager.bulkDelete({
                table: table,
                conditions,
                options
            });
            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify({
                            success: result.success,
                            executionTime: result.executionTime,
                            summary: {
                                totalRecords: result.summary.totalRecords,
                                successfulRecords: result.summary.successfulRecords,
                                failedRecords: result.summary.failedRecords,
                                errors: result.progress.errors
                            },
                            progress: result.progress
                        }, null, 2)
                    }
                ]
            };
        }
        catch (error) {
            throw new Error(`Bulk delete failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    /**
     * Set client permissions
     */
    setClientPermissions(clientId, permissions) {
        this.clientPermissions.set(clientId, permissions);
        this.logger.info('Client permissions updated', { clientId, permissions });
    }
    /**
     * Start the MCP server
     */
    async start() {
        const transport = new stdio_js_1.StdioServerTransport();
        await this.server.connect(transport);
        this.logger.info('MCP SQLite server started');
    }
    /**
     * Stop the MCP server
     */
    async stop() {
        await this.server.close();
        this.databaseManager.close();
        this.logger.info('MCP SQLite server stopped');
    }
}
exports.MCPSQLiteServer = MCPSQLiteServer;
exports.default = MCPSQLiteServer;
//# sourceMappingURL=mcp-server.js.map