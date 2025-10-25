/**
 * Security system for SQLite MCP Server
 * Provides SQL injection prevention, query validation, and permission checking
 */

import { PermissionType, QueryValidationResult, AuditLogEntry } from '../types';
import * as crypto from 'crypto';
import { Logger } from 'winston';

export class SecurityManager {
  private static instance: SecurityManager;
  private logger: Logger;
  private auditLogs: AuditLogEntry[] = [];

  // SQL injection patterns to detect and block
  private readonly dangerousPatterns = [
    /(\b(union|select|insert|update|delete|drop|create|alter|exec|execute|sp_|xp_)\b.*\b(from|into|where|set|values|table|database|schema)\b)/gi,
    /(;|\|\||&&|\/\*|\*\/|--|\#)/g,
    /(\b(script|javascript|vbscript|onload|onerror|onclick)\b)/gi,
    /(\b(eval|exec|system|shell|cmd)\b)/gi,
    /((\%27)|(\')|(\\x27)|(\\u0027))/gi,
    /((\%22)|(\")|(\\x22)|(\\u0022))/gi,
    /(\b(or|and)\b\s*(\d+\s*=\s*\d+|\'\w*\'\s*=\s*\'\w*\'))/gi
  ];

  // SQL keywords that require specific permissions
  private readonly permissionKeywords: Record<string, PermissionType[]> = {
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

  constructor(logger: Logger) {
    this.logger = logger;
  }

  public static getInstance(logger: Logger): SecurityManager {
    if (!SecurityManager.instance) {
      SecurityManager.instance = new SecurityManager(logger);
    }
    return SecurityManager.instance;
  }

  /**
   * Validates and sanitizes SQL query
   */
  public validateQuery(
    query: string, 
    parameters: any[] = [], 
    clientPermissions: PermissionType[],
    clientId?: string
  ): QueryValidationResult {
    const result: QueryValidationResult = {
      isValid: false,
      errors: [],
      detectedOperations: [],
      requiredPermissions: []
    };

    try {
      // Basic validation
      if (!query || typeof query !== 'string') {
        result.errors!.push('Query must be a non-empty string');
        return result;
      }

      if (query.length > 10000) {
        result.errors!.push('Query exceeds maximum length limit');
        return result;
      }

      // Normalize query for analysis
      const normalizedQuery = query.trim().toUpperCase();

      // Check for dangerous patterns
      for (const pattern of this.dangerousPatterns) {
        if (pattern.test(query)) {
          result.errors!.push(`Potentially dangerous SQL pattern detected: ${pattern.source}`);
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
        result.errors!.push(`Insufficient permissions. Required: ${requiredPerms.join(', ')}, Available: ${clientPermissions.join(', ')}`);
      }

      // Validate parameters
      if (parameters && !Array.isArray(parameters)) {
        result.errors!.push('Parameters must be an array');
      }

      // Additional security checks
      if (this.containsMultipleStatements(query)) {
        result.errors!.push('Multiple statements not allowed');
      }

      if (this.containsSubqueries(query) && !clientPermissions.includes('read')) {
        result.errors!.push('Subqueries require read permission');
      }

      // If no errors, mark as valid
      if (result.errors!.length === 0) {
        result.isValid = true;
        result.sanitizedQuery = this.sanitizeQuery(query);
        result.parameters = this.sanitizeParameters(parameters);
      } else {
        result.reason = result.errors!.join('; ');
      }

      return result;

    } catch (error) {
      result.errors!.push(`Query validation error: ${error}`);
      this.logger.error('Query validation failed', { error, query: this.hashQuery(query) });
      return result;
    }
  }

  /**
   * Detects SQL operations in the query
   */
  private detectSQLOperations(normalizedQuery: string): string[] {
    const operations: string[] = [];
    
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
  private getRequiredPermissions(operations: string[]): PermissionType[] {
    const permissions = new Set<PermissionType>();

    for (const op of operations) {
      const perms = this.permissionKeywords[op] || [];
      perms.forEach(p => permissions.add(p));
    }

    return Array.from(permissions);
  }

  /**
   * Checks if client has required permissions
   */
  private checkPermissions(clientPermissions: PermissionType[], requiredPermissions: PermissionType[]): boolean {
    return requiredPermissions.every(required => clientPermissions.includes(required));
  }

  /**
   * Sanitizes SQL query by removing comments and normalizing whitespace
   */
  private sanitizeQuery(query: string): string {
    return query
      .replace(/--.*$/gm, '') // Remove line comments
      .replace(/\/\*[\s\S]*?\*\//g, '') // Remove block comments
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();
  }

  /**
   * Sanitizes query parameters
   */
  private sanitizeParameters(parameters: any[]): any[] {
    if (!parameters) return [];
    
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
  private containsMultipleStatements(query: string): boolean {
    // Simple check for semicolons outside of string literals
    const withoutStrings = query.replace(/'[^']*'/g, '').replace(/"[^"]*"/g, '');
    return (withoutStrings.match(/;/g) || []).length > 1;
  }

  /**
   * Checks if query contains subqueries
   */
  private containsSubqueries(query: string): boolean {
    const normalizedQuery = query.toUpperCase();
    return normalizedQuery.includes('SELECT') && 
           (normalizedQuery.includes('(') && normalizedQuery.includes(')'));
  }

  /**
   * Creates a hash of the query for logging purposes
   */
  public hashQuery(query: string): string {
    return crypto.createHash('sha256').update(query).digest('hex').substring(0, 16);
  }

  /**
   * Logs audit entry
   */
  public logAudit(entry: Omit<AuditLogEntry, 'logId' | 'executedAt'>): void {
    const auditEntry: AuditLogEntry = {
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
  public getAuditLogs(clientId?: string, limit: number = 100): AuditLogEntry[] {
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
  public hasPermission(clientPermissions: PermissionType[], requiredPermission: PermissionType): boolean {
    return clientPermissions.includes(requiredPermission);
  }

  /**
   * Rate limiting check (simple in-memory implementation)
   */
  private rateLimitMap = new Map<string, { count: number; resetTime: number }>();

  public checkRateLimit(clientId: string, maxRequestsPerMinute: number = 100): boolean {
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
  public cleanupRateLimitData(): void {
    const now = Date.now();
    const cutoff = now - 120000; // 2 minutes ago

    for (const [clientId, data] of this.rateLimitMap.entries()) {
      if (data.resetTime < cutoff) {
        this.rateLimitMap.delete(clientId);
      }
    }
  }
}

export default SecurityManager;