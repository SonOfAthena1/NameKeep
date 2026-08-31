import Papa from 'papaparse';

import {
  DESCRIPTION_MAX_LENGTH,
  LABEL_MAX_LENGTH,
  NAME_MAX_LENGTH,
} from '@/constants/data-limits';
import {
  LABEL_COLOR_OPTIONS,
  type LabelColor,
} from '@/constants/label-colors';
import type { Label, Person } from '@/database/types';

export const MAX_CSV_FILE_SIZE = 2_000_000;
const MAX_IMPORT_ROWS = 5_000;
const CONTROL_CHARACTERS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;
const EXPORTED_FORMULA_PREFIX = /^'[\t\r\n ]*[=+\-@]/;
const VALID_COLORS = new Set<LabelColor>(
  LABEL_COLOR_OPTIONS.map((option) => option.id),
);

type CsvRow = Record<string, string | undefined>;

export type ValidatedCsvPerson = {
  name: string;
  description: string;
  labelName: string;
  labelColor: LabelColor | null;
  metDate: number | null;
  rowNumber: number;
};

export type ParsedPeopleCsv = {
  people: ValidatedCsvPerson[];
  invalidRows: number[];
};

export type PeopleImportPlan = {
  labels: Label[];
  people: Person[];
  duplicateCount: number;
  invalidRows: number[];
};

export class CsvImportError extends Error {}

/** Cleans up a CSV column name before matching it. */
function normalizeHeader(header: string): string {
  return header
    .replace(/^\uFEFF/, '')
    .trim()
    .toLocaleLowerCase()
    .replace(/[\s-]+/g, '_');
}

/** Cleans imported text and removes CSV formula protection when present. */
function normalizeText(value: string | undefined): string {
  const text = String(value ?? '').normalize('NFC').trim();
  return EXPORTED_FORMULA_PREFIX.test(text) ? text.slice(1) : text;
}

/** Makes text consistent for case-insensitive duplicate checks. */
function normalizeForComparison(value: string): string {
  return value.normalize('NFKC').trim().toLocaleLowerCase();
}

/** Checks whether a value is one of the label colors this app supports. */
function isLabelColor(value: string): value is LabelColor {
  return VALID_COLORS.has(value as LabelColor);
}

/** Parses a YYYY-MM-DD value as local midnight, rejecting impossible dates. */
function parseMetDate(value: string): number | null | undefined {
  if (!value) return null;

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return undefined;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return undefined;
  }

  return date.getTime();
}

/** Creates a temporary unique ID for an imported label or person. */
function createLocalId(prefix: 'label' | 'person'): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Reads and checks a people CSV file before it is imported.
 *
 * @param contents The text from the selected CSV file.
 * @returns Valid people plus the row numbers that could not be used.
 * @throws {CsvImportError} When the file itself cannot be imported.
 */
export function parsePeopleCsv(contents: string): ParsedPeopleCsv {
  if (!contents.trim()) {
    throw new CsvImportError('The selected CSV file is empty.');
  }

  const result = Papa.parse<CsvRow>(contents, {
    header: true,
    skipEmptyLines: 'greedy',
    transformHeader: normalizeHeader,
  });
  const headers = result.meta.fields ?? [];

  if (!headers.includes('name')) {
    throw new CsvImportError('The CSV must contain a “name” column.');
  }
  if (result.data.length > MAX_IMPORT_ROWS) {
    throw new CsvImportError(
      `The CSV contains more than ${MAX_IMPORT_ROWS.toLocaleString()} people.`,
    );
  }

  if (result.errors.some((error) => error.row === undefined)) {
    throw new CsvImportError('The selected file is not valid CSV.');
  }

  const parserErrorRows = new Set(
    result.errors
      .filter(
        (error): error is typeof error & { row: number } =>
          error.code !== 'TooFewFields' && error.row !== undefined,
      )
      .map((error) => error.row + 2),
  );
  const invalidRows = new Set<number>(parserErrorRows);
  const people: ValidatedCsvPerson[] = [];

  result.data.forEach((row, index) => {
    const rowNumber = index + 2;
    if (parserErrorRows.has(rowNumber)) return;

    const name = normalizeText(row.name);
    const description = normalizeText(row.description);
    const labelName = normalizeText(row.label);
    const colorValue = normalizeText(row.label_color).toLocaleLowerCase();
    const metDate = parseMetDate(normalizeText(row.met_date));

    const hasInvalidText = [name, description, labelName].some((value) =>
      CONTROL_CHARACTERS.test(value),
    );
    const isInvalid =
      !name ||
      name.length > NAME_MAX_LENGTH ||
      description.length > DESCRIPTION_MAX_LENGTH ||
      labelName.length > LABEL_MAX_LENGTH ||
      hasInvalidText ||
      metDate === undefined ||
      (!labelName && !!colorValue) ||
      (!!colorValue && !isLabelColor(colorValue));

    if (isInvalid) {
      invalidRows.add(rowNumber);
      return;
    }

    people.push({
      name,
      description,
      labelName,
      labelColor: colorValue && isLabelColor(colorValue) ? colorValue : null,
      metDate,
      rowNumber,
    });
  });

  return { people, invalidRows: [...invalidRows].sort((a, b) => a - b) };
}

