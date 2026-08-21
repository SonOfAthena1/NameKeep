import type { SQLiteDatabase } from 'expo-sqlite';

import type { LabelColor } from '@/constants/label-colors';
import { withWriteTransaction } from '@/database/transactions';
import type { StoredLabel } from '@/database/types';

type LabelRow = {
  id: string;
  name: string;
  color: LabelColor;
  created_at: number;
  updated_at: number;
  deleted_at: number | null;
};

export type CreateLabelInput = {
  id: string;
  name: string;
  color: LabelColor;
  createdAt?: number;
};

export type UpdateLabelInput = {
  name: string;
  color: LabelColor;
};

export type DeleteLabelInput = {
  destinationLabelId: string | null;
  movePeopleToTrash: boolean;
};

export type DeleteLabelResult = {
  affectedPeople: number;
  deletedAt: number;
};

function mapLabel(row: LabelRow): StoredLabel {
  return {
    id: row.id,
    name: row.name,
    color: row.color,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}

export async function listActiveLabels(
  db: SQLiteDatabase,
): Promise<StoredLabel[]> {
  const rows = await db.getAllAsync<LabelRow>(`
    SELECT id, name, color, created_at, updated_at, deleted_at
    FROM labels
    WHERE deleted_at IS NULL
    ORDER BY created_at DESC
  `);
  return rows.map(mapLabel);
}

export async function createLabel(
  db: SQLiteDatabase,
  input: CreateLabelInput,
): Promise<StoredLabel> {
  const createdAt = input.createdAt ?? Date.now();
  const label: StoredLabel = {
    id: input.id,
    name: input.name,
    color: input.color,
    createdAt,
    updatedAt: createdAt,
    deletedAt: null,
  };

  await db.runAsync(
    `INSERT INTO labels (
      id,
      name,
      color,
      created_at,
      updated_at,
      deleted_at
    ) VALUES (
      $id,
      $name,
      $color,
      $createdAt,
      $updatedAt,
      NULL
    )`,
    {
      $id: label.id,
      $name: label.name,
      $color: label.color,
      $createdAt: label.createdAt,
      $updatedAt: label.updatedAt,
    },
  );

  return label;
}

export async function updateLabel(
  db: SQLiteDatabase,
  id: string,
  input: UpdateLabelInput,
  updatedAt = Date.now(),
): Promise<boolean> {
  const result = await db.runAsync(
    `UPDATE labels
      SET name = $name,
          color = $color,
          updated_at = $updatedAt
      WHERE id = $id
        AND deleted_at IS NULL`,
    {
      $id: id,
      $name: input.name,
      $color: input.color,
      $updatedAt: updatedAt,
    },
  );
  return result.changes > 0;
}

export async function deleteLabelAndHandlePeople(
  db: SQLiteDatabase,
  id: string,
  input: DeleteLabelInput,
  deletedAt = Date.now(),
): Promise<DeleteLabelResult> {
  if (input.destinationLabelId === id) {
    throw new Error('A deleted label cannot be its own destination.');
  }

  let affectedPeople = 0;

  await withWriteTransaction(db, async (db) => {
    const label = await db.getFirstAsync<{ id: string }>(
      `SELECT id
        FROM labels
        WHERE id = $id
          AND deleted_at IS NULL`,
      { $id: id },
    );
    if (!label) {
      throw new Error(`Label ${id} was not found.`);
    }

    if (input.destinationLabelId !== null) {
      const destination = await db.getFirstAsync<{ id: string }>(
        `SELECT id
          FROM labels
          WHERE id = $id
            AND deleted_at IS NULL`,
        { $id: input.destinationLabelId },
      );
      if (!destination) {
        throw new Error(
          `Destination label ${input.destinationLabelId} was not found.`,
        );
      }
    }

    const peopleResult = input.movePeopleToTrash
      ? await db.runAsync(
          `UPDATE people
            SET deleted_at = $deletedAt,
                updated_at = $deletedAt
            WHERE label_id = $labelId
              AND deleted_at IS NULL`,
          { $labelId: id, $deletedAt: deletedAt },
        )
      : await db.runAsync(
          `UPDATE people
            SET label_id = $destinationLabelId,
                updated_at = $updatedAt
            WHERE label_id = $labelId
              AND deleted_at IS NULL`,
          {
            $labelId: id,
            $destinationLabelId: input.destinationLabelId,
            $updatedAt: deletedAt,
          },
        );
    affectedPeople = peopleResult.changes;

    await db.runAsync(
      `UPDATE app_settings
        SET default_label_id = NULL,
            updated_at = $updatedAt
        WHERE id = 1
          AND default_label_id = $labelId`,
      { $labelId: id, $updatedAt: deletedAt },
    );

    const labelResult = await db.runAsync(
      `UPDATE labels
        SET deleted_at = $deletedAt,
            updated_at = $deletedAt
        WHERE id = $id
          AND deleted_at IS NULL`,
      { $id: id, $deletedAt: deletedAt },
    );
    if (labelResult.changes === 0) {
      throw new Error(`Label ${id} was not found.`);
    }
  });

  return { affectedPeople, deletedAt };
}
