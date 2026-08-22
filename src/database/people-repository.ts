import type { SQLiteDatabase } from 'expo-sqlite';

import type { StoredPerson, StoredTrashedPerson } from '@/database/types';

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

/** Restores a person from Trash and drops a label that no longer exists. */
export async function restorePerson(
  db: SQLiteDatabase,
  id: string,
  restoredAt = Date.now(),
): Promise<boolean> {
  const result = await db.runAsync(
    `UPDATE people
      SET label_id = CASE
            WHEN label_id IS NULL THEN NULL
            WHEN EXISTS (
              SELECT 1
              FROM labels
              WHERE labels.id = people.label_id
                AND labels.deleted_at IS NULL
            ) THEN label_id
            ELSE NULL
          END,
          deleted_at = NULL,
          updated_at = $restoredAt
      WHERE id = $id
        AND deleted_at IS NOT NULL`,
    { $id: id, $restoredAt: restoredAt },
  );
  return result.changes > 0;
}

/** Deletes a person from Trash for good. */
export async function deletePersonPermanently(
  db: SQLiteDatabase,
  id: string,
): Promise<boolean> {
  const result = await db.runAsync(
    `DELETE FROM people
      WHERE id = $id
        AND deleted_at IS NOT NULL`,
    { $id: id },
  );
  return result.changes > 0;
}

/** Permanently removes everyone in Trash and returns how many were removed. */
export async function emptyTrash(db: SQLiteDatabase): Promise<number> {
  const result = await db.runAsync(
    'DELETE FROM people WHERE deleted_at IS NOT NULL',
  );
  return result.changes;
}
