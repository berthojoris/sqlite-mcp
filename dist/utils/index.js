"use strict";
/**
 * Utility functions for SQLite MCP Server
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
exports.SimpleCache = exports.RateLimiter = void 0;
exports.generateId = generateId;
exports.generateQueryHash = generateQueryHash;
exports.sanitizePath = sanitizePath;
exports.isFileAccessible = isFileAccessible;
exports.ensureDirectoryExists = ensureDirectoryExists;
exports.formatBytes = formatBytes;
exports.formatDuration = formatDuration;
exports.isValidEmail = isValidEmail;
exports.escapeIdentifier = escapeIdentifier;
exports.getQueryOperation = getQueryOperation;
exports.extractTableNames = extractTableNames;
exports.retry = retry;
exports.deepClone = deepClone;
exports.debounce = debounce;
exports.throttle = throttle;
const crypto = __importStar(require("crypto"));
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
/**
 * Generate a unique ID
 */
function generateId() {
    return crypto.randomUUID();
}
/**
 * Generate a hash for a query (for audit logging)
 */
function generateQueryHash(query) {
    return crypto.createHash('sha256').update(query).digest('hex').substring(0, 16);
}
/**
 * Sanitize file path
 */
function sanitizePath(filePath) {
    return path.normalize(filePath).replace(/\.\./g, '');
}
/**
 * Check if a file exists and is accessible
 */
function isFileAccessible(filePath) {
    try {
        fs.accessSync(filePath, fs.constants.R_OK);
        return true;
    }
    catch {
        return false;
    }
}
/**
 * Ensure directory exists
 */
function ensureDirectoryExists(dirPath) {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }
}
/**
 * Format bytes to human readable string
 */
function formatBytes(bytes) {
    if (bytes === 0)
        return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}
/**
 * Format duration in milliseconds to human readable string
 */
function formatDuration(ms) {
    if (ms < 1000)
        return `${ms}ms`;
    if (ms < 60000)
        return `${(ms / 1000).toFixed(2)}s`;
    if (ms < 3600000)
        return `${(ms / 60000).toFixed(2)}m`;
    return `${(ms / 3600000).toFixed(2)}h`;
}
/**
 * Validate email format
 */
function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}
/**
 * Escape SQL identifier (table name, column name)
 */
function escapeIdentifier(identifier) {
    // Remove any existing quotes and escape internal quotes
    const cleaned = identifier.replace(/"/g, '""');
    return `"${cleaned}"`;
}
/**
 * Parse SQL query to extract operation type
 */
function getQueryOperation(query) {
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
function extractTableNames(query) {
    const normalized = query.toUpperCase();
    const tables = [];
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
class RateLimiter {
    constructor(maxRequests, windowMs) {
        this.maxRequests = maxRequests;
        this.windowMs = windowMs;
        this.requests = new Map();
    }
    /**
     * Check if request is allowed
     */
    isAllowed(key) {
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
    getRemaining(key) {
        const now = Date.now();
        const requests = this.requests.get(key) || [];
        const validRequests = requests.filter(time => now - time < this.windowMs);
        return Math.max(0, this.maxRequests - validRequests.length);
    }
    /**
     * Reset rate limit for a key
     */
    reset(key) {
        this.requests.delete(key);
    }
    /**
     * Clear all rate limits
     */
    clear() {
        this.requests.clear();
    }
}
exports.RateLimiter = RateLimiter;
/**
 * Simple cache implementation
 */
class SimpleCache {
    constructor(defaultTtlMs = 300000) {
        this.defaultTtlMs = defaultTtlMs;
        this.cache = new Map();
    } // 5 minutes default
    /**
     * Set a value in cache
     */
    set(key, value, ttlMs) {
        const expiry = Date.now() + (ttlMs || this.defaultTtlMs);
        this.cache.set(key, { value, expiry });
    }
    /**
     * Get a value from cache
     */
    get(key) {
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
    has(key) {
        return this.get(key) !== undefined;
    }
    /**
     * Delete a key from cache
     */
    delete(key) {
        return this.cache.delete(key);
    }
    /**
     * Clear all cache entries
     */
    clear() {
        this.cache.clear();
    }
    /**
     * Get cache size
     */
    size() {
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
exports.SimpleCache = SimpleCache;
/**
 * Retry utility with exponential backoff
 */
async function retry(fn, maxAttempts = 3, baseDelayMs = 1000) {
    let lastError;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            return await fn();
        }
        catch (error) {
            lastError = error;
            if (attempt === maxAttempts) {
                throw lastError;
            }
            // Exponential backoff with jitter
            const delay = baseDelayMs * Math.pow(2, attempt - 1) + Math.random() * 1000;
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
    throw lastError;
}
/**
 * Deep clone an object
 */
function deepClone(obj) {
    if (obj === null || typeof obj !== 'object') {
        return obj;
    }
    if (obj instanceof Date) {
        return new Date(obj.getTime());
    }
    if (obj instanceof Array) {
        return obj.map(item => deepClone(item));
    }
    if (typeof obj === 'object') {
        const cloned = {};
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
function debounce(func, waitMs) {
    let timeoutId;
    return (...args) => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => func.apply(null, args), waitMs);
    };
}
/**
 * Throttle function
 */
function throttle(func, limitMs) {
    let inThrottle;
    return (...args) => {
        if (!inThrottle) {
            func.apply(null, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limitMs);
        }
    };
}
//# sourceMappingURL=index.js.map