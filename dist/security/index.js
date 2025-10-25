"use strict";
/**
 * Security system for SQLite MCP Server
 * Provides SQL injection prevention, query validation, and permission checking
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
exports.SecurityManager = void 0;
const crypto = __importStar(require("crypto"));
class SecurityManager {
    constructor(logger) {
        this.auditLogs = [];
        // SQL injection patterns to detect and block
        this.dangerousPatterns = [
            /(\b(union|select|insert|update|delete|drop|create|alter|exec|execute|sp_|xp_)\b.*\b(from|into|where|set|values|table|database|schema)\b)/gi,
            /(;|\|\||&&|\/\*|\*\/|--|\#)/g,
            /(\b(script|javascript|vbscript|onload|onerror|onclick)\b)/gi,
            /(\b(eval|exec|system|shell|cmd)\b)/gi,
            /((\%27)|(\')|(\\x27)|(\\u0027))/gi,
            /((\%22)|(\")|(\\x22)|(\\u0022))/gi,
            /(\b(or|and)\b\s*(\d+\s*=\s*\d+|\'\w*\'\s*=\s*\'\w*\'))/gi
        ];
        // SQL keywords that require specific permissions
        this.permissionKeywords = {
            'SELECT': ['read', 'list'],
            'INSERT': ['create'],
            'UPDATE': ['update'],
            'DELETE': ['delete'],
            'CREATE': ['ddl'],
            'ALTER': ['ddl'],
            'DROP': ['ddl'],
            'TRUNCATE': ['ddl'],
            'BEGIN': ['transaction'],
            'COMMIT': ['transaction'],
            'ROLLBACK': ['transaction'],
            'SAVEPOINT': ['transaction'],
            'VACUUM': ['utility'],
            'ANALYZE': ['utility'],
            'REINDEX': ['utility'],
            'PRAGMA': ['utility'],
            'ATTACH': ['utility'],
            'DETACH': ['utility']
        };
        /**
         * Rate limiting check (simple in-memory implementation)
         */
        this.rateLimitMap = new Map();
        this.logger = logger;
    }
    static getInstance(logger) {
        if (!SecurityManager.instance) {
            SecurityManager.instance = new SecurityManager(logger);
        }
        return SecurityManager.instance;
    }
    /**
     * Validates and sanitizes SQL query
     */
    validateQuery(query, parameters = [], clientPermissions, clientId) {
        const result = {
            isValid: false,
            errors: [],
            detectedOperations: [],
            requiredPermissions: []
        };
        try {
            // Basic validation
            if (!query || typeof query !== 'string') {
                result.errors.push('Query must be a non-empty string');
                return result;
            }
            if (query.length > 10000) {
                result.errors.push('Query exceeds maximum length limit');
                return result;
            }
            // Normalize query for analysis
            const normalizedQuery = query.trim().toUpperCase();
            // Check for dangerous patterns
            for (const pattern of this.dangerousPatterns) {
                if (pattern.test(query)) {
                    result.errors.push(`Potentially dangerous SQL pattern detected: ${pattern.source}`);
                    this.logger.warn('Dangerous SQL pattern detected', {
                        query: this.hashQuery(query),
                        pattern: pattern.source
                    });
                }
            }
            // Detect SQL operations and required permissions
            const detectedOps = this.detectSQLOperations(normalizedQuery);
            result.detectedOperations = detectedOps;
            // Determine required permissions
            const requiredPerms = this.getRequiredPermissions(detectedOps);
            result.requiredPermissions = requiredPerms;
            // Check if client has required permissions
            const hasPermissions = this.checkPermissions(clientPermissions, requiredPerms);
            if (!hasPermissions) {
                result.errors.push(`Insufficient permissions. Required: ${requiredPerms.join(', ')}, Available: ${clientPermissions.join(', ')}`);
            }
            // Validate parameters
            if (parameters && !Array.isArray(parameters)) {
                result.errors.push('Parameters must be an array');
            }
            // Additional security checks
            if (this.containsMultipleStatements(query)) {
                result.errors.push('Multiple statements not allowed');
            }
            if (this.containsSubqueries(query) && !clientPermissions.includes('read')) {
                result.errors.push('Subqueries require read permission');
            }
            // If no errors, mark as valid
            if (result.errors.length === 0) {
                result.isValid = true;
                result.sanitizedQuery = this.sanitizeQuery(query);
                result.parameters = this.sanitizeParameters(parameters);
            }
            else {
                result.reason = result.errors.join('; ');
            }
            return result;
        }
        catch (error) {
            result.errors.push(`Query validation error: ${error}`);
            this.logger.error('Query validation failed', { error, query: this.hashQuery(query) });
            return result;
        }
    }
    /**
     * Detects SQL operations in the query
     */
    detectSQLOperations(normalizedQuery) {
        const operations = [];
        for (const [keyword] of Object.entries(this.permissionKeywords)) {
            if (normalizedQuery.includes(keyword)) {
                operations.push(keyword);
            }
        }
        return operations;
    }
    /**
     * Gets required permissions for detected operations
     */
    getRequiredPermissions(operations) {
        const permissions = new Set();
        for (const op of operations) {
            const perms = this.permissionKeywords[op] || [];
            perms.forEach(p => permissions.add(p));
        }
        return Array.from(permissions);
    }
    /**
     * Checks if client has required permissions
     */
    checkPermissions(clientPermissions, requiredPermissions) {
        return requiredPermissions.every(required => clientPermissions.includes(required));
    }
    /**
     * Sanitizes SQL query by removing comments and normalizing whitespace
     */
    sanitizeQuery(query) {
        return query
            .replace(/--.*$/gm, '') // Remove line comments
            .replace(/\/\*[\s\S]*?\*\//g, '') // Remove block comments
            .replace(/\s+/g, ' ') // Normalize whitespace
            .trim();
    }
    /**
     * Sanitizes query parameters
     */
    sanitizeParameters(parameters) {
        if (!parameters)
            return [];
        return parameters.map(param => {
            if (typeof param === 'string') {
                // Remove potentially dangerous characters
                return param.replace(/[<>'"&]/g, '');
            }
            return param;
        });
    }
    /**
     * Checks if query contains multiple statements
     */
    containsMultipleStatements(query) {
        // Simple check for semicolons outside of string literals
        const withoutStrings = query.replace(/'[^']*'/g, '').replace(/"[^"]*"/g, '');
        return (withoutStrings.match(/;/g) || []).length > 1;
    }
    /**
     * Checks if query contains subqueries
     */
    containsSubqueries(query) {
        const normalizedQuery = query.toUpperCase();
        return normalizedQuery.includes('SELECT') &&
            (normalizedQuery.includes('(') && normalizedQuery.includes(')'));
    }
    /**
     * Creates a hash of the query for logging purposes
     */
    hashQuery(query) {
        return crypto.createHash('sha256').update(query).digest('hex').substring(0, 16);
    }
    /**
     * Logs audit entry
     */
    logAudit(entry) {
        const auditEntry = {
            ...entry,
            logId: crypto.randomUUID(),
            executedAt: new Date()
        };
        this.auditLogs.push(auditEntry);
        // Keep only last 10000 entries to prevent memory issues
        if (this.auditLogs.length > 10000) {
            this.auditLogs = this.auditLogs.slice(-5000);
        }
        this.logger.info('Audit log entry', auditEntry);
    }
    /**
     * Gets audit logs for a specific client
     */
    getAuditLogs(clientId, limit = 100) {
        let logs = this.auditLogs;
        if (clientId) {
            logs = logs.filter(log => log.clientId === clientId);
        }
        return logs
            .sort((a, b) => b.executedAt.getTime() - a.executedAt.getTime())
            .slice(0, limit);
    }
    /**
     * Validates client permissions against operation
     */
    hasPermission(clientPermissions, requiredPermission) {
        return clientPermissions.includes(requiredPermission);
    }
    checkRateLimit(clientId, maxRequestsPerMinute = 100) {
        const now = Date.now();
        const windowStart = now - 60000; // 1 minute window
        const clientData = this.rateLimitMap.get(clientId);
        if (!clientData || clientData.resetTime < windowStart) {
            this.rateLimitMap.set(clientId, { count: 1, resetTime: now });
            return true;
        }
        if (clientData.count >= maxRequestsPerMinute) {
            return false;
        }
        clientData.count++;
        return true;
    }
    /**
     * Cleans up old rate limit data
     */
    cleanupRateLimitData() {
        const now = Date.now();
        const cutoff = now - 120000; // 2 minutes ago
        for (const [clientId, data] of this.rateLimitMap.entries()) {
            if (data.resetTime < cutoff) {
                this.rateLimitMap.delete(clientId);
            }
        }
    }
}
exports.SecurityManager = SecurityManager;
exports.default = SecurityManager;
//# sourceMappingURL=index.js.map