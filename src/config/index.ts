/**
 * Configuration management for SQLite MCP Server
 */

import { DatabaseConfig, ServerConfig, PermissionType } from '../types';
import * as path from 'path';
import * as fs from 'fs';

export class ConfigManager {
  private static instance: ConfigManager;
  private config: ServerConfig;

  constructor() {
    this.config = this.getDefaultConfig();
  }

  public static getInstance(): ConfigManager {
    if (!ConfigManager.instance) {
      ConfigManager.instance = new ConfigManager();
    }
    return ConfigManager.instance;
  }

  private getDefaultConfig(): ServerConfig {
    return {
      database: {
        path: ':memory:',
        maxConnections: 10,
        timeout: 30000,
        readOnly: false,
        enableWAL: true,
        busyTimeout: 5000
      },
      security: {
        enableAuditLogging: true,
        maxQueryLength: 10000,
        queryTimeout: 30000,
        rateLimitPerMinute: 100
      },
      logging: {
        level: 'info',
        console: true
      }
    };
  }

  public parseConnectionString(connectionString: string): DatabaseConfig {
    // Parse SQLite connection string format: sqlite:///path/to/database.db
    const match = connectionString.match(/^sqlite:\/\/\/(.+)$/);
    if (!match) {
      throw new Error(`Invalid SQLite connection string: ${connectionString}`);
    }

    const dbPath = match[1];
    
    // Validate path
    if (dbPath !== ':memory:') {
      const resolvedPath = path.resolve(dbPath);
      const dir = path.dirname(resolvedPath);
      
      // Create directory if it doesn't exist
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    }

    return {
      path: dbPath,
      maxConnections: this.config.database.maxConnections,
      timeout: this.config.database.timeout,
      readOnly: this.config.database.readOnly,
      enableWAL: this.config.database.enableWAL,
      busyTimeout: this.config.database.busyTimeout
    };
  }

  public parsePermissions(permissionString: string): PermissionType[] {
    const validPermissions: PermissionType[] = [
      'list', 'read', 'create', 'update', 'delete', 
      'execute', 'ddl', 'transaction', 'utility'
    ];

    const permissions = permissionString
      .split(',')
      .map(p => p.trim() as PermissionType)
      .filter(p => validPermissions.includes(p));

    if (permissions.length === 0) {
      throw new Error(`No valid permissions found in: ${permissionString}`);
    }

    return permissions;
  }

  public validateDatabasePath(dbPath: string): boolean {
    if (dbPath === ':memory:') {
      return true;
    }

    try {
      const resolvedPath = path.resolve(dbPath);
      const dir = path.dirname(resolvedPath);
      
      // Check if directory exists or can be created
      if (!fs.existsSync(dir)) {
        try {
          fs.mkdirSync(dir, { recursive: true });
          return true;
        } catch (error) {
          return false;
        }
      }

      // Check if file exists and is readable/writable
      if (fs.existsSync(resolvedPath)) {
        try {
          fs.accessSync(resolvedPath, fs.constants.R_OK | fs.constants.W_OK);
          return true;
        } catch (error) {
          return false;
        }
      }

      return true;
    } catch (error) {
      return false;
    }
  }

  public getConfig(): ServerConfig {
    return { ...this.config };
  }

  public updateConfig(newConfig: Partial<ServerConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  public updateDatabaseConfig(dbConfig: Partial<DatabaseConfig>): void {
    this.config.database = { ...this.config.database, ...dbConfig };
  }

  public updateSecurityConfig(securityConfig: Partial<ServerConfig['security']>): void {
    this.config.security = { ...this.config.security, ...securityConfig };
  }

  public updateLoggingConfig(loggingConfig: Partial<ServerConfig['logging']>): void {
    this.config.logging = { ...this.config.logging, ...loggingConfig };
  }

  public loadFromFile(configPath: string): void {
    try {
      if (fs.existsSync(configPath)) {
        const fileContent = fs.readFileSync(configPath, 'utf-8');
        const loadedConfig = JSON.parse(fileContent);
        this.config = { ...this.config, ...loadedConfig };
      }
    } catch (error) {
      throw new Error(`Failed to load configuration from ${configPath}: ${error}`);
    }
  }

  public saveToFile(configPath: string): void {
    try {
      const dir = path.dirname(configPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(configPath, JSON.stringify(this.config, null, 2));
    } catch (error) {
      throw new Error(`Failed to save configuration to ${configPath}: ${error}`);
    }
  }
}

export default ConfigManager;