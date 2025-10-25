"use strict";
/**
 * Main entry point for SQLite MCP Server
 * Exports all public APIs and provides server initialization
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
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = exports.SQLiteMCPCLI = exports.ConfigManager = exports.SecurityManager = exports.DatabaseManager = exports.MCPSQLiteServer = void 0;
var mcp_server_1 = require("./core/mcp-server");
Object.defineProperty(exports, "MCPSQLiteServer", { enumerable: true, get: function () { return mcp_server_1.MCPSQLiteServer; } });
var database_1 = require("./database");
Object.defineProperty(exports, "DatabaseManager", { enumerable: true, get: function () { return database_1.DatabaseManager; } });
var security_1 = require("./security");
Object.defineProperty(exports, "SecurityManager", { enumerable: true, get: function () { return security_1.SecurityManager; } });
var config_1 = require("./config");
Object.defineProperty(exports, "ConfigManager", { enumerable: true, get: function () { return config_1.ConfigManager; } });
var cli_1 = require("./cli");
Object.defineProperty(exports, "SQLiteMCPCLI", { enumerable: true, get: function () { return __importDefault(cli_1).default; } });
// Export types
__exportStar(require("./types"), exports);
// Export utilities
__exportStar(require("./utils"), exports);
// Default export for programmatic usage
var mcp_server_2 = require("./core/mcp-server");
Object.defineProperty(exports, "default", { enumerable: true, get: function () { return mcp_server_2.MCPSQLiteServer; } });
//# sourceMappingURL=index.js.map