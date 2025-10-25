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
Common permission combinations for different use cases:

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

### Version 1.1.0 - Enhanced Query & Performance (Q1 2025)
- **Advanced Query Builder**: Visual query builder with drag-and-drop interface
- **Query Optimization**: Automatic query analysis and optimization suggestions
- **Performance Metrics**: Real-time query performance monitoring and analytics
- **Connection Health Monitoring**: Advanced connection pool health checks
- **Memory Usage Optimization**: Improved memory management for large datasets

### Version 1.2.0 - Data Management & Migration (Q2 2025)
- **Database Migration Tools**: Schema versioning and migration management
- **Data Import/Export**: Support for CSV, JSON, XML data import/export
- **Bulk Operations**: Enhanced bulk insert/update/delete with progress tracking
- **Data Validation**: Custom validation rules and constraints
- **Backup Scheduling**: Automated backup scheduling with retention policies

### Version 1.3.0 - Advanced Security & Compliance (Q2 2025)
- **Role-Based Access Control (RBAC)**: Advanced user roles and permissions
- **Data Encryption**: At-rest and in-transit data encryption
- **Compliance Reporting**: GDPR, HIPAA, SOX compliance reporting tools
- **Advanced Audit Logging**: Enhanced audit trails with data lineage tracking
- **Security Scanning**: Automated security vulnerability scanning

### Version 1.4.0 - Integration & Extensibility (Q3 2025)
- **Plugin System**: Extensible plugin architecture for custom functionality
- **REST API Gateway**: RESTful API layer for non-MCP clients
- **GraphQL Support**: GraphQL query interface for flexible data access
- **Webhook Integration**: Event-driven webhooks for database changes
- **Third-party Integrations**: Slack, Discord, Teams notifications

### Version 1.5.0 - AI & Analytics (Q3 2025)
- **Natural Language Queries**: AI-powered natural language to SQL conversion
- **Intelligent Schema Suggestions**: AI-driven schema optimization recommendations
- **Anomaly Detection**: Machine learning-based anomaly detection in data patterns
- **Predictive Analytics**: Built-in predictive analytics and forecasting
- **Auto-Indexing**: AI-powered automatic index creation and optimization

### Version 1.6.0 - Scalability & Clustering (Q4 2025)
- **Read Replicas**: Support for SQLite read replicas and load balancing
- **Horizontal Scaling**: Multi-database sharding and federation
- **Distributed Transactions**: Cross-database transaction support
- **Cache Layer**: Intelligent caching with Redis/Memcached integration
- **Load Balancing**: Advanced load balancing strategies

### Version 2.0.0 - Enterprise Features (Q1 2026)
- **Multi-Database Support**: PostgreSQL, MySQL, SQL Server connectors
- **Enterprise Dashboard**: Comprehensive management dashboard
- **Advanced Monitoring**: Prometheus/Grafana integration
- **High Availability**: Failover and disaster recovery features
- **Enterprise SSO**: SAML, OAuth2, LDAP integration
- **Container Orchestration**: Kubernetes operator and Helm charts

### Long-term Vision (2026+)
- **Cloud-Native Architecture**: Serverless deployment options
- **Real-time Collaboration**: Multi-user real-time database editing
- **Visual Database Designer**: Drag-and-drop database schema designer
- **Time-series Data Support**: Specialized time-series data handling
- **Blockchain Integration**: Immutable audit trails using blockchain
- **Edge Computing**: Edge deployment for IoT and distributed systems

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
