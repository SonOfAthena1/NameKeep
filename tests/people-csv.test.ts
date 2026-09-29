import type { Label, Person } from '@/database/types';
import {
  CsvImportError,
  createPeopleImportPlan,
  parsePeopleCsv,
} from '@/lib/import-people';
import { createPeopleCsv } from '@/lib/people-csv';

const label: Label = {
  id: 'friends',
  name: 'Friends',
  color: 'green',
  createdAt: 1,
};

const person = (overrides: Partial<Person> = {}): Person => ({
  id: 'person-1',
  name: 'Ada Lovelace',
  description: 'Met at a conference',
  labelId: label.id,
  createdAt: new Date(2026, 7, 14, 15, 30).getTime(),
  ...overrides,
});

describe('CSV export', () => {
  test('round-trips Unicode, quotes, commas, and labels', () => {
    const original = person({
      name: 'Zoë "Z" 李',
      description: 'Coffee, then lunch',
    });

    const parsed = parsePeopleCsv(createPeopleCsv([original], [label]));

    expect(parsed).toEqual({
      people: [
        {
          name: original.name,
          description: original.description,
          labelName: label.name,
          labelColor: label.color,
          metDate: new Date(2026, 7, 14).getTime(),
          rowNumber: 2,
        },
      ],
      invalidRows: [],
    });
  });

  test.each(['=1+1', '+SUM(A1:A2)', '-2+3', '@command']) (
    'protects spreadsheet formula prefix %s',
    (dangerousName) => {
      const csv = createPeopleCsv([person({ name: dangerousName })], [label]);
      expect(csv).toContain(`"'${dangerousName}"`);
      expect(parsePeopleCsv(csv).people[0].name).toBe(dangerousName);
    },
  );

  test('exports a missing label as empty cells', () => {
    expect(createPeopleCsv([person({ labelId: 'missing' })], [])).toContain(
      '"Ada Lovelace","Met at a conference","","","2026-08-14"',
    );
  });
});

describe('CSV parsing and import planning', () => {
  test.each([
    ['', 'empty'],
    ['description\nhello', '“name” column'],
  ])('rejects an unusable file', (csv, message) => {
    expect(() => parsePeopleCsv(csv)).toThrow(CsvImportError);
    expect(() => parsePeopleCsv(csv)).toThrow(message);
  });

  test('normalizes headers and trims imported values', () => {
    const result = parsePeopleCsv(
      '\uFEFF Name , Description , Label , Label-Color\n Ada , First programmer , History , BLUE ',
    );

    expect(result.people[0]).toMatchObject({
      name: 'Ada',
      description: 'First programmer',
      labelName: 'History',
      labelColor: 'blue',
      metDate: null,
    });
  });

  test('reports invalid rows without discarding valid rows', () => {
    const tooLongName = 'x'.repeat(36);
    const csv = [
      'name,description,label,label_color',
      'Ada,Valid,Friends,green',
      ',Missing name,,',
      `${tooLongName},Too long,,`,
      'Grace,Invalid color,Work,chartreuse',
      'Linus,Color without label,,blue',
    ].join('\n');

    expect(parsePeopleCsv(csv)).toEqual({
      people: [
        {
          name: 'Ada',
          description: 'Valid',
          labelName: 'Friends',
          labelColor: 'green',
          metDate: null,
          rowNumber: 2,
        },
      ],
      invalidRows: [3, 4, 5, 6],
    });
  });

  test('rejects files over the row limit', () => {
    const csv = `name\n${Array.from({ length: 5001 }, (_, index) => `Person ${index}`).join('\n')}`;
    expect(() => parsePeopleCsv(csv)).toThrow('more than 5,000 people');
  });

  test('uses an optional met date as the person creation date', () => {
    const parsed = parsePeopleCsv('name,met-date\nAda,2024-02-29\nGrace,');
    const plan = createPeopleImportPlan(parsed, [], [], 'amber');

    expect(plan.people[0].createdAt).toBe(new Date(2024, 1, 29).getTime());
    expect(plan.people[1].createdAt).toBeGreaterThan(0);
  });

  test.each(['2026/08/14', '08-14-2026', '2026-02-30'])(
    'skips a row with invalid met date %s',
    (metDate) => {
      expect(parsePeopleCsv(`name,met_date\nAda,${metDate}`)).toEqual({
        people: [],
        invalidRows: [2],
      });
    },
  );

  test('reuses labels and skips duplicates case-insensitively', () => {
    const parsed = parsePeopleCsv(
      'name,description,label,label_color\nADA, First programmer , friends,blue\nGrace,Compiler,New Group,violet\ngrace,compiler,new group,violet',
    );
    const plan = createPeopleImportPlan(
      parsed,
      [person({ name: 'ada', description: 'first programmer' })],
      [label],
      'orange',
    );

    expect(plan.duplicateCount).toBe(2);
    expect(plan.people).toHaveLength(1);
    expect(plan.people[0]).toMatchObject({ name: 'Grace', description: 'Compiler' });
    expect(plan.labels).toHaveLength(1);
    expect(plan.labels[0]).toMatchObject({ name: 'New Group', color: 'violet' });
    expect(plan.people[0].labelId).toBe(plan.labels[0].id);
  });

  test('uses the default color when a new label has no explicit color', () => {
    const parsed = parsePeopleCsv('name,label\nAda,History');
    const plan = createPeopleImportPlan(parsed, [], [], 'amber');
    expect(plan.labels[0].color).toBe('amber');
  });

  test('rejects conflicting colors for the same new label', () => {
    const parsed = parsePeopleCsv(
      'name,label,label_color\nAda,History,green\nGrace,history,blue',
    );
    expect(() => createPeopleImportPlan(parsed, [], [], 'amber')).toThrow(
      'conflicting colors',
    );
  });
});
