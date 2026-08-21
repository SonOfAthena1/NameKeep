import type { SQLiteDatabase } from 'expo-sqlite';

import { withWriteTransaction } from '@/database/transactions';

const DATABASE_VERSION = 7;

export async function migrateDatabase(db: SQLiteDatabase): Promise<void> {
  await db.execAsync(`
    PRAGMA foreign_keys = ON;
    PRAGMA journal_mode = WAL;
  `);

  const result = await db.getFirstAsync<{ user_version: number }>(
    'PRAGMA user_version',
  );
  const currentVersion = result?.user_version ?? 0;

  if (currentVersion > DATABASE_VERSION) {
    throw new Error(
      `Database version ${currentVersion} is newer than supported version ${DATABASE_VERSION}.`,
    );
  }

  if (currentVersion === DATABASE_VERSION) {
    return;
  }

  await withWriteTransaction(db, async (db) => {
    if (currentVersion === 0) {
      await db.execAsync(`
        CREATE TABLE labels (
          id TEXT PRIMARY KEY NOT NULL,
          name TEXT NOT NULL,
          color TEXT NOT NULL DEFAULT 'green',
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL,
          deleted_at INTEGER
        );

        CREATE TABLE people (
          id TEXT PRIMARY KEY NOT NULL,
          name TEXT NOT NULL,
          description TEXT NOT NULL DEFAULT '',
          label_id TEXT,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL,
          deleted_at INTEGER,
          FOREIGN KEY (label_id) REFERENCES labels(id) ON DELETE RESTRICT
        );

        CREATE INDEX labels_active_created_at_idx
          ON labels(created_at DESC)
          WHERE deleted_at IS NULL;

        CREATE INDEX people_active_label_created_at_idx
          ON people(label_id, created_at DESC)
          WHERE deleted_at IS NULL;

        CREATE INDEX people_deleted_at_idx
          ON people(deleted_at DESC)
          WHERE deleted_at IS NOT NULL;

        CREATE TABLE app_settings (
          id INTEGER PRIMARY KEY NOT NULL CHECK (id = 1),
          theme_preference TEXT NOT NULL DEFAULT 'light'
            CHECK (theme_preference IN ('system', 'light', 'dark')),
          default_label_color TEXT NOT NULL DEFAULT 'green'
            CHECK (default_label_color IN (
              'green', 'blue', 'violet', 'pink', 'red',
              'orange', 'amber', 'teal', 'gray'
            )),
          default_label_id TEXT,
          label_sort_order TEXT NOT NULL DEFAULT 'newest'
            CHECK (label_sort_order IN ('newest', 'oldest', 'alphabetical')),
          people_sort_order TEXT NOT NULL DEFAULT 'newest'
            CHECK (people_sort_order IN ('newest', 'oldest', 'alphabetical')),
          show_date INTEGER NOT NULL DEFAULT 0 CHECK (show_date IN (0, 1)),
          condensed_view INTEGER NOT NULL DEFAULT 0
            CHECK (condensed_view IN (0, 1)),
          memory_reminder_intervals TEXT NOT NULL DEFAULT '[]',
          updated_at INTEGER NOT NULL,
          FOREIGN KEY (default_label_id) REFERENCES labels(id) ON DELETE SET NULL
        );

        INSERT INTO app_settings (
          id,
          theme_preference,
          default_label_color,
          default_label_id,
          label_sort_order,
          people_sort_order,
          show_date,
          condensed_view,
          memory_reminder_intervals,
          updated_at
        ) VALUES (
          1,
          'light',
          'green',
          NULL,
          'newest',
          'newest',
          0,
          0,
          '[]',
          CAST(strftime('%s', 'now') AS INTEGER) * 1000
        );
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

    if (currentVersion === 1 || currentVersion === 2) {
      await db.execAsync(`
        ALTER TABLE labels
          ADD COLUMN color TEXT NOT NULL DEFAULT 'green';
      `);
    }

    if (currentVersion > 0 && currentVersion < 4) {
      await db.execAsync(`
        ALTER TABLE labels
          ADD COLUMN updated_at INTEGER NOT NULL DEFAULT 0;
        ALTER TABLE labels
          ADD COLUMN deleted_at INTEGER;

        ALTER TABLE people
          ADD COLUMN updated_at INTEGER NOT NULL DEFAULT 0;
        ALTER TABLE people
          ADD COLUMN deleted_at INTEGER;

        UPDATE labels
          SET updated_at = created_at
          WHERE updated_at = 0;
        UPDATE people
          SET updated_at = created_at
          WHERE updated_at = 0;

        DROP INDEX labels_created_at_idx;
        DROP INDEX people_label_created_at_idx;

        CREATE INDEX labels_active_created_at_idx
          ON labels(created_at DESC)
          WHERE deleted_at IS NULL;

        CREATE INDEX people_active_label_created_at_idx
          ON people(label_id, created_at DESC)
          WHERE deleted_at IS NULL;

        CREATE INDEX people_deleted_at_idx
          ON people(deleted_at DESC)
          WHERE deleted_at IS NOT NULL;

        CREATE TABLE app_settings (
          id INTEGER PRIMARY KEY NOT NULL CHECK (id = 1),
          theme_preference TEXT NOT NULL DEFAULT 'light'
            CHECK (theme_preference IN ('system', 'light', 'dark')),
          default_label_color TEXT NOT NULL DEFAULT 'green'
            CHECK (default_label_color IN (
              'green', 'blue', 'violet', 'pink', 'red',
              'orange', 'amber', 'teal', 'gray'
            )),
          default_label_id TEXT,
          label_sort_order TEXT NOT NULL DEFAULT 'newest'
            CHECK (label_sort_order IN ('newest', 'oldest', 'alphabetical')),
          people_sort_order TEXT NOT NULL DEFAULT 'newest'
            CHECK (people_sort_order IN ('newest', 'oldest', 'alphabetical')),
          show_date INTEGER NOT NULL DEFAULT 0 CHECK (show_date IN (0, 1)),
          condensed_view INTEGER NOT NULL DEFAULT 0
            CHECK (condensed_view IN (0, 1)),
          memory_reminder_intervals TEXT NOT NULL DEFAULT '[]',
          updated_at INTEGER NOT NULL,
          FOREIGN KEY (default_label_id) REFERENCES labels(id) ON DELETE SET NULL
        );

        INSERT INTO app_settings (
          id,
          theme_preference,
          default_label_color,
          default_label_id,
          label_sort_order,
          people_sort_order,
          show_date,
          condensed_view,
          memory_reminder_intervals,
          updated_at
        ) VALUES (
          1,
          'light',
          'green',
          NULL,
          'newest',
          'newest',
          0,
          0,
          '[]',
          CAST(strftime('%s', 'now') AS INTEGER) * 1000
        );
      `);
    }

    if (currentVersion === 4) {
      await db.execAsync(`
        ALTER TABLE app_settings
          ADD COLUMN memory_reminder_intervals TEXT NOT NULL DEFAULT '[]';
      `);
    }

    if (currentVersion === 6) {
      // Version 6 temporarily made blue the default label color. Restore the
      // original green default without changing any existing label colors.
      await db.runAsync(
        `UPDATE app_settings
          SET default_label_color = 'green',
              updated_at = $updatedAt
          WHERE id = 1`,
        { $updatedAt: Date.now() },
      );
    }

    await db.execAsync(`PRAGMA user_version = ${DATABASE_VERSION}`);
  });
}
