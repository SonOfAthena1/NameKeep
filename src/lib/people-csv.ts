import type { Label, Person } from '@/database/types';

const CSV_HEADERS = [
  'name',
  'description',
  'label',
  'label_color',
  'met_date',
] as const;
const FORMULA_PREFIX = /^[\t\r\n ]*[=+\-@]/;

/** Formats the person's saved timestamp as the local calendar date shown in the app. */
function formatMetDate(timestamp: number): string {
  const date = new Date(timestamp);
  const year = String(date.getFullYear()).padStart(4, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Makes one value safe to put in a CSV cell. */
function escapeCsvCell(value: string): string {
  const spreadsheetSafeValue = FORMULA_PREFIX.test(value) ? `'${value}` : value;
  return `"${spreadsheetSafeValue.replaceAll('"', '""')}"`;
}

/**
 * Builds a spreadsheet-ready CSV file from the saved people and labels.
 *
 * @param people The people to include.
 * @param labels Labels used to look up each person's label details.
 * @returns The complete CSV text, including its header row.
 */
export function createPeopleCsv(people: Person[], labels: Label[]): string {
  const labelsById = new Map(labels.map((label) => [label.id, label]));
  const rows = people.map((person) => {
    const label = person.labelId ? labelsById.get(person.labelId) : undefined;
    return [
      person.name,
      person.description,
      label?.name ?? '',
      label?.color ?? '',
      formatMetDate(person.createdAt),
    ]
      .map(escapeCsvCell)
      .join(',');
  });

  // A UTF-8 BOM helps spreadsheet apps recognize non-ASCII names correctly.
  return `\uFEFF${CSV_HEADERS.join(',')}\r\n${rows.join('\r\n')}\r\n`;
}
