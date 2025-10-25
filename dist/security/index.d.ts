/**
 * Security system for SQLite MCP Server
 * Provides SQL injection prevention, query validation, and permission checking
 */
import { PermissionType, QueryValidationResult, AuditLogEntry } from '../types';
import { Logger } from 'winston';
export declare class SecurityManager {
    private static instance;
    private logger;
    private auditLogs;
    private readonly dangerousPatterns;
    private readonly permissionKeywords;
    constructor(logger: Logger);
    static getInstance(logger: Logger): SecurityManager;
    /**
     * Validates and sanitizes SQL query
     */
    validateQuery(query: string, parameters: any[] | undefined, clientPermissions: PermissionType[], clientId?: string): QueryValidationResult;
    /**
     * Detects SQL operations in the query
     */
    private detectSQLOperations;
    /**
     * Gets required permissions for detected operations
     */
    private getRequiredPermissions;
    /**
     * Checks if client has required permissions
     */
    private checkPermissions;
    /**
     * Sanitizes SQL query by removing comments and normalizing whitespace
     */
    private sanitizeQuery;
    /**
     * Sanitizes query parameters
     */
    private sanitizeParameters;
    /**
     * Checks if query contains multiple statements
     */
    private containsMultipleStatements;
    /**
     * Checks if query contains subqueries
     */
    private containsSubqueries;
    /**
     * Creates a hash of the query for logging purposes
     */
    hashQuery(query: string): string;
    /**
     * Logs audit entry
     */
    logAudit(entry: Omit<AuditLogEntry, 'logId' | 'executedAt'>): void;
    /**
     * Gets audit logs for a specific client
     */
    getAuditLogs(clientId?: string, limit?: number): AuditLogEntry[];
    /**
     * Validates client permissions against operation
     */
    hasPermission(clientPermissions: PermissionType[], requiredPermission: PermissionType): boolean;
    /**
     * Rate limiting check (simple in-memory implementation)
     */
    private rateLimitMap;
    checkRateLimit(clientId: string, maxRequestsPerMinute?: number): boolean;
    /**
     * Cleans up old rate limit data
     */
    cleanupRateLimitData(): void;
}
export default SecurityManager;
//# sourceMappingURL=index.d.ts.map