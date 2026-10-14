import type { SQLiteDatabase } from 'expo-sqlite';

import {
  deleteUnusedDeletedLabels,
  listActiveLabels,
} from '@/database/labels-repository';
import { withWriteTransaction } from '@/database/transactions';
import type {
  StoredLabel,
  StoredPerson,
  StoredTrashedPerson,
} from '@/database/types';
import { normalizeLabelName } from '@/lib/label-names';

type PersonRow = {
  id: string;
  name: string;
  description: string;
  label_id: string | null;
  created_at: number;
  updated_at: number;
  deleted_at: number | null;
};

export type CreatePersonInput = {
  id: string;
  name: string;
  description: string;
  labelId: string | null;
  createdAt?: number;
};

export type UpdatePersonInput = {
  name: string;
  description: string;
  labelId: string | null;
};

const PERSON_COLUMNS = `
  id,
  name,
  description,
  label_id,
  created_at,
  updated_at,
  deleted_at
`;

/** Changes database-style person fields into the shape used by the app. */
function mapPerson(row: PersonRow): StoredPerson {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    labelId: row.label_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}

/** Gets every person that has not been moved to Trash. */
export async function listActivePeople(
  db: SQLiteDatabase,
): Promise<StoredPerson[]> {
  const rows = await db.getAllAsync<PersonRow>(`
    SELECT ${PERSON_COLUMNS}
    FROM people
    WHERE deleted_at IS NULL
    ORDER BY created_at DESC
  `);
  return rows.map(mapPerson);
}

/** Finds one person, as long as they are not in Trash. */
export async function getActivePerson(
  db: SQLiteDatabase,
  id: string,
): Promise<StoredPerson | null> {
  const row = await db.getFirstAsync<PersonRow>(`
    SELECT ${PERSON_COLUMNS}
    FROM people
    WHERE id = $id
      AND deleted_at IS NULL
  `, { $id: id });
  return row ? mapPerson(row) : null;
}

/** Gets the people in Trash, newest deletion first. */
export async function listTrashedPeople(
  db: SQLiteDatabase,
): Promise<StoredTrashedPerson[]> {
  const rows = await db.getAllAsync<PersonRow>(`
    SELECT ${PERSON_COLUMNS}
    FROM people
    WHERE deleted_at IS NOT NULL
    ORDER BY deleted_at DESC
  `);
  return rows.map((row) => {
    const person = mapPerson(row);
    if (person.deletedAt === null) {
      throw new Error(`Trashed person ${person.id} has no deletion timestamp.`);
    }
    return { ...person, deletedAt: person.deletedAt };
  });
}

/** Saves a new person and returns the saved record. */
export async function createPerson(
  db: SQLiteDatabase,
  input: CreatePersonInput,
): Promise<StoredPerson> {
  const createdAt = input.createdAt ?? Date.now();
  const person: StoredPerson = {
    id: input.id,
    name: input.name,
    description: input.description,
    labelId: input.labelId,
    createdAt,
    updatedAt: createdAt,
    deletedAt: null,
  };

  await db.runAsync(
    `INSERT INTO people (
      id,
      name,
      description,
      label_id,
      created_at,
      updated_at,
      deleted_at
    ) VALUES (
      $id,
      $name,
      $description,
      $labelId,
      $createdAt,
      $updatedAt,
      NULL
    )`,
    {
      $id: person.id,
      $name: person.name,
      $description: person.description,
      $labelId: person.labelId,
      $createdAt: person.createdAt,
      $updatedAt: person.updatedAt,
    },
  );

  return person;
}

/** Updates a saved person's details. Returns false when they are not active. */
export async function updatePerson(
  db: SQLiteDatabase,
  id: string,
  input: UpdatePersonInput,
  updatedAt = Date.now(),
): Promise<boolean> {
  const result = await db.runAsync(
    `UPDATE people
      SET name = $name,
          description = $description,
          label_id = $labelId,
          updated_at = $updatedAt
      WHERE id = $id
        AND deleted_at IS NULL`,
    {
      $id: id,
      $name: input.name,
      $description: input.description,
      $labelId: input.labelId,
      $updatedAt: updatedAt,
    },
  );
  return result.changes > 0;
}

