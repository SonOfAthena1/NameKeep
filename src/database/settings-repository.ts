import type { SQLiteDatabase } from 'expo-sqlite';

import type { LabelColor } from '@/constants/label-colors';
import type { ThemePreference } from '@/constants/theme';
import type { AppSettings, SortOrder } from '@/database/types';

type SettingsRow = {
  theme_preference: ThemePreference;
  default_label_color: LabelColor;
  default_label_id: string | null;
  label_sort_order: SortOrder;
  people_sort_order: SortOrder;
  show_date: number;
  condensed_view: number;
  updated_at: number;
};

function mapSettings(row: SettingsRow): AppSettings {
  return {
    themePreference: row.theme_preference,
    defaultLabelColor: row.default_label_color,
    defaultLabelId: row.default_label_id,
    labelSortOrder: row.label_sort_order,
    peopleSortOrder: row.people_sort_order,
    showDate: row.show_date === 1,
    condensedView: row.condensed_view === 1,
    updatedAt: row.updated_at,
  };
}

export async function getSettings(
  db: SQLiteDatabase,
): Promise<AppSettings> {
  const row = await db.getFirstAsync<SettingsRow>(`
    SELECT
      theme_preference,
      default_label_color,
      default_label_id,
      label_sort_order,
      people_sort_order,
      show_date,
      condensed_view,
      updated_at
    FROM app_settings
    WHERE id = 1
  `);

  if (!row) {
    throw new Error('The app settings row is missing.');
  }
  return mapSettings(row);
}

export async function saveSettings(
  db: SQLiteDatabase,
  settings: Omit<AppSettings, 'updatedAt'>,
  updatedAt = Date.now(),
): Promise<AppSettings> {
  const result = await db.runAsync(
    `UPDATE app_settings
      SET theme_preference = $themePreference,
          default_label_color = $defaultLabelColor,
          default_label_id = $defaultLabelId,
          label_sort_order = $labelSortOrder,
          people_sort_order = $peopleSortOrder,
          show_date = $showDate,
          condensed_view = $condensedView,
          updated_at = $updatedAt
      WHERE id = 1`,
    {
      $themePreference: settings.themePreference,
      $defaultLabelColor: settings.defaultLabelColor,
      $defaultLabelId: settings.defaultLabelId,
      $labelSortOrder: settings.labelSortOrder,
      $peopleSortOrder: settings.peopleSortOrder,
      $showDate: settings.showDate ? 1 : 0,
      $condensedView: settings.condensedView ? 1 : 0,
      $updatedAt: updatedAt,
    },
  );

  if (result.changes === 0) {
    throw new Error('The app settings row is missing.');
  }
  return { ...settings, updatedAt };
}
