# SQLite MCP Server - Tool Documentation

Complete reference documentation for all 12 tools available in the SQLite MCP Server.

---

## Table of Contents

- [Data Query Tools](#data-query-tools)
  - [sqlite_query](#sqlite_query)
  - [sqlite_schema](#sqlite_schema)
  - [sqlite_tables](#sqlite_tables)
- [Relationship Analysis](#relationship-analysis)
  - [sqlite_relations](#sqlite_relations)
- [CRUD Tools](#crud-tools)
  - [sqlite_insert](#sqlite_insert)
  - [sqlite_update](#sqlite_update)
  - [sqlite_delete](#sqlite_delete)
- [Bulk Operation Tools](#bulk-operation-tools)
  - [sqlite_bulk_insert](#sqlite_bulk_insert)
  - [sqlite_bulk_update](#sqlite_bulk_update)
  - [sqlite_bulk_delete](#sqlite_bulk_delete)
- [Schema Management Tools](#schema-management-tools)
  - [sqlite_ddl](#sqlite_ddl)
- [Database Operation Tools](#database-operation-tools)
  - [sqlite_transaction](#sqlite_transaction)
  - [sqlite_backup](#sqlite_backup)

---

## Data Query Tools

### sqlite_query

Execute SELECT queries with full result sets.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `query` | string | Yes | SQL SELECT statement |
| `parameters` | array | No | Query parameters for prepared statements |

**Required Permission:** `read`

**Example:**
```json
{
  "query": "SELECT * FROM users WHERE age > ? AND city = ?",
  "parameters": [25, "New York"]
}
```

**Response:**
```json
{
  "success": true,
  "data": [
    {"id": 1, "name": "John", "age": 30, "city": "New York"},
    {"id": 2, "name": "Jane", "age": 28, "city": "New York"}
  ],
  "executionTime": 5
}
```

---

### sqlite_schema

Get comprehensive database schema information.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `table` | string | No | Specific table name (optional, returns all if omitted) |

**Required Permission:** `list`

**Example - Get all schemas:**
```json
{}
```

**Example - Get specific table:**
```json
{
  "table": "users"
}
```

**Response:**
```json
{
  "tables": [
    {
      "name": "users",
      "type": "table",
      "columns": [
        {"name": "id", "type": "INTEGER", "primaryKey": true},
        {"name": "name", "type": "TEXT", "nullable": false},
        {"name": "email", "type": "TEXT", "unique": true}
      ]
    }
  ],
  "indexes": [...],
  "views": [...],
  "triggers": [...]
}
```

---

### sqlite_tables

List all tables in the database.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| - | - | - | No parameters required |

**Required Permission:** `list`

**Example:**
```json
{}
```

**Response:**
```json
{
  "tables": [
    {"name": "users", "type": "table", "columnCount": 5},
    {"name": "posts", "type": "table", "columnCount": 4},
    {"name": "comments", "type": "table", "columnCount": 3}
  ]
}
```

---

## Relationship Analysis

### sqlite_relations

Analyze table relationships and foreign key constraints.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `table` | string | Yes | Table name to analyze relationships for |
| `depth` | number | No | How deep to traverse relationships (1-5, default: 1) |
| `analysisType` | string | No | Type of relationships: "incoming", "outgoing", or "both" (default: "both") |

**Required Permission:** `list`

**Example - Basic relationship analysis:**
```json
{
  "table": "users"
}
```

**Example - Deep traversal with specific direction:**
```json
{
  "table": "orders",
  "depth": 2,
  "analysisType": "incoming"
}
```

**Response:**
```json
{
  "success": true,
  "table": "users",
  "outgoing": [
    {
      "local_column": "department_id",
      "referenced_table": "departments",
      "referenced_column": "id",
      "cascade_delete": true,
      "cascade_update": true,
      "on_delete": "CASCADE",
      "on_update": "CASCADE"
    }
  ],
  "incoming": [
    {
      "source_table": "posts",
      "source_column": "user_id",
      "local_column": "id",
      "referenced_table": "users",
      "on_delete": "NO ACTION",
      "on_update": "NO ACTION"
    },
    {
      "source_table": "comments",
      "source_column": "user_id",
      "local_column": "id",
      "referenced_table": "users",
      "on_delete": "CASCADE",
      "on_update": "CASCADE"
    }
  ],
  "relatedTables": ["departments", "posts", "comments"],
  "stats": {
    "totalOutgoing": 1,
    "totalIncoming": 2,
    "totalRelatedTables": 3
  },
  "relationshipTree": null
}
```

**Analysis Types Explained:**
- **incoming**: Shows all tables that have foreign keys referencing this table (tables that depend on this table)
- **outgoing**: Shows all tables that this table references with foreign keys (tables this table depends on)
- **both**: Shows complete relationship picture in both directions

**Cascade Rules:**
- `cascade_delete: true` - Deleting a parent record automatically deletes related child records
- `cascade_update: true` - Updating a parent key automatically updates related foreign keys
- `on_delete/on_update` values: `CASCADE`, `SET NULL`, `RESTRICT`, `NO ACTION`

**Use Cases:**
- Understanding data dependencies before deletion
- Finding all tables affected by schema changes
- Identifying potential circular dependencies
- Planning data migration or cleanup operations
- Documenting database structure

---

## CRUD Tools

### sqlite_insert

Insert a single record into a table.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `table` | string | Yes | Table name to insert into |
| `data` | object | Yes | Data to insert as key-value pairs |

**Required Permission:** `create`

**Example:**
```json
{
  "table": "users",
  "data": {
    "name": "John Doe",
    "email": "john@example.com",
    "age": 30
  }
}
```

**Response:**
```json
{
  "success": true,
  "lastInsertRowid": 42,
  "rowsAffected": 1,
  "executionTime": 3
}
```

---

### sqlite_update

Update existing records in a table.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `table` | string | Yes | Table name to update |
| `data` | object | Yes | Data to update as key-value pairs |
| `where` | object | Yes | WHERE conditions as key-value pairs |

**Required Permission:** `update`

**Example:**
```json
{
  "table": "users",
  "data": {
    "email": "newemail@example.com",
    "updated_at": "2024-01-15"
  },
  "where": {
    "id": 42
  }
}
```

**Response:**
```json
{
  "success": true,
  "rowsAffected": 1,
  "executionTime": 2
}
```

---

### sqlite_delete

Delete records from a table.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `table` | string | Yes | Table name to delete from |
| `where` | object | Yes | WHERE conditions as key-value pairs |

**Required Permission:** `delete`

**Example:**
```json
{
  "table": "users",
  "where": {
    "id": 42
  }
}
```

**Response:**
```json
{
  "success": true,
  "rowsAffected": 1,
  "executionTime": 2
}
```

---

## Bulk Operation Tools

### sqlite_bulk_insert

Perform bulk insert operations with relational data support and progress tracking.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `mainTable` | string | Yes | Main table name to insert into |
| `records` | array | Yes | Array of records to insert |
| `relatedData` | object | No | Related table data with foreign key mappings |
| `options` | object | No | Bulk insert options (see below) |

**Options:**
| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `batchSize` | number | 1000 | Records per batch |
| `continueOnError` | boolean | false | Continue on errors |
| `validateForeignKeys` | boolean | true | Validate FK constraints |
| `insertRelatedData` | boolean | true | Insert related data first |

**Required Permission:** `create`

**Example - Simple bulk insert:**
```json
{
  "mainTable": "users",
  "records": [
    {"name": "Alice", "email": "alice@example.com"},
    {"name": "Bob", "email": "bob@example.com"},
    {"name": "Charlie", "email": "charlie@example.com"}
  ],
  "options": {
    "batchSize": 100,
    "continueOnError": true
  }
}
```

**Example - With relational data:**
```json
{
  "mainTable": "posts",
  "records": [
    {"title": "Post 1", "content": "Content 1", "user_id": 1},
    {"title": "Post 2", "content": "Content 2", "user_id": 2}
  ],
  "relatedData": {
    "users": {
      "records": [
        {"id": 1, "name": "John", "email": "john@example.com"},
        {"id": 2, "name": "Jane", "email": "jane@example.com"}
      ],
      "foreignKeyMappings": {
        "user_id": {
          "referencedTable": "users",
          "referencedColumn": "id"
        }
      }
    }
  },
  "options": {
    "insertRelatedData": true,
    "validateForeignKeys": true
  }
}
```

**Response:**
```json
{
  "success": true,
  "executionTime": 150,
  "summary": {
    "totalRecords": 100,
    "successfulRecords": 98,
    "failedRecords": 2,
    "affectedTables": ["users", "posts"]
  },
  "progress": {
    "totalBatches": 1,
    "processedRecords": 100,
    "errors": [...]
  }
}
```

---

### sqlite_bulk_update

Perform bulk update operations with progress tracking.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `table` | string | Yes | Table name to update |
| `updates` | array | Yes | Array of update operations |
| `options` | object | No | Bulk update options |

**Update Object Structure:**
```json
{
  "data": {"column": "value"},
  "where": {"id": 1}
}
```

**Options:**
| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `batchSize` | number | 1000 | Updates per batch |
| `continueOnError` | boolean | false | Continue on errors |
| `validateForeignKeys` | boolean | true | Validate FK constraints |

**Required Permission:** `update`

**Example:**
```json
{
  "table": "users",
  "updates": [
    {
      "data": {"status": "active", "verified": true},
      "where": {"id": 1}
    },
    {
      "data": {"status": "active", "verified": true},
      "where": {"id": 2}
    },
    {
      "data": {"status": "inactive"},
      "where": {"last_login": null}
    }
  ],
  "options": {
    "batchSize": 50,
    "continueOnError": true
  }
}
```

**Response:**
```json
{
  "success": true,
  "executionTime": 45,
  "summary": {
    "totalRecords": 3,
    "successfulRecords": 3,
    "failedRecords": 0
  }
}
```

---

### sqlite_bulk_delete

Perform bulk delete operations with cascading support.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `table` | string | Yes | Table name to delete from |
| `conditions` | array | Yes | Array of WHERE conditions |
| `options` | object | No | Bulk delete options |

**Options:**
| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `batchSize` | number | 1000 | Deletes per batch |
| `continueOnError` | boolean | false | Continue on errors |
| `cascadeDelete` | boolean | true | Enable cascade delete |

**Required Permission:** `delete`

**Example:**
```json
{
  "table": "posts",
  "conditions": [
    {"id": 1},
    {"id": 2},
    {"status": "deleted"}
  ],
  "options": {
    "batchSize": 50,
    "cascadeDelete": true
  }
}
```

**Response:**
```json
{
  "success": true,
  "executionTime": 30,
  "summary": {
    "totalRecords": 3,
    "successfulRecords": 3,
    "failedRecords": 0,
    "affectedTables": ["posts", "comments"]
  }
}
```

---

## Schema Management Tools

### sqlite_ddl

Execute DDL (Data Definition Language) operations for schema management.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `operation` | string | Yes | DDL operation type |
| `table` | string | Yes | Table name |
| `columns` | array | No | Column definitions (for create_table) |
| `alterAction` | object | No | Alter action details |
| `index` | object | No | Index definition |
| `ifNotExists` | boolean | No | Add IF NOT EXISTS clause |
| `ifExists` | boolean | No | Add IF EXISTS clause |

**Operations:** `create_table`, `drop_table`, `alter_table`, `create_index`, `drop_index`

**Required Permission:** `ddl`

#### Create Table

**Column Definition Options:**
| Property | Type | Description |
|----------|------|-------------|
| `name` | string | Column name |
| `type` | string | Data type (TEXT, INTEGER, REAL, BLOB) |
| `primaryKey` | boolean | Is primary key |
| `autoIncrement` | boolean | Auto increment (INTEGER PRIMARY KEY only) |
| `notNull` | boolean | NOT NULL constraint |
| `unique` | boolean | UNIQUE constraint |
| `defaultValue` | string | Default value |
| `foreignKey` | object | Foreign key reference |

**Example:**
```json
{
  "operation": "create_table",
  "table": "users",
  "columns": [
    {
      "name": "id",
      "type": "INTEGER",
      "primaryKey": true,
      "autoIncrement": true
    },
    {
      "name": "name",
      "type": "TEXT",
      "notNull": true
    },
    {
      "name": "email",
      "type": "TEXT",
      "unique": true
    },
    {
      "name": "department_id",
      "type": "INTEGER",
      "foreignKey": {
        "table": "departments",
        "column": "id",
        "onDelete": "CASCADE",
        "onUpdate": "CASCADE"
      }
    },
    {
      "name": "created_at",
      "type": "TEXT",
      "defaultValue": "CURRENT_TIMESTAMP"
    }
  ],
  "ifNotExists": true
}
```

#### Drop Table

```json
{
  "operation": "drop_table",
  "table": "old_users",
  "ifExists": true
}
```

#### Alter Table

**Add Column:**
```json
{
  "operation": "alter_table",
  "table": "users",
  "alterAction": {
    "action": "add_column",
    "column": {
      "name": "phone",
      "type": "TEXT"
    }
  }
}
```

**Rename Table:**
```json
{
  "operation": "alter_table",
  "table": "users",
  "alterAction": {
    "action": "rename_table",
    "newName": "app_users"
  }
}
```

**Rename Column:**
```json
{
  "operation": "alter_table",
  "table": "users",
  "alterAction": {
    "action": "rename_column",
    "oldColumnName": "name",
    "newName": "full_name"
  }
}
```

#### Create Index

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

**Composite Index:**
```json
{
  "operation": "create_index",
  "table": "orders",
  "index": {
    "name": "idx_orders_user_date",
    "columns": ["user_id", "order_date"],
    "unique": false
  }
}
```

#### Drop Index

```json
{
  "operation": "drop_index",
  "table": "users",
  "index": {
    "name": "idx_users_email"
  },
  "ifExists": true
}
```

---

## Database Operation Tools

### sqlite_transaction

Execute multiple queries within a single atomic transaction.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `queries` | array | Yes | Array of query objects |

**Query Object Structure:**
```json
{
  "query": "SQL statement",
  "parameters": ["param1", "param2"]
}
```

**Required Permission:** `transaction` + permissions for individual operations

**Example - Transfer funds:**
```json
{
  "queries": [
    {
      "query": "UPDATE accounts SET balance = balance - ? WHERE id = ?",
      "parameters": [100, 1]
    },
    {
      "query": "UPDATE accounts SET balance = balance + ? WHERE id = ?",
      "parameters": [100, 2]
    },
    {
      "query": "INSERT INTO transactions (from_id, to_id, amount, created_at) VALUES (?, ?, ?, ?)",
      "parameters": [1, 2, 100, "2024-01-15"]
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "results": [
    {"changes": 1},
    {"changes": 1},
    {"changes": 1, "lastInsertRowid": 42}
  ],
  "executionTime": 15
}
```

> **Note:** If any query fails, the entire transaction is rolled back.

---

### sqlite_backup

Create a backup of the database.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `path` | string | Yes | Backup file path |

**Required Permission:** `utility`

**Example:**
```json
{
  "path": "/backups/mydb_2024-01-15.sqlite"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Database backed up to /backups/mydb_2024-01-15.sqlite",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

---

## Error Handling

All tools return consistent error responses:

```json
{
  "success": false,
  "error": "Error message describing what went wrong"
}
```

**Common Error Types:**
- Permission denied - Missing required permission
- Validation error - Invalid parameters or SQL
- Execution error - Database operation failed
- Connection error - Database connection issue

---

## Best Practices

1. **Use Parameterized Queries** - Always use parameters instead of string concatenation
2. **Batch Large Operations** - Use bulk tools with appropriate batch sizes
3. **Handle Errors** - Check `success` field and handle errors appropriately
4. **Use Transactions** - Wrap related operations in transactions for data integrity
5. **Limit Permissions** - Only request necessary permissions

---

**See Also:** [README.md](README.md) | [CHANGELOG.md](CHANGELOG.md) | [ENHANCEMENTS.md](ENHANCEMENTS.md)
