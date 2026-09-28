/** Compares label names consistently across manual entry and CSV import. */
export function normalizeLabelName(value: string): string {
  return value.normalize('NFKC').trim().toLocaleLowerCase();
}
