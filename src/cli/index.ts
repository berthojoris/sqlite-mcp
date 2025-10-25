#!/usr/bin/env node

/**
 * Command Line Interface for SQLite MCP Server
 * Supports the exact configuration format: npx @berthojoris/mcp-sqlite-server sqlite:////path/to/mydb.sqlite list,read,utility
 */

import { Command } from 'commander';
import * as path from 'path';
import * as fs from 'fs';
import { createLogger, format, transports } from 'winston';
import { ConfigManager } from '../config';
import { DatabaseManager } from '../database';
import { SecurityManager } from '../security';
import { MCPSQLiteServer } from '../core/mcp-server';
import { PermissionType, DatabaseConfig, ServerConfig } from '../types';

class SQLiteMCPCLI {
  private logger = createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: format.combine(
      format.timestamp(),
      format.errors({ stack: true }),
      format.json()
    ),
    transports: [
      new transports.Console({
        format: format.combine(
          format.colorize(),
          format.simple()
        )
      })
    ]
  });

  private program = new Command();

  constructor() {
    this.setupCommands();
  }

  /**
   * Set up CLI commands
   */
  private setupCommands(): void {
    this.program
      .name('mcp-sqlite-server')
      .description('SQLite MCP Server - Model Context Protocol implementation for SQLite')
      .version('1.0.0');

    // Main command for MCP server
    this.program
      .argument('<connection-string>', 'SQLite connection string (e.g., sqlite:////path/to/db.sqlite)')
      .argument('[permissions]', 'Comma-separated permissions (e.g., list,read,utility)', 'read')
      .option('-c, --config <path>', 'Configuration file path')
      .option('-l, --log-level <level>', 'Log level (debug, info, warn, error)', 'info')
      .option('-p, --port <port>', 'Port for HTTP interface (optional)')
      .option('--read-only', 'Open database in read-only mode')
      .option('--backup-dir <path>', 'Directory for automatic backups')
      .option('--max-connections <number>', 'Maximum database connections', '10')
      .action(async (connectionString, permissions, options) => {
        try {
          await this.startServer(connectionString, permissions, options);
        } catch (error) {
          this.logger.error('Failed to start server', { error: (error as Error).message });
          process.exit(1);
        }
      });

    // Schema command
    this.program
      .command('schema')
      .description('Display database schema information')
      .argument('<connection-string>', 'SQLite connection string')
      .option('-t, --table <name>', 'Show schema for specific table')
      .option('-f, --format <format>', 'Output format (json, table)', 'table')
      .action(async (connectionString, options) => {
        try {
          await this.showSchema(connectionString, options);
        } catch (error) {
          this.logger.error('Failed to show schema', { error: (error as Error).message });
          process.exit(1);
        }
      });

    // Backup command
    this.program
      .command('backup')
      .description('Create database backup')
      .argument('<connection-string>', 'SQLite connection string')
      .argument('<backup-path>', 'Backup file path')
      .action(async (connectionString, backupPath) => {
        try {
          await this.createBackup(connectionString, backupPath);
        } catch (error) {
          this.logger.error('Failed to create backup', { error: (error as Error).message });
          process.exit(1);
        }
      });

    // Config command
    this.program
      .command('config')
      .description('Generate configuration file')
      .option('-o, --output <path>', 'Output file path', './mcp-sqlite-config.json')
      .option('--template', 'Generate template configuration')
      .action(async (options) => {
        try {
          await this.generateConfig(options);
        } catch (error) {
          this.logger.error('Failed to generate config', { error: (error as Error).message });
          process.exit(1);
        }
      });
  }

  /**
   * Parse SQLite connection string
   */
  private parseConnectionString(connectionString: string): { path: string; options: any } {
    // Support formats:
    // sqlite:////absolute/path/to/db.sqlite
    // sqlite://./relative/path/to/db.sqlite
    // sqlite://:memory:
    // /path/to/db.sqlite (direct path)
    // c:/path/to/db.sqlite (Windows path)

    let dbPath: string;
    const options: any = {};

    if (connectionString.startsWith('sqlite://')) {
      // Remove sqlite:// prefix
      dbPath = connectionString.replace('sqlite://', '');
      
      // Handle special cases
      if (dbPath === ':memory:') {
        dbPath = ':memory:';
      } else if (dbPath.startsWith('/')) {
        // Unix absolute path (remove extra slash if present)
        dbPath = dbPath.replace(/^\/+/, '/');
        // On Windows, handle paths like /c:/path/to/file
        if (process.platform === 'win32' && dbPath.match(/^\/[a-zA-Z]:/)) {
          dbPath = dbPath.substring(1); // Remove leading slash for Windows drive paths
        }
      } else {
        // Relative path or Windows drive path
        dbPath = path.resolve(dbPath);
      }
    } else {
      // Direct path
      dbPath = path.resolve(connectionString);
    }

    return { path: dbPath, options };
  }

  /**
   * Parse permissions string
   */
  private parsePermissions(permissionsString: string): PermissionType[] {
    const validPermissions: PermissionType[] = [
      'list', 'read', 'create', 'update', 'delete', 
      'execute', 'ddl', 'transaction', 'utility'
    ];

    const permissions = permissionsString
      .split(',')
      .map(p => p.trim().toLowerCase() as PermissionType)
      .filter(p => validPermissions.includes(p));

    if (permissions.length === 0) {
      throw new Error(`No valid permissions found in: ${permissionsString}`);
    }

    return permissions;
  }

  /**
   * Start the MCP server
   */
  private async startServer(
    connectionString: string, 
    permissionsString: string, 
    options: any
  ): Promise<void> {
    this.logger.info('Starting SQLite MCP Server', { 
      connectionString: connectionString.replace(/\/[^\/]*\.sqlite/, '/*****.sqlite'), // Hide path details
      permissions: permissionsString 
    });

    // Parse connection string and permissions
    const { path: dbPath } = this.parseConnectionString(connectionString);
    const permissions = this.parsePermissions(permissionsString);

    // Auto-create database directory and file if they don't exist
    if (dbPath !== ':memory:') {
      const dbDir = path.dirname(dbPath);
      
      // Create directory if it doesn't exist
      if (!fs.existsSync(dbDir)) {
        this.logger.info('Creating database directory', { directory: dbDir });
        fs.mkdirSync(dbDir, { recursive: true });
      }
      
      // Check if database file exists, if not it will be auto-created by SQLite
      if (!fs.existsSync(dbPath)) {
        this.logger.info('Database file will be auto-created', { path: dbPath });
      } else {
        this.logger.info('Using existing database file', { path: dbPath });
      }
    }

    // Create configuration
    const databaseConfig: DatabaseConfig = {
      path: dbPath,
      readOnly: options.readOnly || false,
      enableWAL: !options.readOnly,
      maxConnections: parseInt(options.maxConnections) || 10,
      timeout: 30000,
      busyTimeout: 5000
    };

    const serverConfig: ServerConfig = {
      database: databaseConfig,
      security: {
        enableAuditLogging: true,
        maxQueryLength: 10000,
        allowedOperations: permissions,
        rateLimitRequests: 100,
        rateLimitWindow: 60000
      },
      logging: {
        level: options.logLevel || 'info',
        enableConsole: true,
        enableFile: false
      }
    };

    // Initialize components
    const configManager = new ConfigManager();
    configManager.updateConfig(serverConfig);

    const securityManager = new SecurityManager(this.logger);
    const databaseManager = DatabaseManager.getInstance(databaseConfig, this.logger);
    
    await databaseManager.initialize();

    const mcpServer = new MCPSQLiteServer(
      databaseManager,
      securityManager,
      configManager,
      this.logger
    );

    // Set default client permissions
    mcpServer.setClientPermissions('default', permissions);

    // Handle graceful shutdown
    const shutdown = async () => {
      this.logger.info('Shutting down server...');
      try {
        await mcpServer.stop();
        process.exit(0);
      } catch (error) {
        this.logger.error('Error during shutdown', { error: (error as Error).message });
        process.exit(1);
      }
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);

    // Start server
    await mcpServer.start();
    
    this.logger.info('SQLite MCP Server is running', {
      database: dbPath === ':memory:' ? ':memory:' : path.basename(dbPath),
      permissions,
      readOnly: databaseConfig.readOnly
    });

    // Keep the process alive
    process.stdin.resume();
  }

  /**
   * Show database schema
   */
  private async showSchema(connectionString: string, options: any): Promise<void> {
    const { path: dbPath } = this.parseConnectionString(connectionString);
    
    if (!fs.existsSync(dbPath) && dbPath !== ':memory:') {
      throw new Error(`Database file does not exist: ${dbPath}`);
    }

    const databaseConfig: DatabaseConfig = {
      path: dbPath,
      readOnly: true,
      maxConnections: 1
    };

    const configManager = new ConfigManager();
    const databaseManager = DatabaseManager.getInstance(databaseConfig, this.logger);
    
    await databaseManager.initialize();

    try {
      const schema = databaseManager.getSchemaInfo();
      
      if (options.format === 'json') {
        console.log(JSON.stringify(schema, null, 2));
      } else {
        // Table format
        console.log('\n📊 Database Schema\n');
        
        if (options.table) {
          const table = schema.tables.find(t => t.name === options.table);
          if (!table) {
            console.log(`❌ Table '${options.table}' not found`);
            return;
          }
          this.displayTableInfo(table);
        } else {
          console.log(`📋 Tables (${schema.tables.length}):`);
          schema.tables.forEach(table => {
            console.log(`  • ${table.name} (${table.columns.length} columns)`);
          });

          if (schema.views && schema.views.length > 0) {
            console.log(`\n👁️  Views (${schema.views.length}):`);
            schema.views.forEach((view: any) => {
              console.log(`  • ${view.name}`);
            });
          }

          if (schema.indexes && schema.indexes.length > 0) {
            console.log(`\n🔍 Indexes (${schema.indexes.length}):`);
            schema.indexes.forEach((index: any) => {
              console.log(`  • ${index.name} on ${index.tableName}`);
            });
          }
        }
      }
    } finally {
      databaseManager.close();
    }
  }

  /**
   * Display detailed table information
   */
  private displayTableInfo(table: any): void {
    console.log(`\n📋 Table: ${table.name}`);
    console.log('─'.repeat(50));
    
    console.log('\n📄 Columns:');
    table.columns.forEach((col: any) => {
      const flags = [];
      if (col.primaryKey) flags.push('PK');
      if (!col.nullable) flags.push('NOT NULL');
      if (col.autoIncrement) flags.push('AUTO_INCREMENT');
      
      const flagsStr = flags.length > 0 ? ` [${flags.join(', ')}]` : '';
      const defaultStr = col.defaultValue ? ` (default: ${col.defaultValue})` : '';
      
      console.log(`  • ${col.name}: ${col.type}${flagsStr}${defaultStr}`);
    });

    if (table.foreignKeys && table.foreignKeys.length > 0) {
      console.log('\n🔗 Foreign Keys:');
      table.foreignKeys.forEach((fk: any) => {
        console.log(`  • ${fk.from} → ${fk.table}.${fk.to}`);
      });
    }

    if (table.indexes && table.indexes.length > 0) {
      console.log('\n🔍 Indexes:');
      table.indexes.forEach((index: string) => {
        console.log(`  • ${index}`);
      });
    }
  }

  /**
   * Create database backup
   */
  private async createBackup(connectionString: string, backupPath: string): Promise<void> {
    const { path: dbPath } = this.parseConnectionString(connectionString);
    
    if (!fs.existsSync(dbPath) && dbPath !== ':memory:') {
      throw new Error(`Database file does not exist: ${dbPath}`);
    }

    if (dbPath === ':memory:') {
      throw new Error('Cannot backup in-memory database');
    }

    const databaseConfig: DatabaseConfig = {
      path: dbPath,
      readOnly: true,
      maxConnections: 1
    };

    const configManager = new ConfigManager();
    const databaseManager = DatabaseManager.getInstance(databaseConfig, this.logger);
    
    await databaseManager.initialize();

    try {
      await databaseManager.backupDatabase(backupPath);
      console.log(`✅ Database backed up to: ${backupPath}`);
    } finally {
      databaseManager.close();
    }
  }

  /**
   * Generate configuration file
   */
  private async generateConfig(options: any): Promise<void> {
    const config: any = {
      mcpServers: {
        sqlite: {
          command: "npx",
          args: [
            "-y",
            "@berthojoris/mcp-sqlite-server",
            "sqlite:////path/to/your/database.sqlite",
            "list,read,utility"
          ]
        }
      }
    };

    if (options.template) {
      // Generate a more comprehensive template
      config.mcpServers["sqlite-readonly"] = {
        command: "npx",
        args: [
          "-y",
          "@berthojoris/mcp-sqlite-server",
          "sqlite:////path/to/readonly.sqlite",
          "list,read"
        ]
      };
      
      config.mcpServers["sqlite-full"] = {
        command: "npx",
        args: [
          "-y",
          "@berthojoris/mcp-sqlite-server",
          "sqlite:////path/to/full-access.sqlite",
          "list,read,create,update,delete,execute,ddl,transaction,utility"
        ]
      };
    }

    fs.writeFileSync(options.output, JSON.stringify(config, null, 2));
    console.log(`✅ Configuration file generated: ${options.output}`);
    
    console.log('\n📝 Usage:');
    console.log('1. Update the database paths in the configuration file');
    console.log('2. Adjust permissions as needed');
    console.log('3. Add the configuration to your MCP client settings');
  }

  /**
   * Run the CLI
   */
  public run(): void {
    this.program.parse();
  }
}

// Run CLI if this file is executed directly
if (require.main === module) {
  const cli = new SQLiteMCPCLI();
  cli.run();
}

export default SQLiteMCPCLI;