/**
 * Type definitions for SQLite MCP Server
 */

export type PermissionType = 
  | 'list'      // List tables and schemas
  | 'read'      // SELECT queries
  | 'create'    // INSERT queries
  | 'update'    // UPDATE queries
  | 'delete'    // DELETE queries
  | 'execute'   // Execute stored procedures/functions
  | 'ddl'       // Data Definition Language (CREATE, ALTER, DROP)
  | 'transaction' // Transaction control (BEGIN, COMMIT, ROLLBACK)
  | 'utility';   // Utility operations (VACUUM, ANALYZE, etc.)

export interface DatabaseConfig {
  path: string;
  maxConnections?: number;
  timeout?: number;
  readOnly?: boolean;
  enableWAL?: boolean;
  busyTimeout?: number;
}

export interface ClientConfig {
  clientId: string;
  clientName: string;
  connectionString: string;
  permissions: PermissionType[];
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface QueryResult {
  success: boolean;
  data?: any[];
  rowsAffected?: number;
  lastInsertRowid?: number;
  error?: string;
  executionTime: number;
}

export interface AuditLogEntry {
  logId: string;
  clientId: string;
  operationType: string;
  queryHash: string;
  resultStatus: 'success' | 'error' | 'denied';
  executedAt: Date;
  executionTimeMs: number;
  errorMessage?: string;
}

export interface SchemaInfo {
  tables: TableInfo[];
  views: ViewInfo[];
  indexes: IndexInfo[];
  triggers: TriggerInfo[];
}

export interface TableInfo {
  name: string;
  type: 'table' | 'view';
  columns: ColumnInfo[];
  primaryKey?: string[];
  foreignKeys?: ForeignKeyInfo[];
  indexes?: string[];
}

export interface ColumnInfo {
  name: string;
  type: string;
  nullable: boolean;
  defaultValue?: any;
  primaryKey: boolean;
  autoIncrement: boolean;
}

export interface ViewInfo {
  name: string;
  definition: string;
  columns: ColumnInfo[];
}

export interface IndexInfo {
  name: string;
  tableName: string;
  columns: string[];
  unique: boolean;
  partial: boolean;
}

export interface TriggerInfo {
  name: string;
  tableName: string;
  event: 'INSERT' | 'UPDATE' | 'DELETE';
  timing: 'BEFORE' | 'AFTER' | 'INSTEAD OF';
  definition: string;
}

export interface ForeignKeyInfo {
  columnName: string;
  referencedTable: string;
  referencedColumn: string;
  onUpdate: string;
  onDelete: string;
}

export interface ConnectionPoolStats {
  totalConnections: number;
  activeConnections: number;
  idleConnections: number;
  waitingRequests: number;
}

export interface PerformanceMetrics {
  totalQueries: number;
  successfulQueries: number;
  failedQueries: number;
  averageExecutionTime: number;
  slowQueries: number;
  connectionPoolStats: ConnectionPoolStats;
}

export interface ServerConfig {
  database: DatabaseConfig;
  security: {
    enableAuditLogging: boolean;
    maxQueryLength: number;
    allowedOperations?: PermissionType[];
    rateLimitRequests?: number;
    rateLimitWindow?: number;
    queryTimeout?: number;
    rateLimitPerMinute?: number;
  };
  logging: {
    level: 'error' | 'warn' | 'info' | 'debug';
    file?: string;
    console?: boolean;
    enableConsole?: boolean;
    enableFile?: boolean;
  };
}

export interface MCPToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };
  requiredPermissions?: PermissionType[];
}

export interface QueryValidationResult {
  isValid: boolean;
  sanitizedQuery?: string;
  parameters?: any[];
  errors?: string[];
  reason?: string;
  detectedOperations: string[];
  requiredPermissions: PermissionType[];
}

// Bulk Operations Types
export interface BulkOperationProgress {
  totalRecords: number;
  processedRecords: number;
  successfulRecords: number;
  failedRecords: number;
  currentBatch: number;
  totalBatches: number;
  startTime: Date;
  estimatedTimeRemaining?: number;
  errors: BulkOperationError[];
}

export interface BulkOperationError {
  recordIndex: number;
  record: any;
  error: string;
  timestamp: Date;
}

export interface BulkOperationResult {
  success: boolean;
  progress: BulkOperationProgress;
  executionTime: number;
  summary: {
    totalRecords: number;
    successfulRecords: number;
    failedRecords: number;
    affectedTables: string[];
  };
}

export interface BulkInsertOptions {
  batchSize?: number;
  continueOnError?: boolean;
  validateForeignKeys?: boolean;
  insertRelatedData?: boolean;
  progressCallback?: (progress: BulkOperationProgress) => void;
}

export interface BulkUpdateOptions {
  batchSize?: number;
  continueOnError?: boolean;
  validateForeignKeys?: boolean;
  progressCallback?: (progress: BulkOperationProgress) => void;
}

export interface BulkDeleteOptions {
  batchSize?: number;
  continueOnError?: boolean;
  cascadeDelete?: boolean;
  progressCallback?: (progress: BulkOperationProgress) => void;
}

export interface RelationalDataMap {
  [tableName: string]: {
    records: any[];
    foreignKeyMappings: {
      [localColumn: string]: {
        referencedTable: string;
        referencedColumn: string;
        valueMapping?: Map<any, any>; // Maps original values to inserted IDs
      };
    };
  };
}

export interface BulkInsertData {
  mainTable: string;
  records: any[];
  relatedData?: RelationalDataMap;
  options?: BulkInsertOptions;
}

export interface BulkUpdateData {
  table: string;
  updates: Array<{
    data: any;
    where: any;
  }>;
  options?: BulkUpdateOptions;
}

export interface BulkDeleteData {
  table: string;
  conditions: any[];
  options?: BulkDeleteOptions;
}