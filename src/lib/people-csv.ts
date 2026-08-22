import type { Label, Person } from '@/database/types';

const CSV_HEADERS = ['name', 'description', 'label', 'label_color'] as const;
const FORMULA_PREFIX = /^[\t\r\n ]*[=+\-@]/;

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
    return [person.name, person.description, label?.name ?? '', label?.color ?? '']
      .map(escapeCsvCell)
      .join(',');
  });

  // A UTF-8 BOM helps spreadsheet apps recognize non-ASCII names correctly.
  return `\uFEFF${CSV_HEADERS.join(',')}\r\n${rows.join('\r\n')}\r\n`;
}
