/**
 * Configuration management for SQLite MCP Server
 */
import { DatabaseConfig, ServerConfig, PermissionType } from '../types';
export declare class ConfigManager {
    private static instance;
    private config;
    constructor();
    static getInstance(): ConfigManager;
    private getDefaultConfig;
    parseConnectionString(connectionString: string): DatabaseConfig;
    parsePermissions(permissionString: string): PermissionType[];
    validateDatabasePath(dbPath: string): boolean;
    getConfig(): ServerConfig;
    updateConfig(newConfig: Partial<ServerConfig>): void;
    updateDatabaseConfig(dbConfig: Partial<DatabaseConfig>): void;
    updateSecurityConfig(securityConfig: Partial<ServerConfig['security']>): void;
    updateLoggingConfig(loggingConfig: Partial<ServerConfig['logging']>): void;
    loadFromFile(configPath: string): void;
    saveToFile(configPath: string): void;
}
export default ConfigManager;
//# sourceMappingURL=index.d.ts.map