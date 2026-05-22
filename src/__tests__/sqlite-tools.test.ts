import { createLogger, transports } from 'winston';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { DatabaseManager } from '../database';
import { DatabaseConfig } from '../types';

const logger = createLogger({
  silent: true,
  transports: [new transports.Console()]
});

const tempDbPaths: string[] = [];

const createManager = async (): Promise<DatabaseManager> => {
  DatabaseManager.clearAllInstances();
  const dbPath = path.join(os.tmpdir(), `mcp-sqlite-test-${Date.now()}-${Math.random().toString(16).slice(2)}.sqlite`);
  tempDbPaths.push(dbPath);

  const config: DatabaseConfig = {
    path: dbPath,
    maxConnections: 1,
    enableWAL: false,
    readOnly: false
  };
  const manager = DatabaseManager.getInstance(config, logger);
  await manager.initialize();
  const createResult = manager.executeQuery(
    'CREATE TABLE users (id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT UNIQUE NOT NULL, name TEXT, active INTEGER DEFAULT 1)',
    [],
    'test'
  );

  expect(createResult.success).toBe(true);
  return manager;
};

afterEach(() => {
  DatabaseManager.clearAllInstances();
  for (const dbPath of tempDbPaths.splice(0)) {
    for (const filePath of [dbPath, `${dbPath}-wal`, `${dbPath}-shm`]) {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }
  }
});

describe('SQLite management tools', () => {
  it('supports upsert records through ON CONFLICT', async () => {
    const manager = await createManager();

    const insertResult = manager.upsertRecord(
      'users',
      { email: 'ada@example.com', name: 'Ada' },
      ['email'],
      ['name'],
      'test'
    );
    const updateResult = manager.upsertRecord(
      'users',
      { email: 'ada@example.com', name: 'Ada Lovelace' },
      ['email'],
      ['name'],
      'test'
    );
    const queryResult = manager.executeQuery(
      'SELECT name FROM users WHERE email = ?',
      ['ada@example.com'],
      'test'
    );

    expect(insertResult.success).toBe(true);
    expect(updateResult.success).toBe(true);
    expect(queryResult.data?.[0].name).toBe('Ada Lovelace');
  });

  it('supports pragma, integrity, foreign key, explain, and table inspection helpers', async () => {
    const manager = await createManager();
    manager.upsertRecord('users', { email: 'grace@example.com', name: 'Grace' }, ['email'], ['name'], 'test');

    const pragmas = manager.managePragma('list');
    const integrity = manager.runIntegrityCheck('quick', 10);
    const foreignKeys = manager.runForeignKeyCheck();
    const plan = manager.explainQueryPlan('SELECT * FROM users WHERE email = ?', ['grace@example.com']);
    const table = manager.inspectTable('users', 1);

    expect(pragmas.data.some((pragma: { name: string }) => pragma.name === 'foreign_keys')).toBe(true);
    expect(integrity.ok).toBe(true);
    expect(foreignKeys.ok).toBe(true);
    expect(plan.plan.length).toBeGreaterThan(0);
    expect(table.rowCount).toBe(1);
    expect(table.columns.some((column: { name: string }) => column.name === 'email')).toBe(true);
    expect(table.sampleRows).toHaveLength(1);
  });
});
