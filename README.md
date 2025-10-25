# SQLite MCP Server

A comprehensive Model Context Protocol (MCP) server implementation for SQLite databases, providing secure and controlled access to SQLite operations through a standardized interface.

## 🚀 Features

### Core Functionality
- **MCP Protocol Compliance**: Full implementation of the Model Context Protocol for seamless integration with MCP clients
- **SQLite Integration**: Native SQLite support using `better-sqlite3` for optimal performance
- **Granular Permissions**: Fine-grained permission system with 9 distinct permission types
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

The MCP server provides the following tools:

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

## 📊 Performance & Monitoring

### Connection Pooling
- Configurable maximum connections
- Automatic connection lifecycle management
- Connection reuse optimization
- Idle connection cleanup

### Performance Metrics
- Query execution time tracking
- Success/failure rate monitoring
- Connection pool statistics
- Rate limiting metrics

### Logging
Comprehensive logging includes:
- Query execution details
- Permission checks
- Security violations
- Performance metrics
- Error conditions

## 🧪 Development & Testing

### Building from Source
```bash
git clone <repository>
cd mcp-sqlite-server
npm install
npm run build
```

### Running Tests
```bash
npm test
```

### Development Mode
```bash
npm run dev
```

### Type Checking
```bash
npm run check
```

## 📝 API Reference

### Configuration Options
- `--config <path>`: Configuration file path
- `--log-level <level>`: Logging level (debug, info, warn, error)
- `--read-only`: Open database in read-only mode
- `--max-connections <number>`: Maximum database connections
- `--backup-dir <path>`: Directory for automatic backups

### Environment Variables
- `LOG_LEVEL`: Default logging level
- `MCP_SQLITE_CONFIG`: Default configuration file path

## 🗺️ Roadmap

### ✅ Version 1.0.0 - Core Foundation (Completed)
- ✅ **MCP Protocol Implementation**: Full Model Context Protocol compliance
- ✅ **SQLite Integration**: Native SQLite support with better-sqlite3
- ✅ **Permission System**: Granular 9-tier permission system
- ✅ **Security Features**: SQL injection protection and query validation
- ✅ **CLI Interface**: Command-line interface with comprehensive options
- ✅ **Connection Pooling**: Efficient database connection management
- ✅ **Audit Logging**: Detailed operation logging for compliance

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
- ✅ **Bulk Operations**: Enhanced bulk insert/update/delete with progress tracking
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
