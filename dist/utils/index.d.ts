/**
 * Utility functions for SQLite MCP Server
 */
/**
 * Generate a unique ID
 */
export declare function generateId(): string;
/**
 * Generate a hash for a query (for audit logging)
 */
export declare function generateQueryHash(query: string): string;
/**
 * Sanitize file path
 */
export declare function sanitizePath(filePath: string): string;
/**
 * Check if a file exists and is accessible
 */
export declare function isFileAccessible(filePath: string): boolean;
/**
 * Ensure directory exists
 */
export declare function ensureDirectoryExists(dirPath: string): void;
/**
 * Format bytes to human readable string
 */
export declare function formatBytes(bytes: number): string;
/**
 * Format duration in milliseconds to human readable string
 */
export declare function formatDuration(ms: number): string;
/**
 * Validate email format
 */
export declare function isValidEmail(email: string): boolean;
/**
 * Escape SQL identifier (table name, column name)
 */
export declare function escapeIdentifier(identifier: string): string;
/**
 * Parse SQL query to extract operation type
 */
export declare function getQueryOperation(query: string): string;
/**
 * Extract table names from SQL query (simplified)
 */
export declare function extractTableNames(query: string): string[];
/**
 * Rate limiter utility
 */
export declare class RateLimiter {
    private maxRequests;
    private windowMs;
    private requests;
    constructor(maxRequests: number, windowMs: number);
    /**
     * Check if request is allowed
     */
    isAllowed(key: string): boolean;
    /**
     * Get remaining requests for a key
     */
    getRemaining(key: string): number;
    /**
     * Reset rate limit for a key
     */
    reset(key: string): void;
    /**
     * Clear all rate limits
     */
    clear(): void;
}
/**
 * Simple cache implementation
 */
export declare class SimpleCache<T> {
    private defaultTtlMs;
    private cache;
    constructor(defaultTtlMs?: number);
    /**
     * Set a value in cache
     */
    set(key: string, value: T, ttlMs?: number): void;
    /**
     * Get a value from cache
     */
    get(key: string): T | undefined;
    /**
     * Check if key exists in cache
     */
    has(key: string): boolean;
    /**
     * Delete a key from cache
     */
    delete(key: string): boolean;
    /**
     * Clear all cache entries
     */
    clear(): void;
    /**
     * Get cache size
     */
    size(): number;
}
/**
 * Retry utility with exponential backoff
 */
export declare function retry<T>(fn: () => Promise<T>, maxAttempts?: number, baseDelayMs?: number): Promise<T>;
/**
 * Deep clone an object
 */
export declare function deepClone<T>(obj: T): T;
/**
 * Debounce function
 */
export declare function debounce<T extends (...args: any[]) => any>(func: T, waitMs: number): (...args: Parameters<T>) => void;
/**
 * Throttle function
 */
export declare function throttle<T extends (...args: any[]) => any>(func: T, limitMs: number): (...args: Parameters<T>) => void;
//# sourceMappingURL=index.d.ts.map