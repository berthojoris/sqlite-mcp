#!/usr/bin/env node
/**
 * Command Line Interface for SQLite MCP Server
 * Supports the exact configuration format: npx @berthojoris/mcp-sqlite-server sqlite:////path/to/mydb.sqlite list,read,utility
 */
declare class SQLiteMCPCLI {
    private logger;
    private program;
    constructor();
    /**
     * Set up CLI commands
     */
    private setupCommands;
    /**
     * Parse SQLite connection string
     */
    private parseConnectionString;
    /**
     * Parse permissions string
     */
    private parsePermissions;
    /**
     * Start the MCP server
     */
    private startServer;
    /**
     * Show database schema
     */
    private showSchema;
    /**
     * Display detailed table information
     */
    private displayTableInfo;
    /**
     * Create database backup
     */
    private createBackup;
    /**
     * Generate configuration file
     */
    private generateConfig;
    /**
     * Run the CLI
     */
    run(): void;
}
export default SQLiteMCPCLI;
//# sourceMappingURL=index.d.ts.map