/**
 * Core MCP Server implementation for SQLite
 * Implements the Model Context Protocol for SQLite database operations
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
  CallToolResult,
  TextContent
} from '@modelcontextprotocol/sdk/types.js';
import { DatabaseManager } from '../database';
import { SecurityManager } from '../security';
import { ConfigManager } from '../config';
import { Logger } from 'winston';
import { PermissionType, QueryResult, SchemaInfo, MCPToolDefinition } from '../types';
import { safeIdentifier } from '../utils';

export class MCPSQLiteServer {
  private server: Server;
  private databaseManager: DatabaseManager;
  private securityManager: SecurityManager;
  private configManager: ConfigManager;
  private logger: Logger;
  private clientPermissions: Map<string, PermissionType[]> = new Map();

  constructor(
    databaseManager: DatabaseManager,
    securityManager: SecurityManager,
    configManager: ConfigManager,
    logger: Logger
  ) {
    this.databaseManager = databaseManager;
    this.securityManager = securityManager;
    this.configManager = configManager;
    this.logger = logger;

    // Initialize MCP server
    this.server = new Server(
      {
        name: 'sqlite-mcp-server',
        version: '1.1.7',
        description: 'SQLite database server implementing the Model Context Protocol'
      },
      {
        capabilities: {
          tools: {},
          resources: {},
          prompts: {}
        }
      }
    );

    this.setupHandlers();
  }

  /**
   * Set up MCP protocol handlers
   */
  private setupHandlers(): void {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: this.getAvailableTools()
      };
    });

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      const clientId = this.extractClientId(request);

      this.logger.info('Tool call received', { 
        tool: name, 
        clientId,
        argsKeys: Object.keys(args || {})
      });

      try {
        return await this.handleToolCall(name, args || {}, clientId);
      } catch (error) {
        this.logger.error('Tool call failed', { 
          tool: name, 
          clientId, 
          error: (error as Error).message 
        });

        return {
          content: [
            {
              type: 'text',
              text: `Error executing tool ${name}: ${(error as Error).message}`
            } as TextContent
          ],
          isError: true
        };
      }
    });
  }

  /**
   * Extract client ID from request (simplified implementation)
   */
  private extractClientId(request: any): string {
    // In a real implementation, this would extract the client ID from the request context
    return request.meta?.clientId || 'default';
  }

  /**
   * Get available tools based on permissions
   */
  private getAvailableTools(): Tool[] {
    const tools: MCPToolDefinition[] = [
      {
        name: 'sqlite_query',
        description: 'Execute a raw SQL query on the SQLite database. Use this for SELECT queries, complex joins, aggregations, or any custom SQL. For simple CRUD operations, prefer the dedicated insert/update/delete tools. Returns query results as JSON array for SELECT, or affected row count for other statements.',
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'SQL query to execute. Use ? placeholders for parameters. Example: "SELECT * FROM users WHERE age > ? AND status = ?"'
            },
            parameters: {
              type: 'array',
              description: 'Values for query placeholders in order. Example: [25, "active"] for the query above',
              items: { type: 'string' }
            }
          },
          required: ['query']
        },
        requiredPermissions: ['read', 'execute']
      },
      {
        name: 'sqlite_insert',
        description: 'Insert a single row into a SQLite table. For inserting multiple rows efficiently, use sqlite_bulk_insert instead. Returns the lastInsertRowid and number of affected rows.',
        inputSchema: {
          type: 'object',
          properties: {
            table: {
              type: 'string',
              description: 'Target table name. Example: "users"'
            },
            data: {
              type: 'object',
              description: 'Column-value pairs to insert. Example: {"name": "John", "email": "john@example.com", "age": 30}'
            }
          },
          required: ['table', 'data']
        },
        requiredPermissions: ['create']
      },
      {
        name: 'sqlite_update',
        description: 'Update existing rows in a SQLite table matching the WHERE conditions. All conditions are combined with AND. For updating multiple rows with different values, use sqlite_bulk_update. Returns the number of affected rows.',
        inputSchema: {
          type: 'object',
          properties: {
            table: {
              type: 'string',
              description: 'Target table name. Example: "users"'
            },
            data: {
              type: 'object',
              description: 'Column-value pairs to update. Example: {"status": "inactive", "updated_at": "2024-01-15"}'
            },
            where: {
              type: 'object',
              description: 'WHERE conditions as column-value pairs (combined with AND). Example: {"id": 123} or {"status": "active", "role": "admin"}'
            }
          },
          required: ['table', 'data', 'where']
        },
        requiredPermissions: ['update']
      },
      {
        name: 'sqlite_delete',
        description: 'Delete rows from a SQLite table matching the WHERE conditions. All conditions are combined with AND. For deleting multiple sets of conditions or with cascade support, use sqlite_bulk_delete. Returns the number of deleted rows.',
        inputSchema: {
          type: 'object',
          properties: {
            table: {
              type: 'string',
              description: 'Target table name. Example: "users"'
            },
            where: {
              type: 'object',
              description: 'WHERE conditions as column-value pairs (combined with AND). Example: {"id": 123} or {"status": "deleted", "created_at": "2023-01-01"}'
            }
          },
          required: ['table', 'where']
        },
        requiredPermissions: ['delete']
      },
      {
        name: 'sqlite_schema',
        description: 'Retrieve detailed schema information including tables, columns, data types, primary keys, foreign keys, indexes, views, and triggers. Use this to understand database structure before writing queries. Optionally filter by specific table name.',
        inputSchema: {
          type: 'object',
          properties: {
            table: {
              type: 'string',
              description: 'Filter schema info for a specific table name. If omitted, returns schema for all tables.'
            }
          }
        },
        requiredPermissions: ['list']
      },
      {
        name: 'sqlite_tables',
        description: 'Get a quick list of all tables in the database with basic info (name, type, column count). Use this for a fast overview; use sqlite_schema for detailed column and constraint information.',
        inputSchema: {
          type: 'object',
          properties: {}
        },
        requiredPermissions: ['list']
      },
      {
        name: 'sqlite_transaction',
        description: 'Execute multiple SQL queries atomically in a single transaction. If any query fails, all changes are rolled back. Use this when you need to ensure data consistency across multiple operations (e.g., transferring funds between accounts).',
        inputSchema: {
          type: 'object',
          properties: {
            queries: {
              type: 'array',
              description: 'Array of queries to execute atomically. Example: [{"query": "UPDATE accounts SET balance = balance - 100 WHERE id = ?", "parameters": ["1"]}, {"query": "UPDATE accounts SET balance = balance + 100 WHERE id = ?", "parameters": ["2"]}]',
              items: {
                type: 'object',
                properties: {
                  query: { type: 'string', description: 'SQL query with ? placeholders' },
                  parameters: { type: 'array', items: { type: 'string' }, description: 'Parameter values for placeholders' }
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
        description: 'Create a complete backup copy of the database to a specified file path. The backup is consistent and can be used to restore the database later. Returns success status and timestamp.',
        inputSchema: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: 'Full file path for the backup. Example: "/backups/mydb_2024-01-15.sqlite" or "C:\\backups\\mydb_backup.sqlite"'
            }
          },
          required: ['path']
        },
        requiredPermissions: ['utility']
      },
      {
        name: 'sqlite_bulk_insert',
        description: 'Insert multiple rows efficiently in batches with progress tracking. Supports relational data insertion with automatic foreign key mapping. Use this instead of multiple sqlite_insert calls for better performance. Returns detailed progress with success/failure counts.',
        inputSchema: {
          type: 'object',
          properties: {
            mainTable: {
              type: 'string',
              description: 'Target table name for the main records. Example: "orders"'
            },
            records: {
              type: 'array',
              description: 'Array of row objects to insert. Example: [{"customer_id": 1, "total": 99.99}, {"customer_id": 2, "total": 149.50}]',
              items: { type: 'object' }
            },
            relatedData: {
              type: 'object',
              description: 'Optional related table data with foreign key mappings for hierarchical inserts'
            },
            options: {
              type: 'object',
              description: 'Bulk operation options',
              properties: {
                batchSize: { type: 'number', description: 'Number of records per batch (default: 1000). Lower values use less memory.' },
                continueOnError: { type: 'boolean', description: 'If true, continue processing remaining records when one fails (default: false)' },
                validateForeignKeys: { type: 'boolean', description: 'Validate foreign key constraints before insert (default: false)' },
                insertRelatedData: { type: 'boolean', description: 'Insert related table data first and map foreign keys (default: false)' }
              }
            }
          },
          required: ['mainTable', 'records']
        },
        requiredPermissions: ['create']
      },
      {
        name: 'sqlite_bulk_update',
        description: 'Update multiple rows with different values efficiently in batches. Each update operation specifies its own data and WHERE conditions. Use this instead of multiple sqlite_update calls for better performance. Returns detailed progress with success/failure counts.',
        inputSchema: {
          type: 'object',
          properties: {
            table: {
              type: 'string',
              description: 'Target table name. Example: "products"'
            },
            updates: {
              type: 'array',
              description: 'Array of update operations, each with data to set and WHERE conditions. Example: [{"data": {"price": 29.99}, "where": {"id": 1}}, {"data": {"price": 39.99}, "where": {"id": 2}}]',
              items: {
                type: 'object',
                properties: {
                  data: { type: 'object', description: 'Column-value pairs to update' },
                  where: { type: 'object', description: 'WHERE conditions to identify the row(s)' }
                },
                required: ['data', 'where']
              }
            },
            options: {
              type: 'object',
              description: 'Bulk operation options',
              properties: {
                batchSize: { type: 'number', description: 'Number of updates per batch (default: 1000)' },
                continueOnError: { type: 'boolean', description: 'If true, continue processing when an update fails (default: false)' },
                validateForeignKeys: { type: 'boolean', description: 'Validate foreign key constraints (default: false)' }
              }
            }
          },
          required: ['table', 'updates']
        },
        requiredPermissions: ['update']
      },
      {
        name: 'sqlite_bulk_delete',
        description: 'Delete multiple sets of rows efficiently in batches with optional cascade support. Each condition set identifies rows to delete. Use this for mass deletion operations with progress tracking. Returns detailed progress with success/failure counts.',
        inputSchema: {
          type: 'object',
          properties: {
            table: {
              type: 'string',
              description: 'Target table name. Example: "logs"'
            },
            conditions: {
              type: 'array',
              description: 'Array of WHERE condition sets. Each set deletes matching rows. Example: [{"user_id": 1}, {"user_id": 2}, {"created_at": "2023-01-01"}]',
              items: { type: 'object' }
            },
            options: {
              type: 'object',
              description: 'Bulk operation options',
              properties: {
                batchSize: { type: 'number', description: 'Number of delete operations per batch (default: 1000)' },
                continueOnError: { type: 'boolean', description: 'If true, continue processing when a delete fails (default: false)' },
                cascadeDelete: { type: 'boolean', description: 'If true, also delete related records in child tables (default: false)' }
              }
            }
          },
          required: ['table', 'conditions']
        },
        requiredPermissions: ['delete']
      },
      {
        name: 'sqlite_ddl',
        description: 'Execute Data Definition Language (DDL) operations to modify database schema. Supports: create_table (with columns, constraints, foreign keys), drop_table, alter_table (add/rename column, rename table), create_index, drop_index. Use sqlite_schema first to understand existing structure.',
        inputSchema: {
          type: 'object',
          properties: {
            operation: {
              type: 'string',
              enum: ['create_table', 'drop_table', 'alter_table', 'create_index', 'drop_index'],
              description: 'DDL operation type: create_table, drop_table, alter_table, create_index, or drop_index'
            },
            table: {
              type: 'string',
              description: 'Table name to operate on. Example: "users"'
            },
            columns: {
              type: 'array',
              description: 'Column definitions for create_table. Required for create_table operation.',
              items: {
                type: 'object',
                properties: {
                  name: { type: 'string', description: 'Column name. Example: "user_id"' },
                  type: { type: 'string', description: 'SQLite data type: TEXT, INTEGER, REAL, BLOB, or NUMERIC' },
                  primaryKey: { type: 'boolean', description: 'Set as PRIMARY KEY (default: false)' },
                  autoIncrement: { type: 'boolean', description: 'Enable AUTOINCREMENT (only valid for INTEGER PRIMARY KEY)' },
                  notNull: { type: 'boolean', description: 'Add NOT NULL constraint (default: false)' },
                  unique: { type: 'boolean', description: 'Add UNIQUE constraint (default: false)' },
                  defaultValue: { type: 'string', description: 'Default value expression. Example: "0" or "CURRENT_TIMESTAMP"' },
                  foreignKey: {
                    type: 'object',
                    description: 'Foreign key reference to another table',
                    properties: {
                      table: { type: 'string', description: 'Referenced table name' },
                      column: { type: 'string', description: 'Referenced column name' },
                      onDelete: { type: 'string', enum: ['CASCADE', 'SET NULL', 'RESTRICT', 'NO ACTION'], description: 'Action on parent delete' },
                      onUpdate: { type: 'string', enum: ['CASCADE', 'SET NULL', 'RESTRICT', 'NO ACTION'], description: 'Action on parent update' }
                    }
                  }
                },
                required: ['name', 'type']
              }
            },
            alterAction: {
              type: 'object',
              description: 'Alter table action configuration. Required for alter_table operation.',
              properties: {
                action: { type: 'string', enum: ['add_column', 'rename_table', 'rename_column'], description: 'Type of alteration' },
                column: { type: 'object', description: 'Column definition for add_column (same format as columns array items)' },
                newName: { type: 'string', description: 'New name for rename_table or rename_column' },
                oldColumnName: { type: 'string', description: 'Current column name for rename_column' }
              }
            },
            index: {
              type: 'object',
              description: 'Index configuration for create_index or drop_index operations.',
              properties: {
                name: { type: 'string', description: 'Index name. Example: "idx_users_email"' },
                columns: { type: 'array', items: { type: 'string' }, description: 'Columns to index. Example: ["email"] or ["last_name", "first_name"]' },
                unique: { type: 'boolean', description: 'Create as UNIQUE index to enforce uniqueness (default: false)' }
              }
            },
            ifNotExists: {
              type: 'boolean',
              description: 'Add IF NOT EXISTS clause to prevent errors if object already exists (default: false)',
              default: false
            },
            ifExists: {
              type: 'boolean',
              description: 'Add IF EXISTS clause for drop operations to prevent errors if object does not exist (default: false)',
              default: false
            }
          },
          required: ['operation', 'table']
        },
        requiredPermissions: ['ddl']
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
  private async handleToolCall(
    toolName: string, 
    args: Record<string, any>, 
    clientId: string
  ): Promise<CallToolResult> {
    // Check permissions - use 'default' client permissions if specific client not found
    let clientPermissions = this.clientPermissions.get(clientId);
    
    if (!clientPermissions) {
      // Fall back to default client permissions
      clientPermissions = this.clientPermissions.get('default') || [];
      this.logger.debug('Using default permissions for unknown client', { clientId });
    }
    
    if (clientPermissions.length === 0) {
      throw new Error(`No permissions configured for client: ${clientId}`);
    }
    
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
      
      case 'sqlite_ddl':
        return this.handleDDL(args, clientId, clientPermissions);
      
      default:
        throw new Error(`Unknown tool: ${toolName}`);
    }
  }

  /**
   * Handle SQL query execution
   */
  private async handleQuery(
    args: Record<string, any>, 
    clientId: string, 
    permissions: PermissionType[]
  ): Promise<CallToolResult> {
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
        } as TextContent
      ]
    };
  }

  /**
   * Handle data insertion
   */
  private async handleInsert(
    args: Record<string, any>, 
    clientId: string, 
    permissions: PermissionType[]
  ): Promise<CallToolResult> {
    const { table, data } = args;

    if (!permissions.includes('create')) {
      throw new Error('Insufficient permissions for insert operation');
    }

    // Validate and escape table name
    const safeTable = safeIdentifier(table, 'table name');
    
    // Validate and escape column names
    const columns = Object.keys(data);
    const safeColumns = columns.map(col => safeIdentifier(col, 'column name'));
    
    // Build INSERT query with safe identifiers
    const placeholders = columns.map(() => '?').join(', ');
    const query = `INSERT INTO ${safeTable} (${safeColumns.join(', ')}) VALUES (${placeholders})`;
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
        } as TextContent
      ]
    };
  }

  /**
   * Handle data update
   */
  private async handleUpdate(
    args: Record<string, any>, 
    clientId: string, 
    permissions: PermissionType[]
  ): Promise<CallToolResult> {
    const { table, data, where } = args;

    if (!permissions.includes('update')) {
      throw new Error('Insufficient permissions for update operation');
    }

    // Validate and escape table name
    const safeTable = safeIdentifier(table, 'table name');
    
    // Validate and escape column names in SET clause
    const setClause = Object.keys(data).map(key => `${safeIdentifier(key, 'column name')} = ?`).join(', ');
    
    // Validate and escape column names in WHERE clause
    const whereClause = Object.keys(where).map(key => `${safeIdentifier(key, 'column name')} = ?`).join(' AND ');
    
    // Build UPDATE query with safe identifiers
    const query = `UPDATE ${safeTable} SET ${setClause} WHERE ${whereClause}`;
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
        } as TextContent
      ]
    };
  }

  /**
   * Handle data deletion
   */
  private async handleDelete(
    args: Record<string, any>, 
    clientId: string, 
    permissions: PermissionType[]
  ): Promise<CallToolResult> {
    const { table, where } = args;

    if (!permissions.includes('delete')) {
      throw new Error('Insufficient permissions for delete operation');
    }

    // Validate and escape table name
    const safeTable = safeIdentifier(table, 'table name');
    
    // Validate and escape column names in WHERE clause
    const whereClause = Object.keys(where).map(key => `${safeIdentifier(key, 'column name')} = ?`).join(' AND ');
    
    // Build DELETE query with safe identifiers
    const query = `DELETE FROM ${safeTable} WHERE ${whereClause}`;
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
        } as TextContent
      ]
    };
  }

  /**
   * Handle schema information request
   */
  private async handleSchema(
    args: Record<string, any>, 
    clientId: string, 
    permissions: PermissionType[]
  ): Promise<CallToolResult> {
    if (!permissions.includes('list')) {
      throw new Error('Insufficient permissions for schema access');
    }

    const { table } = args;
    const schema = this.databaseManager.getSchemaInfo();

    let result: any = schema;

    if (table) {
      // Filter for specific table
      result = {
        tables: schema.tables.filter(t => t.name === table),
        views: schema.views?.filter((v: any) => v.name === table) || [],
        indexes: schema.indexes?.filter((i: any) => i.tableName === table) || [],
        triggers: schema.triggers?.filter((t: any) => t.tableName === table) || []
      };
    }

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result, null, 2)
        } as TextContent
      ]
    };
  }

  /**
   * Handle tables list request
   */
  private async handleTables(
    args: Record<string, any>, 
    clientId: string, 
    permissions: PermissionType[]
  ): Promise<CallToolResult> {
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
        } as TextContent
      ]
    };
  }

  /**
   * Handle transaction execution
   */
  private async handleTransaction(
    args: Record<string, any>, 
    clientId: string, 
    permissions: PermissionType[]
  ): Promise<CallToolResult> {
    const { queries } = args;

    if (!permissions.includes('transaction')) {
      throw new Error('Insufficient permissions for transaction execution');
    }

    // Validate all queries in the transaction
    for (const queryObj of queries) {
      const validation = await this.securityManager.validateQuery(
        queryObj.query, 
        queryObj.parameters || [],
        permissions, 
        clientId
      );
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
        } as TextContent
      ]
    };
  }

  /**
   * Handle database backup
   */
  private async handleBackup(
    args: Record<string, any>, 
    clientId: string, 
    permissions: PermissionType[]
  ): Promise<CallToolResult> {
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
          } as TextContent
        ]
      };
    } catch (error) {
      throw new Error(`Backup failed: ${(error as Error).message}`);
    }
  }

  /**
   * Handle bulk insert operation
   */
  private async handleBulkInsert(
    args: Record<string, any>, 
    clientId: string, 
    permissions: PermissionType[]
  ): Promise<CallToolResult> {
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
          } as TextContent
        ]
      };
    } catch (error) {
      throw new Error(`Bulk insert failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Handle bulk update operation
   */
  private async handleBulkUpdate(
    args: Record<string, any>, 
    clientId: string, 
    permissions: PermissionType[]
  ): Promise<CallToolResult> {
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
          } as TextContent
        ]
      };
    } catch (error) {
      throw new Error(`Bulk update failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Handle bulk delete operation
   */
  private async handleBulkDelete(
    args: Record<string, any>, 
    clientId: string, 
    permissions: PermissionType[]
  ): Promise<CallToolResult> {
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
          } as TextContent
        ]
      };
    } catch (error) {
      throw new Error(`Bulk delete failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Handle DDL (Data Definition Language) operations
   */
  private async handleDDL(
    args: Record<string, any>,
    clientId: string,
    permissions: PermissionType[]
  ): Promise<CallToolResult> {
    const { operation, table, columns, alterAction, index, ifNotExists, ifExists } = args;

    if (!permissions.includes('ddl')) {
      throw new Error('Insufficient permissions for DDL operation');
    }

    // Validate table name
    const safeTable = safeIdentifier(table, 'table name');
    
    let query = '';

    switch (operation) {
      case 'create_table':
        if (!columns || columns.length === 0) {
          throw new Error('Columns are required for create_table operation');
        }
        query = this.buildCreateTableQuery(safeTable, columns, ifNotExists);
        break;

      case 'drop_table':
        query = `DROP TABLE ${ifExists ? 'IF EXISTS ' : ''}${safeTable}`;
        break;

      case 'alter_table':
        if (!alterAction) {
          throw new Error('alterAction is required for alter_table operation');
        }
        query = this.buildAlterTableQuery(safeTable, alterAction);
        break;

      case 'create_index':
        if (!index || !index.name || !index.columns) {
          throw new Error('Index name and columns are required for create_index operation');
        }
        const safeIndexName = safeIdentifier(index.name, 'index name');
        const safeIndexColumns = index.columns.map((col: string) => safeIdentifier(col, 'column name'));
        query = `CREATE ${index.unique ? 'UNIQUE ' : ''}INDEX ${ifNotExists ? 'IF NOT EXISTS ' : ''}${safeIndexName} ON ${safeTable} (${safeIndexColumns.join(', ')})`;
        break;

      case 'drop_index':
        if (!index || !index.name) {
          throw new Error('Index name is required for drop_index operation');
        }
        const safeDropIndexName = safeIdentifier(index.name, 'index name');
        query = `DROP INDEX ${ifExists ? 'IF EXISTS ' : ''}${safeDropIndexName}`;
        break;

      default:
        throw new Error(`Unknown DDL operation: ${operation}`);
    }

    // Validate query
    const validation = await this.securityManager.validateQuery(query, [], permissions, clientId);
    if (!validation.isValid) {
      throw new Error(`DDL validation failed: ${validation.reason}`);
    }

    // Execute DDL
    const result = this.databaseManager.executeQuery(query, [], clientId);

    if (!result.success) {
      throw new Error(result.error || 'DDL operation failed');
    }

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            success: true,
            operation,
            table,
            query,
            executionTime: result.executionTime
          }, null, 2)
        } as TextContent
      ]
    };
  }

  /**
   * Build CREATE TABLE query from column definitions
   * Note: table parameter should already be sanitized by caller
   */
  private buildCreateTableQuery(
    table: string,
    columns: any[],
    ifNotExists: boolean = false
  ): string {
    const columnDefs: string[] = [];
    const foreignKeys: string[] = [];

    for (const col of columns) {
      // Validate column name
      const safeColName = safeIdentifier(col.name, 'column name');
      let colDef = `${safeColName} ${col.type}`;

      if (col.primaryKey) {
        colDef += ' PRIMARY KEY';
        if (col.autoIncrement && col.type.toUpperCase() === 'INTEGER') {
          colDef += ' AUTOINCREMENT';
        }
      }

      if (col.notNull) {
        colDef += ' NOT NULL';
      }

      if (col.unique && !col.primaryKey) {
        colDef += ' UNIQUE';
      }

      if (col.defaultValue !== undefined) {
        colDef += ` DEFAULT ${col.defaultValue}`;
      }

      columnDefs.push(colDef);

      if (col.foreignKey) {
        const fk = col.foreignKey;
        const safeFkTable = safeIdentifier(fk.table, 'foreign key table name');
        const safeFkColumn = safeIdentifier(fk.column, 'foreign key column name');
        let fkDef = `FOREIGN KEY (${safeColName}) REFERENCES ${safeFkTable}(${safeFkColumn})`;
        if (fk.onDelete) {
          fkDef += ` ON DELETE ${fk.onDelete}`;
        }
        if (fk.onUpdate) {
          fkDef += ` ON UPDATE ${fk.onUpdate}`;
        }
        foreignKeys.push(fkDef);
      }
    }

    const allDefs = [...columnDefs, ...foreignKeys];
    return `CREATE TABLE ${ifNotExists ? 'IF NOT EXISTS ' : ''}${table} (${allDefs.join(', ')})`;
  }

  /**
   * Build ALTER TABLE query from action
   * Note: table parameter should already be sanitized by caller
   */
  private buildAlterTableQuery(table: string, alterAction: any): string {
    switch (alterAction.action) {
      case 'add_column':
        if (!alterAction.column) {
          throw new Error('Column definition is required for add_column action');
        }
        const col = alterAction.column;
        const safeColName = safeIdentifier(col.name, 'column name');
        let colDef = `${safeColName} ${col.type}`;
        if (col.notNull) colDef += ' NOT NULL';
        if (col.defaultValue !== undefined) colDef += ` DEFAULT ${col.defaultValue}`;
        return `ALTER TABLE ${table} ADD COLUMN ${colDef}`;

      case 'rename_table':
        if (!alterAction.newName) {
          throw new Error('newName is required for rename_table action');
        }
        const safeNewTableName = safeIdentifier(alterAction.newName, 'new table name');
        return `ALTER TABLE ${table} RENAME TO ${safeNewTableName}`;

      case 'rename_column':
        if (!alterAction.oldColumnName || !alterAction.newName) {
          throw new Error('oldColumnName and newName are required for rename_column action');
        }
        const safeOldColName = safeIdentifier(alterAction.oldColumnName, 'old column name');
        const safeNewColName = safeIdentifier(alterAction.newName, 'new column name');
        return `ALTER TABLE ${table} RENAME COLUMN ${safeOldColName} TO ${safeNewColName}`;

      default:
        throw new Error(`Unknown alter action: ${alterAction.action}`);
    }
  }

  /**
   * Set client permissions
   */
  public setClientPermissions(clientId: string, permissions: PermissionType[]): void {
    this.clientPermissions.set(clientId, permissions);
    this.logger.info('Client permissions updated', { clientId, permissions });
  }

  /**
   * Start the MCP server
   */
  public async start(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    
    this.logger.info('MCP SQLite server started');
  }

  /**
   * Stop the MCP server
   */
  public async stop(): Promise<void> {
    await this.server.close();
    this.databaseManager.close();
    
    this.logger.info('MCP SQLite server stopped');
  }
}

export default MCPSQLiteServer;