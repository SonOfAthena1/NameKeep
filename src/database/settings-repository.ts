import type { SQLiteDatabase } from 'expo-sqlite';

import type { LabelColor } from '@/constants/label-colors';
import type { ThemePreference } from '@/constants/theme';
import {
  MEMORY_REMINDER_INTERVALS,
  type AppSettings,
  type MemoryReminderInterval,
  type SortOrder,
} from '@/database/types';

type SettingsRow = {
  theme_preference: ThemePreference;
  default_label_color: LabelColor;
  default_label_id: string | null;
  label_sort_order: SortOrder;
  people_sort_order: SortOrder;
  show_date: number;
  condensed_view: number;
  memory_reminder_intervals: string;
  updated_at: number;
};

/** Reads saved reminder intervals and ignores unsupported or broken values. */
function parseMemoryReminderIntervals(value: string): MemoryReminderInterval[] {
  try {
    const intervals = JSON.parse(value);
    if (!Array.isArray(intervals)) return [];
    return MEMORY_REMINDER_INTERVALS.filter((interval) => intervals.includes(interval));
  } catch {
    return [];
  }
}

export type SettingsPatch = Partial<Omit<AppSettings, 'updatedAt'>>;

/** Changes database-style settings fields into the shape used by the app. */
function mapSettings(row: SettingsRow): AppSettings {
  return {
    themePreference: row.theme_preference,
    defaultLabelColor: row.default_label_color,
    defaultLabelId: row.default_label_id,
    labelSortOrder: row.label_sort_order,
    peopleSortOrder: row.people_sort_order,
    showDate: row.show_date === 1,
    condensedView: row.condensed_view === 1,
    memoryReminderIntervals: parseMemoryReminderIntervals(row.memory_reminder_intervals),
    updatedAt: row.updated_at,
  };
}

/** Gets the app's single saved settings record. */
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
      memory_reminder_intervals,
      updated_at
    FROM app_settings
    WHERE id = 1
  `);

  if (!row) {
    throw new Error('The app settings row is missing.');
  }
  return mapSettings(row);
}

/** Replaces all saved settings with the provided values. */
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
          memory_reminder_intervals = $memoryReminderIntervals,
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
      $memoryReminderIntervals: JSON.stringify(settings.memoryReminderIntervals),
      $updatedAt: updatedAt,
    },
  );

  if (result.changes === 0) {
    throw new Error('The app settings row is missing.');
  }
  return { ...settings, updatedAt };
}

/** Updates only the settings included in a patch. */
export async function updateSettings(
  db: SQLiteDatabase,
  patch: SettingsPatch,
  updatedAt = Date.now(),
): Promise<AppSettings> {
  const assignments: string[] = [];
  const parameters: Record<string, string | number | null> = {
    $updatedAt: updatedAt,
  };

  if (patch.themePreference !== undefined) {
    assignments.push('theme_preference = $themePreference');
    parameters.$themePreference = patch.themePreference;
  }
  if (patch.defaultLabelColor !== undefined) {
    assignments.push('default_label_color = $defaultLabelColor');
    parameters.$defaultLabelColor = patch.defaultLabelColor;
  }
  if (patch.defaultLabelId !== undefined) {
    assignments.push('default_label_id = $defaultLabelId');
    parameters.$defaultLabelId = patch.defaultLabelId;
  }
  if (patch.labelSortOrder !== undefined) {
    assignments.push('label_sort_order = $labelSortOrder');
    parameters.$labelSortOrder = patch.labelSortOrder;
  }
  if (patch.peopleSortOrder !== undefined) {
    assignments.push('people_sort_order = $peopleSortOrder');
    parameters.$peopleSortOrder = patch.peopleSortOrder;
  }
  if (patch.showDate !== undefined) {
    assignments.push('show_date = $showDate');
    parameters.$showDate = patch.showDate ? 1 : 0;
  }
  if (patch.condensedView !== undefined) {
    assignments.push('condensed_view = $condensedView');
    parameters.$condensedView = patch.condensedView ? 1 : 0;
  }
  if (patch.memoryReminderIntervals !== undefined) {
    assignments.push('memory_reminder_intervals = $memoryReminderIntervals');
    parameters.$memoryReminderIntervals = JSON.stringify(
      patch.memoryReminderIntervals,
    );
  }

  if (assignments.length === 0) {
    return getSettings(db);
  }

  assignments.push('updated_at = $updatedAt');
  const result = await db.runAsync(
    `UPDATE app_settings
      SET ${assignments.join(',\n          ')}
      WHERE id = 1`,
    parameters,
  );
  if (result.changes === 0) {
    throw new Error('The app settings row is missing.');
  }

  return getSettings(db);
}
