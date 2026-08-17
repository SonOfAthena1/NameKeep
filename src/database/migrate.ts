import type { SQLiteDatabase } from 'expo-sqlite';

const DATABASE_VERSION = 1;

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

  await db.withExclusiveTransactionAsync(async (transaction) => {
    if (currentVersion === 0) {
      await transaction.execAsync(`
        CREATE TABLE labels (
          id TEXT PRIMARY KEY NOT NULL,
          name TEXT NOT NULL,
          created_at INTEGER NOT NULL
        );

        CREATE TABLE people (
          id TEXT PRIMARY KEY NOT NULL,
          name TEXT NOT NULL,
          description TEXT NOT NULL DEFAULT '',
          label_id TEXT NOT NULL,
          created_at INTEGER NOT NULL,
          FOREIGN KEY (label_id) REFERENCES labels(id) ON DELETE RESTRICT
        );

        CREATE INDEX labels_created_at_idx
          ON labels(created_at DESC);

        CREATE INDEX people_label_created_at_idx
          ON people(label_id, created_at DESC);
      `);
    }

    await transaction.execAsync(`PRAGMA user_version = ${DATABASE_VERSION}`);
  });
}
