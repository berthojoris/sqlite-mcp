/**
 * Main entry point for SQLite MCP Server
 * Exports all public APIs and provides server initialization
 */

export { MCPSQLiteServer } from './core/mcp-server';
export { DatabaseManager } from './database';
export { SecurityManager } from './security';
export { ConfigManager } from './config';
export { default as SQLiteMCPCLI } from './cli';

// Export types
export * from './types';

// Export utilities
export * from './utils';

// Default export for programmatic usage
export { MCPSQLiteServer as default } from './core/mcp-server';