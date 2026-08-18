import type { SQLiteDatabase } from 'expo-sqlite';

import type { LabelColor } from '@/constants/label-colors';
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