/**
 * Prepares new labels and people without changing the database yet.
 *
 * It reuses matching labels, skips people already saved, and catches label
 * color conflicts so the caller can save one clean plan.
 */
export function createPeopleImportPlan(
  parsed: ParsedPeopleCsv,
  existingPeople: Person[],
  existingLabels: Label[],
  defaultLabelColor: LabelColor,
): PeopleImportPlan {
  const labelsByName = new Map(
    existingLabels.map((label) => [normalizeForComparison(label.name), label]),
  );
  const newLabelsByName = new Map<string, Label>();
  const newLabelExplicitColors = new Map<string, LabelColor>();
  const labelsById = new Map(existingLabels.map((label) => [label.id, label]));
  const duplicateKeys = new Set(
    existingPeople.map((person) => {
      const labelName = person.labelId
        ? labelsById.get(person.labelId)?.name ?? ''
        : '';
      return [person.name, person.description, labelName]
        .map(normalizeForComparison)
        .join('\u0000');
    }),
  );
  const people: Person[] = [];
  let duplicateCount = 0;
  const createdAt = Date.now();

  for (const row of parsed.people) {
    const normalizedLabelName = normalizeForComparison(row.labelName);
    let label = normalizedLabelName
      ? labelsByName.get(normalizedLabelName) ??
        newLabelsByName.get(normalizedLabelName)
      : undefined;

    if (!label && row.labelName) {
      label = {
        id: createLocalId('label'),
        name: row.labelName,
        color: row.labelColor ?? defaultLabelColor,
        createdAt,
      };
      newLabelsByName.set(normalizedLabelName, label);
      if (row.labelColor) {
        newLabelExplicitColors.set(normalizedLabelName, row.labelColor);
      }
    } else if (
      label &&
      newLabelsByName.has(normalizedLabelName) &&
      row.labelColor
    ) {
      const explicitColor = newLabelExplicitColors.get(normalizedLabelName);
      if (explicitColor && explicitColor !== row.labelColor) {
        throw new CsvImportError(
          `Label “${row.labelName}” has conflicting colors in the CSV.`,
        );
      }
      label.color = row.labelColor;
      newLabelExplicitColors.set(normalizedLabelName, row.labelColor);
    }

    const duplicateKey = [row.name, row.description, row.labelName]
      .map(normalizeForComparison)
      .join('\u0000');
    if (duplicateKeys.has(duplicateKey)) {
      duplicateCount += 1;
      continue;
    }
    duplicateKeys.add(duplicateKey);

    people.push({
      id: createLocalId('person'),
      name: row.name,
      description: row.description,
      labelId: label?.id ?? null,
      createdAt: row.metDate ?? createdAt,
    });
  }

  const usedLabelIds = new Set(
    people.map((person) => person.labelId).filter((id) => id !== null),
  );
  const labels = [...newLabelsByName.values()].filter((label) =>
    usedLabelIds.has(label.id),
  );

  return {
    labels,
    people,
    duplicateCount,
    invalidRows: parsed.invalidRows,
  };
}
