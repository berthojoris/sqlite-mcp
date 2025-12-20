# SQLite MCP Server

A comprehensive Model Context Protocol (MCP) server implementation for SQLite databases, providing secure and controlled access to SQLite operations through a standardized interface.

[![npm version](https://badge.fury.io/js/%40berthojoris%2Fmcp-sqlite-server.svg)](https://www.npmjs.com/package/@berthojoris/mcp-sqlite-server)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## 📋 Table of Contents

- [Features](#-features)
- [Quick Start](#-quick-start)
- [Installation](#-installation)
- [Integration Guide](#-integration-guide)
  - [Claude Desktop](#claude-desktop)
  - [Cursor IDE](#cursor-ide)
  - [Continue.dev](#continuedev)
  - [Other MCP Clients](#other-mcp-clients)
- [Available Tools (12 Tools)](#-available-tools)
- [Permission System](#permission-system)
- [Configuration](#-configuration)
- [CLI Usage](#️-cli-usage)
- [Security Guidelines](#-security-guidelines)
- [Roadmap](#️-roadmap)
- [Contributing](#-contributing)
- [Version History](#-version-history)

## ⚡ Quick Start

Get up and running in 30 seconds:

```bash
# Run directly with npx (no installation required)
npx @berthojoris/mcp-sqlite-server sqlite:////path/to/database.sqlite list,read,create,update,delete
```

Or add to your MCP client configuration:

```json
{
  "mcpServers": {
    "sqlite": {
      "command": "npx",
      "args": ["-y", "@berthojoris/mcp-sqlite-server", "sqlite:////path/to/db.sqlite", "list,read,create,update,delete"]
    }
  }
}
```

## 🚀 Features

### Core Functionality
- **MCP Protocol Compliance**: Full implementation of the Model Context Protocol for seamless integration with MCP clients
- **SQLite Integration**: Native SQLite support using `better-sqlite3` for optimal performance
- **Granular Permissions**: Fine-grained permission system with 10 distinct permission types
- **Security First**: Comprehensive SQL injection protection and query validation
- **Schema Introspection**: Complete database schema analysis and reporting
- **Connection Pooling**: Efficient database connection management
- **Audit Logging**: Detailed operation logging for security and compliance

### Permission System
The server implements a granular permission system with the following types:

- `list` - List tables and schemas
- `read` - SELECT queries and data retrieval
- `create` - INSERT operations
- `update` - UPDATE operations  
- `delete` - DELETE operations
- `execute` - Execute stored procedures/functions
- `ddl` - Data Definition Language (CREATE, ALTER, DROP)
- `procedure` - Stored procedures (N/A for SQLite - reserved for compatibility)
- `transaction` - Transaction control (BEGIN, COMMIT, ROLLBACK)
- `utility` - Utility operations (VACUUM, ANALYZE, PRAGMA, etc.)

### Security Features
- **SQL Injection Prevention**: Parameterized queries and pattern detection
- **Query Validation**: Comprehensive query analysis and sanitization
- **Permission Enforcement**: Operation-level permission checking
- **Rate Limiting**: Configurable request rate limiting
- **Audit Trail**: Complete operation logging with client tracking
- **Input Sanitization**: Parameter validation and sanitization

### Auto-Creation Features
- **Database Auto-Creation**: Automatically creates database files if they don't exist
- **Directory Auto-Creation**: Creates parent directories recursively as needed
- **Intelligent Initialization**: Detects new vs existing databases and logs appropriately
- **Zero-Configuration Setup**: Works out-of-the-box with any valid SQLite path

## 📦 Installation

### NPX Usage (Recommended)
```bash
npx @berthojoris/mcp-sqlite-server sqlite:////path/to/your/database.sqlite list,read,utility
```

### Global Installation
```bash
npm install -g @berthojoris/mcp-sqlite-server
mcp-sqlite-server sqlite:////path/to/your/database.sqlite list,read,create,update
```

### Local Installation
```bash
npm install @berthojoris/mcp-sqlite-server
```

## 🔗 Integration Guide

This section provides detailed instructions for integrating SQLite MCP Server with various MCP-compatible clients.

### Claude Desktop

Claude Desktop is the official Anthropic client with native MCP support.

**Configuration File Location:**
- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`
- **Linux**: `~/.config/Claude/claude_desktop_config.json`

**Configuration:**
```json
{
  "mcpServers": {
    "sqlite": {
      "command": "npx",
      "args": [
        "-y",
        "@berthojoris/mcp-sqlite-server",
        "sqlite:////Users/yourname/databases/myapp.sqlite",
        "list,read,create,update,delete,utility"
      ]
    }
  }
}
```

**Windows Example:**
```json
{
  "mcpServers": {
    "sqlite": {
      "command": "npx",
      "args": [
        "-y",
        "@berthojoris/mcp-sqlite-server",
        "sqlite:///C:/Users/yourname/databases/myapp.sqlite",
        "list,read,create,update,delete,utility"
      ]
    }
  }
}
```

**After configuration:** Restart Claude Desktop to load the MCP server.

---

### Cursor IDE

Cursor IDE supports MCP servers for enhanced AI-assisted development.

**Configuration File Location:**
- **macOS/Linux**: `~/.cursor/mcp.json`
- **Windows**: `%USERPROFILE%\.cursor\mcp.json`

**Configuration:**
```json
{
  "mcpServers": {
    "sqlite": {
      "command": "npx",
      "args": [
        "-y",
        "@berthojoris/mcp-sqlite-server",
        "sqlite:////path/to/your/project/database.sqlite",
        "list,read,create,update,delete,ddl,transaction,utility"
      ]
    }
  }
}
```

**Project-Specific Configuration (`.cursor/mcp.json` in project root):**
```json
{
  "mcpServers": {
    "project-db": {
      "command": "npx",
      "args": [
        "-y",
        "@berthojoris/mcp-sqlite-server",
        "sqlite://./data/app.sqlite",
        "list,read,create,update,delete"
      ]
    }
  }
}
```

---

### Continue.dev

Continue.dev is an open-source AI code assistant that supports MCP.

**Configuration File:** `~/.continue/config.json`

```json
{
  "mcpServers": [
    {
      "name": "sqlite",
      "command": "npx",
      "args": [
        "-y",
        "@berthojoris/mcp-sqlite-server",
        "sqlite:////path/to/database.sqlite",
        "list,read,create,update,delete"
      ]
    }
  ]
}
```

---

### Cline (VS Code Extension)

Cline is a VS Code extension that supports MCP servers.

**Configuration:** Add to VS Code settings (`settings.json`):

```json
{
  "cline.mcpServers": {
    "sqlite": {
      "command": "npx",
      "args": [
        "-y",
        "@berthojoris/mcp-sqlite-server",
        "sqlite:////path/to/database.sqlite",
        "list,read,create,update,delete,utility"
      ]
    }
  }
}
```

---

### Windsurf IDE

Windsurf IDE by Codeium supports MCP integration.

**Configuration File:** `~/.windsurf/mcp.json`

```json
{
  "mcpServers": {
    "sqlite": {
      "command": "npx",
      "args": [
        "-y",
        "@berthojoris/mcp-sqlite-server",
        "sqlite:////path/to/database.sqlite",
        "list,read,create,update,delete,ddl"
      ]
    }
  }
}
```

---

### Other MCP Clients

For any MCP-compatible client, use the following general configuration pattern:

```json
{
  "mcpServers": {
    "sqlite": {
      "command": "npx",
      "args": [
        "-y",
        "@berthojoris/mcp-sqlite-server",
        "<connection-string>",
        "<permissions>"
      ]
    }
  }
}
```

**Arguments:**
1. `-y` - Auto-confirm npx installation
2. `@berthojoris/mcp-sqlite-server` - Package name
3. `<connection-string>` - SQLite database path (see Connection String Formats below)
4. `<permissions>` - Comma-separated list of permissions

---

### Multiple Database Configuration

You can configure multiple SQLite databases:

```json
{
  "mcpServers": {
    "main-db": {
      "command": "npx",
      "args": ["-y", "@berthojoris/mcp-sqlite-server", "sqlite:////path/to/main.sqlite", "list,read,create,update,delete"]
    },
    "analytics-db": {
      "command": "npx",
      "args": ["-y", "@berthojoris/mcp-sqlite-server", "sqlite:////path/to/analytics.sqlite", "list,read"]
    },
    "logs-db": {
      "command": "npx",
      "args": ["-y", "@berthojoris/mcp-sqlite-server", "sqlite:////path/to/logs.sqlite", "list,read,utility"]
    }
  }
}
```

## 🔧 Configuration

### MCP Client Configuration
Add to your MCP client configuration:

```json
{
  "mcpServers": {
    "sqlite": {
      "command": "npx",
      "args": [
        "-y",
        "@berthojoris/mcp-sqlite-server",
        "sqlite:////absolute/path/to/your/database.sqlite",
        "list,read,create,update,delete,utility"
      ]
    }
  }
}
```

### Connection String Formats
The server supports multiple SQLite connection string formats:

```bash
# Absolute path
sqlite:////absolute/path/to/database.sqlite

# Relative path  
sqlite://./relative/path/to/database.sqlite

# In-memory database
sqlite://:memory:

# Direct file path
/path/to/database.sqlite
```

### Permission Combinations

#### Detailed Permission Descriptions

<table>
<thead>
<tr>
<th>Permission</th>
<th>Description</th>
<th>Allowed Operations</th>
<th>Example Use Cases</th>
</tr>
</thead>
<tbody>
<tr>
<td><code>list</code></td>
<td>View database structure and metadata</td>
<td>
• List all tables<br>
• View table schemas<br>
• Check column information<br>
• View indexes and constraints<br>
• Access database metadata
</td>
<td>
• Database exploration<br>
• Schema documentation<br>
• Development planning<br>
• Data modeling
</td>
</tr>
<tr>
<td><code>read</code></td>
<td>Execute SELECT queries and retrieve data</td>
<td>
• SELECT statements<br>
• JOIN operations<br>
• Aggregate functions (COUNT, SUM, etc.)<br>
• Subqueries<br>
• View data content
</td>
<td>
• Data analysis<br>
• Reporting<br>
• Business intelligence<br>
• Read-only applications
</td>
</tr>
<tr>
<td><code>create</code></td>
<td>Insert new records into tables</td>
<td>
• INSERT statements<br>
• Bulk insert operations<br>
• Add new rows<br>
• Populate tables with data
</td>
<td>
• Data entry applications<br>
• ETL processes<br>
• User registration<br>
• Content creation
</td>
</tr>
<tr>
<td><code>update</code></td>
<td>Modify existing records</td>
<td>
• UPDATE statements<br>
• Bulk update operations<br>
• Modify existing data<br>
• Change field values
</td>
<td>
• Profile updates<br>
• Status changes<br>
• Data corrections<br>
• Content editing
</td>
</tr>
<tr>
<td><code>delete</code></td>
<td>Remove records from tables</td>
<td>
• DELETE statements<br>
• Bulk delete operations<br>
• Remove rows<br>
• Data cleanup
</td>
<td>
• User account deletion<br>
• Data archiving<br>
• Content removal<br>
• Cleanup operations
</td>
</tr>
<tr>
<td><code>execute</code></td>
<td>Run stored procedures and functions</td>
<td>
• Execute stored procedures<br>
• Call database functions<br>
• Run custom database logic<br>
• Execute complex operations
</td>
<td>
• Business logic execution<br>
• Complex calculations<br>
• Batch processing<br>
• Custom workflows
</td>
</tr>
<tr>
<td><code>ddl</code></td>
<td>Modify database structure</td>
<td>
• CREATE TABLE/INDEX<br>
• ALTER TABLE structure<br>
• DROP tables/indexes<br>
• Modify schema<br>
• Create/drop views
</td>
<td>
• Database migrations<br>
• Schema updates<br>
• Development setup<br>
• Structure modifications
</td>
</tr>
<tr>
<td><code>transaction</code></td>
<td>Control transaction boundaries</td>
<td>
• BEGIN transactions<br>
• COMMIT changes<br>
• ROLLBACK operations<br>
• Manage data consistency<br>
• Atomic operations
</td>
<td>
• Financial operations<br>
• Data integrity<br>
• Batch processing<br>
• Critical updates
</td>
</tr>
<tr>
<td><code>utility</code></td>
<td>Perform maintenance and optimization</td>
<td>
• VACUUM database<br>
• ANALYZE statistics<br>
• PRAGMA commands<br>
• Database backup<br>
• Performance optimization
</td>
<td>
• Database maintenance<br>
• Performance tuning<br>
• Backup operations<br>
• System administration
</td>
</tr>
</tbody>
</table>

#### Common permission combinations for different use cases:

```bash
# Read-only access
list,read

# Basic CRUD operations
list,read,create,update,delete

# Full database access
list,read,create,update,delete,execute,ddl,transaction,utility

# Analytics/reporting
list,read,utility

# Development/testing
list,read,create,update,delete,ddl,transaction,utility
```

## 🛠️ CLI Usage

### Start MCP Server
```bash
# Basic usage
mcp-sqlite-server sqlite:////path/to/db.sqlite list,read,utility

# With additional options
mcp-sqlite-server sqlite:////path/to/db.sqlite list,read,create,update \
  --read-only \
  --log-level debug \
  --max-connections 5
```

### Schema Information
```bash
# View complete schema
mcp-sqlite-server schema sqlite:////path/to/db.sqlite

# View specific table
mcp-sqlite-server schema sqlite:////path/to/db.sqlite --table users

# JSON output
mcp-sqlite-server schema sqlite:////path/to/db.sqlite --format json
```

### Database Backup
```bash
mcp-sqlite-server backup sqlite:////path/to/source.sqlite /path/to/backup.sqlite
```

### Generate Configuration
```bash
# Basic configuration
mcp-sqlite-server config --output mcp-config.json

# Template with multiple servers
mcp-sqlite-server config --template --output mcp-template.json
```

## 🔌 Available Tools

The MCP server provides **12 powerful tools** for comprehensive SQLite database management:

### Tools Summary

| # | Tool | Description | Permission |
|---|------|-------------|------------|
| 1 | [`sqlite_query`](#sqlite_query) | Execute SELECT queries with parameterized support | `read` |
| 2 | [`sqlite_insert`](#sqlite_insert) | Insert single records into tables | `create` |
| 3 | [`sqlite_update`](#sqlite_update) | Update existing records | `update` |
| 4 | [`sqlite_delete`](#sqlite_delete) | Delete records from tables | `delete` |
| 5 | [`sqlite_schema`](#sqlite_schema) | Get comprehensive schema information | `list` |
| 6 | [`sqlite_tables`](#sqlite_tables) | List all tables in database | `list` |
| 7 | [`sqlite_transaction`](#sqlite_transaction) | Execute multiple queries atomically | `transaction` |
| 8 | [`sqlite_backup`](#sqlite_backup) | Create database backup | `utility` |
| 9 | [`sqlite_bulk_insert`](#sqlite_bulk_insert) | Bulk insert with relational support | `create` |
| 10 | [`sqlite_bulk_update`](#sqlite_bulk_update) | Bulk update with progress tracking | `update` |
| 11 | [`sqlite_bulk_delete`](#sqlite_bulk_delete) | Bulk delete with cascade support | `delete` |
| 12 | [`sqlite_ddl`](#sqlite_ddl) | Schema management (CREATE/ALTER/DROP) | `ddl` |

### Tool Categories

**Data Query & Retrieval:**
- `sqlite_query` - Run SELECT statements
- `sqlite_schema` - Inspect database structure
- `sqlite_tables` - List available tables

**Data Manipulation (CRUD):**
- `sqlite_insert` - Create new records
- `sqlite_update` - Modify existing records
- `sqlite_delete` - Remove records

**Bulk Operations:**
- `sqlite_bulk_insert` - Insert many records efficiently
- `sqlite_bulk_update` - Update many records at once
- `sqlite_bulk_delete` - Delete many records with cascade support

**Schema Management:**
- `sqlite_ddl` - CREATE/ALTER/DROP tables and indexes

**Database Operations:**
- `sqlite_transaction` - Atomic multi-query execution
- `sqlite_backup` - Database backup utility

---

### Detailed Tool Documentation

### `sqlite_query`
Execute SELECT queries with full result sets.

**Parameters:**
- `query` (string): SQL SELECT statement
- `parameters` (array, optional): Query parameters for prepared statements

**Required Permissions:** `read`

**Example:**
```sql
SELECT * FROM users WHERE age > ? AND city = ?
Parameters: [25, "New York"]
```

### `sqlite_insert`
Insert new records into tables.

**Parameters:**
- `query` (string): SQL INSERT statement
- `parameters` (array, optional): Values to insert

**Required Permissions:** `create`

**Example:**
```sql
INSERT INTO users (name, email, age) VALUES (?, ?, ?)
Parameters: ["John Doe", "john@example.com", 30]
```

### `sqlite_update`
Update existing records.

**Parameters:**
- `query` (string): SQL UPDATE statement
- `parameters` (array, optional): Update values

**Required Permissions:** `update`

**Example:**
```sql
UPDATE users SET email = ? WHERE id = ?
Parameters: ["newemail@example.com", 123]
```

### `sqlite_delete`
Delete records from tables.

**Parameters:**
- `query` (string): SQL DELETE statement
- `parameters` (array, optional): Condition parameters

**Required Permissions:** `delete`

**Example:**
```sql
DELETE FROM users WHERE last_login < ?
Parameters: ["2023-01-01"]
```

### `sqlite_schema`
Get comprehensive database schema information.

**Parameters:**
- `table` (string, optional): Specific table name

**Required Permissions:** `list`

**Returns:** Complete schema information including tables, columns, indexes, views, triggers, and foreign keys.

### `sqlite_tables`
List all tables in the database.

**Required Permissions:** `list`

**Returns:** Array of table names with basic metadata.

### `sqlite_transaction`
Execute multiple queries within a transaction.

**Parameters:**
- `queries` (array): Array of query objects with `query` and optional `parameters`

**Required Permissions:** `transaction` + permissions for individual operations

**Example:**
```json
{
  "queries": [
    {
      "query": "INSERT INTO accounts (name, balance) VALUES (?, ?)",
      "parameters": ["Alice", 1000]
    },
    {
      "query": "INSERT INTO accounts (name, balance) VALUES (?, ?)", 
      "parameters": ["Bob", 500]
    }
  ]
}
```

### `sqlite_backup`
Create a backup of the database.

**Parameters:**
- `backupPath` (string): Path for the backup file

**Required Permissions:** `utility`

### `sqlite_bulk_insert`
Perform bulk insert operations with relational data support and progress tracking.

**Parameters:**
- `mainTable` (string): Main table name to insert into
- `records` (array): Array of records to insert
- `relatedData` (object, optional): Related table data with foreign key mappings
- `options` (object, optional): Bulk insert options
  - `batchSize` (number): Batch size for processing (default: 1000)
  - `continueOnError` (boolean): Continue processing on errors (default: false)
  - `validateForeignKeys` (boolean): Validate foreign key constraints (default: true)
  - `insertRelatedData` (boolean): Insert related table data first (default: true)

**Required Permissions:** `create`

**Example:**
```json
{
  "mainTable": "posts",
  "records": [
    {"title": "Post 1", "content": "Content 1", "user_id": 1},
    {"title": "Post 2", "content": "Content 2", "user_id": 2}
  ],
  "relatedData": {
    "users": [
      {"id": 1, "name": "John", "email": "john@example.com"},
      {"id": 2, "name": "Jane", "email": "jane@example.com"}
    ]
  },
  "options": {
    "batchSize": 500,
    "continueOnError": true,
    "validateForeignKeys": true
  }
}
```

### `sqlite_bulk_update`
Perform bulk update operations with progress tracking.

**Parameters:**
- `table` (string): Table name to update
- `updates` (array): Array of update operations with `data` and `where` conditions
- `options` (object, optional): Bulk update options
  - `batchSize` (number): Batch size for processing (default: 1000)
  - `continueOnError` (boolean): Continue processing on errors (default: false)
  - `validateForeignKeys` (boolean): Validate foreign key constraints (default: true)

**Required Permissions:** `update`

**Example:**
```json
{
  "table": "users",
  "updates": [
    {
      "data": {"name": "John Updated", "email": "john.new@example.com"},
      "where": {"id": 1}
    },
    {
      "data": {"status": "active"},
      "where": {"last_login": {"$gt": "2024-01-01"}}
    }
  ],
  "options": {
    "batchSize": 100,
    "continueOnError": false
  }
}
```

### `sqlite_bulk_delete`
Perform bulk delete operations with cascading support and progress tracking.

**Parameters:**
- `table` (string): Table name to delete from
- `conditions` (array): Array of WHERE conditions for deletion
- `options` (object, optional): Bulk delete options
  - `batchSize` (number): Batch size for processing (default: 1000)
  - `continueOnError` (boolean): Continue processing on errors (default: false)
  - `cascadeDelete` (boolean): Enable cascade delete for related records (default: true)

**Required Permissions:** `delete`

**Example:**
```json
{
  "table": "posts",
  "conditions": [
    {"created_at": {"$lt": "2023-01-01"}},
    {"status": "deleted"},
    {"user_id": {"$in": [1, 2, 3]}}
  ],
  "options": {
    "batchSize": 50,
    "cascadeDelete": true
  }
}
```

### `sqlite_ddl`
Execute DDL (Data Definition Language) operations for schema management.

**Parameters:**
- `operation` (string): DDL operation - `create_table`, `drop_table`, `alter_table`, `create_index`, `drop_index`
- `table` (string): Table name
- `columns` (array, optional): Column definitions for `create_table`
  - `name` (string): Column name
  - `type` (string): Data type (TEXT, INTEGER, REAL, BLOB, etc.)
  - `primaryKey` (boolean): Is primary key
  - `autoIncrement` (boolean): Auto increment (only for INTEGER PRIMARY KEY)
  - `notNull` (boolean): NOT NULL constraint
  - `unique` (boolean): UNIQUE constraint
  - `defaultValue` (string): Default value
  - `foreignKey` (object): Foreign key reference with `table`, `column`, `onDelete`, `onUpdate`
- `alterAction` (object, optional): For `alter_table` - `action` (`add_column`, `rename_table`, `rename_column`), `column`, `newName`, `oldColumnName`
- `index` (object, optional): For index operations - `name`, `columns`, `unique`
- `ifNotExists` (boolean): Add IF NOT EXISTS clause
- `ifExists` (boolean): Add IF EXISTS clause for drop operations

**Required Permissions:** `ddl`

**Example - Create Table:**
```json
{
  "operation": "create_table",
  "table": "users",
  "columns": [
    {"name": "id", "type": "INTEGER", "primaryKey": true, "autoIncrement": true},
    {"name": "name", "type": "TEXT", "notNull": true},
    {"name": "email", "type": "TEXT", "unique": true},
    {"name": "created_at", "type": "TEXT", "defaultValue": "CURRENT_TIMESTAMP"}
  ],
  "ifNotExists": true
}
```

**Example - Create Index:**
```json
{
  "operation": "create_index",
  "table": "users",
  "index": {
    "name": "idx_users_email",
    "columns": ["email"],
    "unique": true
  },
  "ifNotExists": true
}
```

**Example - Alter Table:**
```json
{
  "operation": "alter_table",
  "table": "users",
  "alterAction": {
    "action": "add_column",
    "column": {"name": "phone", "type": "TEXT"}
  }
}
```

## 🔒 Security Guidelines

### Best Practices
1. **Principle of Least Privilege**: Only grant necessary permissions
2. **Use Parameterized Queries**: Always use parameters for dynamic values
3. **Regular Backups**: Implement automated backup strategies
4. **Monitor Audit Logs**: Review operation logs regularly
5. **Connection Limits**: Set appropriate connection pool limits
6. **Read-Only When Possible**: Use read-only mode for reporting/analytics

### Security Features
- **SQL Injection Protection**: Automatic detection of dangerous patterns
- **Query Validation**: Comprehensive query analysis before execution
- **Permission Enforcement**: Operation-level access control
- **Rate Limiting**: Configurable request throttling
- **Audit Logging**: Complete operation tracking
- **Input Sanitization**: Parameter validation and cleaning

### Dangerous Operations
The server automatically blocks or restricts:
- Multiple statement execution
- Dangerous SQL patterns (UNION-based injections, etc.)
- Unauthorized schema modifications
- Excessive query complexity
- Operations without proper permissions

## 🗺️ Roadmap

### ✅ Version 1.0.0 - Core Foundation (Completed)
- ✅ **MCP Protocol Implementation**: Full Model Context Protocol compliance
- ✅ **SQLite Integration**: Native SQLite support with better-sqlite3
- ✅ **Permission System**: Granular 9-tier permission system
- ✅ **Security Features**: SQL injection protection and query validation
- ✅ **CLI Interface**: Command-line interface with comprehensive options
- ✅ **Connection Pooling**: Efficient database connection management
- ✅ **Audit Logging**: Detailed operation logging for compliance
- ✅ **Bulk Operations**: Enhanced bulk insert/update/delete with progress tracking

### ✅ Version 1.0.1 - Auto-Creation & Documentation (Completed)
- ✅ **Database Auto-Creation**: Automatic database file creation
- ✅ **Directory Auto-Creation**: Recursive parent directory creation
- ✅ **Enhanced Logging**: Improved initialization and status logging
- ✅ **Roadmap Documentation**: Comprehensive development roadmap
- ✅ **Cross-Platform Path Handling**: Windows and Unix path resolution

### 🚧 Version 1.1.0 - Enhanced Query & Performance (Q1 2025)
- [ ] **Advanced Query Builder**: Visual query builder with drag-and-drop interface
- [ ] **Query Optimization**: Automatic query analysis and optimization suggestions
- [ ] **Performance Metrics**: Real-time query performance monitoring and analytics
- [ ] **Connection Health Monitoring**: Advanced connection pool health checks
- [ ] **Memory Usage Optimization**: Improved memory management for large datasets

### 📋 Version 1.2.0 - Data Management & Migration (Q2 2025)
- [ ] **Database Migration Tools**: Schema versioning and migration management
- [ ] **Data Import/Export**: Support for CSV, JSON, XML data import/export
- [ ] **Data Validation**: Custom validation rules and constraints
- [ ] **Backup Scheduling**: Automated backup scheduling with retention policies

### 🔒 Version 1.3.0 - Advanced Security & Compliance (Q2 2025)
- [ ] **Role-Based Access Control (RBAC)**: Advanced user roles and permissions
- [ ] **Data Encryption**: At-rest and in-transit data encryption
- [ ] **Compliance Reporting**: GDPR, HIPAA, SOX compliance reporting tools
- [ ] **Advanced Audit Logging**: Enhanced audit trails with data lineage tracking
- [ ] **Security Scanning**: Automated security vulnerability scanning

### 🔌 Version 1.4.0 - Integration & Extensibility (Q3 2025)
- [ ] **Plugin System**: Extensible plugin architecture for custom functionality
- [ ] **REST API Gateway**: RESTful API layer for non-MCP clients
- [ ] **GraphQL Support**: GraphQL query interface for flexible data access
- [ ] **Webhook Integration**: Event-driven webhooks for database changes
- [ ] **Third-party Integrations**: Slack, Discord, Teams notifications



## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Ensure all tests pass
6. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details.

## 🆘 Support

For issues, questions, or contributions:
- GitHub Issues: [Repository Issues](https://github.com/berthojoris/mcp-sqlite-server/issues)
- Documentation: [Full Documentation](https://github.com/berthojoris/mcp-sqlite-server/wiki)

## 🔄 Version History

### v1.1.3
- **Comprehensive Integration Guide**: Setup instructions for Claude Desktop, Cursor, Continue.dev, Cline, Windsurf
- **Tools Summary Table**: Quick reference table listing all 12 tools
- **Table of Contents & Quick Start**: Improved documentation navigation and onboarding
- **Multiple Database Configuration**: Examples for multi-database setups

### v1.1.2
- **DDL Tool**: New dedicated `sqlite_ddl` tool for schema management (CREATE/ALTER/DROP tables, indexes)
- **Procedure Permission**: Added `procedure` permission type for future compatibility
- **Enhanced Documentation**: Improved ENHANCEMENTS.md with proper formatting and status tracking

### v1.1.1
- **Bulk Operations**: Advanced bulk insert, update, and delete operations with progress tracking
- **Relational Data Support**: Bulk insert with foreign key mappings and related table data
- **Progress Tracking**: Real-time progress monitoring for bulk operations with error handling
- **Performance Optimization**: Batch processing with configurable batch sizes for large datasets
- **Enhanced Error Handling**: Improved error reporting and continue-on-error options for bulk operations

### v1.0.1
- **Auto-Creation Features**: Database and directory auto-creation functionality
- **Enhanced Logging**: Improved initialization logging with database status
- **Roadmap Documentation**: Comprehensive roadmap for future development
- **Bug Fixes**: Minor improvements and stability enhancements

### v1.0.0
- Initial release
- Full MCP protocol implementation
- Comprehensive permission system
- Security features and audit logging
- CLI interface and schema introspection
- Connection pooling and performance optimization

---

**Note**: This server is designed for secure, controlled access to SQLite databases through the Model Context Protocol. Always follow security best practices and regularly review audit logs in production environments.

---

**Last Updated**: 2024-12-20 17:00:00
