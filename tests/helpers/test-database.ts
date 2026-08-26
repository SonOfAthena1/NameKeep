import { DatabaseSync } from 'node:sqlite';

import type { SQLiteDatabase } from 'expo-sqlite';

type SqlParameters = Record<string, string | number | null>;

/** Minimal Expo SQLite-compatible wrapper backed by Node's in-memory SQLite. */
export class TestDatabase {
  private readonly database = new DatabaseSync(':memory:');

  asExpoDatabase(): SQLiteDatabase {
    return this as unknown as SQLiteDatabase;
  }

  async execAsync(sql: string): Promise<void> {
    this.database.exec(sql);
  }

  async getFirstAsync<T>(
    sql: string,
    parameters: SqlParameters = {},
  ): Promise<T | null> {
    return (this.database.prepare(sql).get(parameters) as T | undefined) ?? null;
  }

  async getAllAsync<T>(
    sql: string,
    parameters: SqlParameters = {},
  ): Promise<T[]> {
    return this.database.prepare(sql).all(parameters) as T[];
  }

  async runAsync(
    sql: string,
    parameters: SqlParameters = {},
  ): Promise<{ changes: number; lastInsertRowId: number }> {
    const result = this.database.prepare(sql).run(parameters);
    return {
      changes: Number(result.changes),
      lastInsertRowId: Number(result.lastInsertRowid),
    };
  }

  async withExclusiveTransactionAsync(
    task: (database: SQLiteDatabase) => Promise<void>,
  ): Promise<void> {
    this.database.exec('BEGIN IMMEDIATE');
    try {
      await task(this.asExpoDatabase());
      this.database.exec('COMMIT');
    } catch (error) {
      this.database.exec('ROLLBACK');
      throw error;
    }
  }

  async withTransactionAsync(task: () => Promise<void>): Promise<void> {
    this.database.exec('BEGIN');
    try {
      await task();
      this.database.exec('COMMIT');
    } catch (error) {
      this.database.exec('ROLLBACK');
      throw error;
    }
  }

  close(): void {
    this.database.close();
  }
}
