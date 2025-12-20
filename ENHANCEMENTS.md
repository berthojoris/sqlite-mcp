# SQLite MCP Server - Feature Enhancements

## Permissions

| Permission | Operations | Use Case | Status |
|------------|------------|----------|--------|
| `list` | List databases, tables, schemas | Database exploration | ✅ Completed |
| `read` | SELECT queries, read data | Analytics, reporting | ✅ Completed |
| `create` | INSERT new records | Data entry | ✅ Completed |
| `update` | UPDATE existing records | Data maintenance | ✅ Completed |
| `delete` | DELETE records | Data cleanup | ✅ Completed |
| `execute` | Execute custom SQL (DML) + Advanced SQL | Complex operations | ✅ Completed |
| `ddl` | CREATE/ALTER/DROP tables | Schema management | ✅ Completed |
| `procedure` | Stored procedures (CREATE/DROP/EXECUTE) | Procedure management | ⚠️ N/A (SQLite limitation) |
| `transaction` | BEGIN, COMMIT, ROLLBACK | ACID operations | ✅ Completed |
| `utility` | Connection testing, diagnostics | Troubleshooting | ✅ Completed |

## Notes

- **procedure**: SQLite does not support native stored procedures like MySQL/PostgreSQL. User-defined functions can be created via the `better-sqlite3` library but are not exposed as MCP tools due to security implications.