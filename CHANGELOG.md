# Changelog

All notable changes to this project will be documented in this file.

## [1.1.3] - 2024-12-20

### Added
- **Comprehensive Integration Guide**: Detailed setup instructions for multiple MCP clients
  - Claude Desktop (macOS, Windows, Linux)
  - Cursor IDE (global and project-specific)
  - Continue.dev
  - Cline (VS Code Extension)
  - Windsurf IDE
  - Generic MCP client configuration
- **Tools Summary Table**: Quick reference table listing all 12 tools with descriptions
- **Tool Categories**: Organized tools by functionality (Query, CRUD, Bulk, Schema, Operations)
- **Table of Contents**: Added navigation for easier documentation browsing
- **Quick Start Section**: 30-second setup guide for new users
- **Multiple Database Configuration**: Example for configuring multiple SQLite databases

### Changed
- Enhanced README.md with better formatting and organization
- Updated badges with npm version and MIT license

## [1.1.2] - 2024-12-20

### Added
- **DDL Tool** (`sqlite_ddl`): New dedicated tool for schema management operations
  - CREATE TABLE with full column definition support (primary key, auto-increment, foreign keys, constraints)
  - DROP TABLE with IF EXISTS support
  - ALTER TABLE (add column, rename table, rename column)
  - CREATE INDEX (unique and non-unique indexes)
  - DROP INDEX with IF EXISTS support
- **Procedure Permission**: Added `procedure` permission type for future compatibility (N/A for SQLite)

### Changed
- Updated ENHANCEMENTS.md with proper markdown formatting and status tracking

## [1.1.1] - 2024-12-XX

### Added
- **Bulk Operations**: Advanced bulk insert, update, and delete operations with progress tracking
- **Relational Data Support**: Bulk insert with foreign key mappings and related table data
- **Progress Tracking**: Real-time progress monitoring for bulk operations with error handling
- **Performance Optimization**: Batch processing with configurable batch sizes for large datasets
- **Enhanced Error Handling**: Improved error reporting and continue-on-error options

## [1.0.1] - 2024-XX-XX

### Added
- Database and directory auto-creation functionality
- Enhanced initialization logging with database status
- Comprehensive roadmap for future development

### Fixed
- Minor improvements and stability enhancements

## [1.0.0] - 2024-XX-XX

### Added
- Initial release
- Full MCP protocol implementation
- Comprehensive 9-tier permission system
- Security features including SQL injection protection
- Audit logging for compliance
- CLI interface with schema introspection
- Connection pooling and performance optimization
