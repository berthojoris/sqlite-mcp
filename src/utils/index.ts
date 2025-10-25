/**
 * Utility functions for SQLite MCP Server
 */

import * as crypto from 'crypto';
import * as path from 'path';
import * as fs from 'fs';

/**
 * Generate a unique ID
 */
export function generateId(): string {
  return crypto.randomUUID();
}

/**
 * Generate a hash for a query (for audit logging)
 */
export function generateQueryHash(query: string): string {
  return crypto.createHash('sha256').update(query).digest('hex').substring(0, 16);
}

/**
 * Sanitize file path
 */
export function sanitizePath(filePath: string): string {
  return path.normalize(filePath).replace(/\.\./g, '');
}

/**
 * Check if a file exists and is accessible
 */
export function isFileAccessible(filePath: string): boolean {
  try {
    fs.accessSync(filePath, fs.constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

/**
 * Ensure directory exists
 */
export function ensureDirectoryExists(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

/**
 * Format bytes to human readable string
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Format duration in milliseconds to human readable string
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(2)}s`;
  if (ms < 3600000) return `${(ms / 60000).toFixed(2)}m`;
  return `${(ms / 3600000).toFixed(2)}h`;
}

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Escape SQL identifier (table name, column name)
 */
export function escapeIdentifier(identifier: string): string {
  // Remove any existing quotes and escape internal quotes
  const cleaned = identifier.replace(/"/g, '""');
  return `"${cleaned}"`;
}

/**
 * Parse SQL query to extract operation type
 */
export function getQueryOperation(query: string): string {
  const normalized = query.trim().toUpperCase();
  const firstWord = normalized.split(/\s+/)[0];
  
  switch (firstWord) {
    case 'SELECT':
    case 'WITH':
      return 'SELECT';
    case 'INSERT':
      return 'INSERT';
    case 'UPDATE':
      return 'UPDATE';
    case 'DELETE':
      return 'DELETE';
    case 'CREATE':
      return 'CREATE';
    case 'DROP':
      return 'DROP';
    case 'ALTER':
      return 'ALTER';
    case 'PRAGMA':
      return 'PRAGMA';
    case 'EXPLAIN':
      return 'EXPLAIN';
    case 'BEGIN':
    case 'COMMIT':
    case 'ROLLBACK':
      return 'TRANSACTION';
    default:
      return 'UNKNOWN';
  }
}

/**
 * Extract table names from SQL query (simplified)
 */
export function extractTableNames(query: string): string[] {
  const normalized = query.toUpperCase();
  const tables: string[] = [];
  
  // Simple regex patterns for common SQL operations
  const patterns = [
    /FROM\s+([a-zA-Z_][a-zA-Z0-9_]*)/gi,
    /JOIN\s+([a-zA-Z_][a-zA-Z0-9_]*)/gi,
    /UPDATE\s+([a-zA-Z_][a-zA-Z0-9_]*)/gi,
    /INSERT\s+INTO\s+([a-zA-Z_][a-zA-Z0-9_]*)/gi,
    /DELETE\s+FROM\s+([a-zA-Z_][a-zA-Z0-9_]*)/gi,
    /CREATE\s+TABLE\s+([a-zA-Z_][a-zA-Z0-9_]*)/gi,
    /DROP\s+TABLE\s+([a-zA-Z_][a-zA-Z0-9_]*)/gi,
    /ALTER\s+TABLE\s+([a-zA-Z_][a-zA-Z0-9_]*)/gi
  ];
  
  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(normalized)) !== null) {
      const tableName = match[1].toLowerCase();
      if (!tables.includes(tableName)) {
        tables.push(tableName);
      }
    }
  }
  
  return tables;
}

/**
 * Rate limiter utility
 */
export class RateLimiter {
  private requests: Map<string, number[]> = new Map();
  
  constructor(
    private maxRequests: number,
    private windowMs: number
  ) {}
  
  /**
   * Check if request is allowed
   */
  isAllowed(key: string): boolean {
    const now = Date.now();
    const requests = this.requests.get(key) || [];
    
    // Remove old requests outside the window
    const validRequests = requests.filter(time => now - time < this.windowMs);
    
    if (validRequests.length >= this.maxRequests) {
      return false;
    }
    
    // Add current request
    validRequests.push(now);
    this.requests.set(key, validRequests);
    
    return true;
  }
  
  /**
   * Get remaining requests for a key
   */
  getRemaining(key: string): number {
    const now = Date.now();
    const requests = this.requests.get(key) || [];
    const validRequests = requests.filter(time => now - time < this.windowMs);
    
    return Math.max(0, this.maxRequests - validRequests.length);
  }
  
  /**
   * Reset rate limit for a key
   */
  reset(key: string): void {
    this.requests.delete(key);
  }
  
  /**
   * Clear all rate limits
   */
  clear(): void {
    this.requests.clear();
  }
}

/**
 * Simple cache implementation
 */
export class SimpleCache<T> {
  private cache: Map<string, { value: T; expiry: number }> = new Map();
  
  constructor(private defaultTtlMs: number = 300000) {} // 5 minutes default
  
  /**
   * Set a value in cache
   */
  set(key: string, value: T, ttlMs?: number): void {
    const expiry = Date.now() + (ttlMs || this.defaultTtlMs);
    this.cache.set(key, { value, expiry });
  }
  
  /**
   * Get a value from cache
   */
  get(key: string): T | undefined {
    const item = this.cache.get(key);
    
    if (!item) {
      return undefined;
    }
    
    if (Date.now() > item.expiry) {
      this.cache.delete(key);
      return undefined;
    }
    
    return item.value;
  }
  
  /**
   * Check if key exists in cache
   */
  has(key: string): boolean {
    return this.get(key) !== undefined;
  }
  
  /**
   * Delete a key from cache
   */
  delete(key: string): boolean {
    return this.cache.delete(key);
  }
  
  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear();
  }
  
  /**
   * Get cache size
   */
  size(): number {
    // Clean expired entries first
    const now = Date.now();
    for (const [key, item] of this.cache.entries()) {
      if (now > item.expiry) {
        this.cache.delete(key);
      }
    }
    
    return this.cache.size;
  }
}

/**
 * Retry utility with exponential backoff
 */
export async function retry<T>(
  fn: () => Promise<T>,
  maxAttempts: number = 3,
  baseDelayMs: number = 1000
): Promise<T> {
  let lastError: Error;
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      
      if (attempt === maxAttempts) {
        throw lastError;
      }
      
      // Exponential backoff with jitter
      const delay = baseDelayMs * Math.pow(2, attempt - 1) + Math.random() * 1000;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError!;
}

/**
 * Deep clone an object
 */
export function deepClone<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  
  if (obj instanceof Date) {
    return new Date(obj.getTime()) as unknown as T;
  }
  
  if (obj instanceof Array) {
    return obj.map(item => deepClone(item)) as unknown as T;
  }
  
  if (typeof obj === 'object') {
    const cloned = {} as T;
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        cloned[key] = deepClone(obj[key]);
      }
    }
    return cloned;
  }
  
  return obj;
}

/**
 * Debounce function
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  waitMs: number
): (...args: Parameters<T>) => void {
  let timeoutId: NodeJS.Timeout;
  
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func.apply(null, args), waitMs);
  };
}

/**
 * Throttle function
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limitMs: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean;
  
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func.apply(null, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limitMs);
    }
  };
}