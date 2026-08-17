import type { SQLiteDatabase } from 'expo-sqlite';

const DATABASE_VERSION = 2;

export async function migrateDatabase(db: SQLiteDatabase): Promise<void> {
  await db.execAsync(`
    PRAGMA foreign_keys = ON;
    PRAGMA journal_mode = WAL;
  `);

  const result = await db.getFirstAsync<{ user_version: number }>(
    'PRAGMA user_version',
  );
  const currentVersion = result?.user_version ?? 0;

  if (currentVersion >= DATABASE_VERSION) {
    return;
  }

  await db.withTransactionAsync(async () => {
    if (currentVersion === 0) {
      await db.execAsync(`
        CREATE TABLE labels (
          id TEXT PRIMARY KEY NOT NULL,
          name TEXT NOT NULL,
          created_at INTEGER NOT NULL
        );

        CREATE TABLE people (
          id TEXT PRIMARY KEY NOT NULL,
          name TEXT NOT NULL,
          description TEXT NOT NULL DEFAULT '',
          label_id TEXT,
          created_at INTEGER NOT NULL,
          FOREIGN KEY (label_id) REFERENCES labels(id) ON DELETE RESTRICT
        );

        CREATE INDEX labels_created_at_idx
          ON labels(created_at DESC);

        CREATE INDEX people_label_created_at_idx
          ON people(label_id, created_at DESC);
      `);
    }

    if (currentVersion === 1) {
      await db.execAsync(`
        DROP INDEX people_label_created_at_idx;
        ALTER TABLE people RENAME TO people_v1;

        CREATE TABLE people (
          id TEXT PRIMARY KEY NOT NULL,
          name TEXT NOT NULL,
          description TEXT NOT NULL DEFAULT '',
          label_id TEXT,
          created_at INTEGER NOT NULL,
          FOREIGN KEY (label_id) REFERENCES labels(id) ON DELETE RESTRICT
        );

        INSERT INTO people (id, name, description, label_id, created_at)
          SELECT id, name, description, label_id, created_at
          FROM people_v1;

        DROP TABLE people_v1;

        CREATE INDEX people_label_created_at_idx
          ON people(label_id, created_at DESC);
      `);
    }

    await db.execAsync(`PRAGMA user_version = ${DATABASE_VERSION}`);
  });
}
