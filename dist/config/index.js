"use strict";
/**
 * Configuration management for SQLite MCP Server
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConfigManager = void 0;
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
class ConfigManager {
    constructor() {
        this.config = this.getDefaultConfig();
    }
    static getInstance() {
        if (!ConfigManager.instance) {
            ConfigManager.instance = new ConfigManager();
        }
        return ConfigManager.instance;
    }
    getDefaultConfig() {
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
    parseConnectionString(connectionString) {
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
    parsePermissions(permissionString) {
        const validPermissions = [
            'list', 'read', 'create', 'update', 'delete',
            'execute', 'ddl', 'transaction', 'utility'
        ];
        const permissions = permissionString
            .split(',')
            .map(p => p.trim())
            .filter(p => validPermissions.includes(p));
        if (permissions.length === 0) {
            throw new Error(`No valid permissions found in: ${permissionString}`);
        }
        return permissions;
    }
    validateDatabasePath(dbPath) {
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
                }
                catch (error) {
                    return false;
                }
            }
            // Check if file exists and is readable/writable
            if (fs.existsSync(resolvedPath)) {
                try {
                    fs.accessSync(resolvedPath, fs.constants.R_OK | fs.constants.W_OK);
                    return true;
                }
                catch (error) {
                    return false;
                }
            }
            return true;
        }
        catch (error) {
            return false;
        }
    }
    getConfig() {
        return { ...this.config };
    }
    updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
    }
    updateDatabaseConfig(dbConfig) {
        this.config.database = { ...this.config.database, ...dbConfig };
    }
    updateSecurityConfig(securityConfig) {
        this.config.security = { ...this.config.security, ...securityConfig };
    }
    updateLoggingConfig(loggingConfig) {
        this.config.logging = { ...this.config.logging, ...loggingConfig };
    }
    loadFromFile(configPath) {
        try {
            if (fs.existsSync(configPath)) {
                const fileContent = fs.readFileSync(configPath, 'utf-8');
                const loadedConfig = JSON.parse(fileContent);
                this.config = { ...this.config, ...loadedConfig };
            }
        }
        catch (error) {
            throw new Error(`Failed to load configuration from ${configPath}: ${error}`);
        }
    }
    saveToFile(configPath) {
        try {
            const dir = path.dirname(configPath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            fs.writeFileSync(configPath, JSON.stringify(this.config, null, 2));
        }
        catch (error) {
            throw new Error(`Failed to save configuration to ${configPath}: ${error}`);
        }
    }
}
exports.ConfigManager = ConfigManager;
exports.default = ConfigManager;
//# sourceMappingURL=index.js.map