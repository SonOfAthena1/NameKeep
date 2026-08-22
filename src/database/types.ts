import type { LabelColor } from '@/constants/label-colors';
import type { ThemePreference } from '@/constants/theme';

export type SortOrder = 'newest' | 'oldest' | 'alphabetical';

export const MEMORY_REMINDER_INTERVALS = [1, 3, 7, 14] as const;

export type MemoryReminderInterval = (typeof MEMORY_REMINDER_INTERVALS)[number];

export type Label = {
  id: string;
  name: string;
  color: LabelColor;
  createdAt: number;
};

export type Person = {
  id: string;
  name: string;
  description: string;
  labelId: string | null;
  createdAt: number;
};

export type StoredLabel = Label & {
  updatedAt: number;
  deletedAt: number | null;
};

export type StoredPerson = Person & {
  updatedAt: number;
  deletedAt: number | null;
};

export type StoredTrashedPerson = Omit<StoredPerson, 'deletedAt'> & {
  deletedAt: number;
};

export type AppSettings = {
  themePreference: ThemePreference;
  defaultLabelColor: LabelColor;
  noLabelColor: LabelColor;
  defaultLabelId: string | null;
  labelSortOrder: SortOrder;
  peopleSortOrder: SortOrder;
  showDate: boolean;
  condensedView: boolean;
  memoryReminderIntervals: MemoryReminderInterval[];
  updatedAt: number;
};