/** Moves an active person to Trash. */
export async function movePersonToTrash(
  db: SQLiteDatabase,
  id: string,
  deletedAt = Date.now(),
): Promise<boolean> {
  const result = await db.runAsync(
    `UPDATE people
      SET deleted_at = $deletedAt,
          updated_at = $deletedAt
      WHERE id = $id
        AND deleted_at IS NULL`,
    { $id: id, $deletedAt: deletedAt },
  );
  return result.changes > 0;
}

export type RestorePersonResult = {
  person: StoredPerson;
  label: StoredLabel | null;
};

/** Restores a person and reuses or reactivates their label in one transaction. */
export async function restorePerson(
  db: SQLiteDatabase,
  id: string,
  restoredAt = Date.now(),
): Promise<RestorePersonResult | null> {
  let result: RestorePersonResult | null = null;
  await withWriteTransaction(db, async (transaction) => {
    const row = await transaction.getFirstAsync<PersonRow>(
      `SELECT ${PERSON_COLUMNS} FROM people
        WHERE id = $id AND deleted_at IS NOT NULL`,
      { $id: id },
    );
    if (!row) return;

    let label: StoredLabel | null = null;
    if (row.label_id !== null) {
      label = await transaction.getFirstAsync<StoredLabel>(
        `SELECT id, name, color, created_at AS createdAt,
                updated_at AS updatedAt, deleted_at AS deletedAt
          FROM labels WHERE id = $id`,
        { $id: row.label_id },
      );
      if (label && label.deletedAt !== null) {
        const originalLabel = label;
        const activeLabels = await listActiveLabels(transaction);
        label = activeLabels.find(
          (candidate) =>
            normalizeLabelName(candidate.name) === normalizeLabelName(originalLabel.name),
        ) ?? null;
        if (!label) {
          await transaction.runAsync(
            `UPDATE labels SET deleted_at = NULL, updated_at = $restoredAt
              WHERE id = $id`,
            { $id: originalLabel.id, $restoredAt: restoredAt },
          );
          label = { ...originalLabel, deletedAt: null, updatedAt: restoredAt };
        }
      }
    }

    await transaction.runAsync(
      `UPDATE people SET label_id = $labelId, deleted_at = NULL,
                          updated_at = $restoredAt
        WHERE id = $id AND deleted_at IS NOT NULL`,
      { $id: id, $labelId: label?.id ?? null, $restoredAt: restoredAt },
    );
    await deleteUnusedDeletedLabels(transaction);
    result = {
      person: {
        ...mapPerson(row),
        labelId: label?.id ?? null,
        deletedAt: null,
        updatedAt: restoredAt,
      },
      label,
    };
  });
  return result;
}

/** Deletes a person from Trash for good. */
export async function deletePersonPermanently(
  db: SQLiteDatabase,
  id: string,
): Promise<boolean> {
  let deleted = false;
  await withWriteTransaction(db, async (transaction) => {
    const result = await transaction.runAsync(
      `DELETE FROM people
        WHERE id = $id
          AND deleted_at IS NOT NULL`,
      { $id: id },
    );
    deleted = result.changes > 0;
    await deleteUnusedDeletedLabels(transaction);
  });
  return deleted;
}

/** Permanently removes everyone in Trash and returns how many were removed. */
export async function emptyTrash(db: SQLiteDatabase): Promise<number> {
  let deletedCount = 0;
  await withWriteTransaction(db, async (transaction) => {
    const result = await transaction.runAsync(
      'DELETE FROM people WHERE deleted_at IS NOT NULL',
    );
    deletedCount = result.changes;
    await deleteUnusedDeletedLabels(transaction);
  });
  return deletedCount;
}
