import type { SQLiteDatabase } from 'expo-sqlite';

import type { LabelColor } from '@/constants/label-colors';
import { LABEL_MAX_LENGTH } from '@/constants/data-limits';
import { createLabel, listActiveLabels } from '@/database/labels-repository';
import { createPerson, type CreatePersonInput } from '@/database/people-repository';
import { withWriteTransaction } from '@/database/transactions';
import type { StoredLabel, StoredPerson } from '@/database/types';
import { normalizeLabelName } from '@/lib/label-names';

export type PersonLabelChoice =
  | { kind: 'existing'; id: string | null }
  | { kind: 'typed'; name: string };

export type CreatePersonWithLabelInput = {
  person: Omit<CreatePersonInput, 'labelId'>;
  label: PersonLabelChoice;
  defaultLabelColor: LabelColor;
};

export type CreatePersonWithLabelResult = {
  person: StoredPerson;
  label: StoredLabel | null;
  createdLabel: StoredLabel | null;
};

/** Resolves the label, then saves it and the person as one committed change. */
export async function createPersonWithLabel(
  db: SQLiteDatabase,
  input: CreatePersonWithLabelInput,
): Promise<CreatePersonWithLabelResult> {
  let result: CreatePersonWithLabelResult | null = null;

  await withWriteTransaction(db, async (transaction) => {
    const activeLabels = await listActiveLabels(transaction);
    let label: StoredLabel | null = null;
    let createdLabel: StoredLabel | null = null;

    if (input.label.kind === 'existing') {
      const selectedId = input.label.id;
      if (selectedId !== null) {
        label = activeLabels.find((item) => item.id === selectedId) ?? null;
        if (!label) {
          throw new Error(`Label ${selectedId} was not found.`);
        }
      }
    } else {
      const name = input.label.name.trim();
      if (name.length > LABEL_MAX_LENGTH) {
        throw new Error('The label name is too long.');
      }
      if (name) {
        const comparisonName = normalizeLabelName(name);
        label =
          activeLabels.find(
            (item) => normalizeLabelName(item.name) === comparisonName,
          ) ?? null;
        if (!label) {
          createdLabel = await createLabel(transaction, {
            id: `label-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            name,
            color: input.defaultLabelColor,
          });
          label = createdLabel;
        }
      }
    }

    const person = await createPerson(transaction, {
      ...input.person,
      labelId: label?.id ?? null,
    });
    result = { person, label, createdLabel };
  });

  if (!result) {
    throw new Error('The person could not be saved.');
  }
  return result;
}
