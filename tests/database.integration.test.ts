import type { SQLiteDatabase } from 'expo-sqlite';

import {
  createLabel,
  deleteLabelAndHandlePeople,
  listActiveLabels,
} from '@/database/labels-repository';
import { migrateDatabase } from '@/database/migrate';
import {
  createPerson,
  deletePersonPermanently,
  emptyTrash,
  getActivePerson,
  listActivePeople,
  listTrashedPeople,
  movePersonToTrash,
  restorePerson,
  updatePerson,
} from '@/database/people-repository';
import {
  getSettings,
  saveSettings,
  updateSettings,
} from '@/database/settings-repository';
import { TestDatabase } from './helpers/test-database';

describe('SQLite persistence', () => {
  let testDatabase: TestDatabase;
  let database: SQLiteDatabase;

  beforeEach(async () => {
    testDatabase = new TestDatabase();
    database = testDatabase.asExpoDatabase();
    await migrateDatabase(database);
  });

  afterEach(() => testDatabase.close());

  test('creates the latest schema and default settings', async () => {
    const version = await testDatabase.getFirstAsync<{ user_version: number }>(
      'PRAGMA user_version',
    );
    expect(version?.user_version).toBe(8);
    await expect(getSettings(database)).resolves.toMatchObject({
      themePreference: 'light',
      defaultLabelColor: 'green',
      noLabelColor: 'green',
      defaultLabelId: null,
      memoryReminderIntervals: [],
    });
  });

  test('runs the complete person lifecycle', async () => {
    await createLabel(database, {
      id: 'friends',
      name: 'Friends',
      color: 'blue',
      createdAt: 10,
    });
    await createPerson(database, {
      id: 'ada',
      name: 'Ada',
      description: 'Conference',
      labelId: 'friends',
      createdAt: 20,
    });

    expect(await listActivePeople(database)).toHaveLength(1);
    await expect(
      updatePerson(
        database,
        'ada',
        { name: 'Ada Lovelace', description: 'Conference', labelId: 'friends' },
        30,
      ),
    ).resolves.toBe(true);
    expect((await getActivePerson(database, 'ada'))?.name).toBe('Ada Lovelace');

    await expect(movePersonToTrash(database, 'ada', 40)).resolves.toBe(true);
    await expect(getActivePerson(database, 'ada')).resolves.toBeNull();
    expect(await listTrashedPeople(database)).toMatchObject([
      { id: 'ada', deletedAt: 40 },
    ]);

    await expect(restorePerson(database, 'ada', 50)).resolves.toBe(true);
    expect((await getActivePerson(database, 'ada'))?.deletedAt).toBeNull();
    await movePersonToTrash(database, 'ada', 60);
    await expect(deletePersonPermanently(database, 'ada')).resolves.toBe(true);
    await expect(listTrashedPeople(database)).resolves.toEqual([]);
  });

  test('reassigns people and clears a deleted default label atomically', async () => {
    await createLabel(database, {
      id: 'source',
      name: 'Source',
      color: 'green',
      createdAt: 10,
    });
    await createLabel(database, {
      id: 'destination',
      name: 'Destination',
      color: 'blue',
      createdAt: 11,
    });
    await createPerson(database, {
      id: 'person',
      name: 'Ada',
      description: '',
      labelId: 'source',
      createdAt: 20,
    });
    await updateSettings(database, { defaultLabelId: 'source' }, 21);

    await expect(
      deleteLabelAndHandlePeople(
        database,
        'source',
        { destinationLabelId: 'destination', movePeopleToTrash: false },
        30,
      ),
    ).resolves.toEqual({ affectedPeople: 1, deletedAt: 30 });

    expect((await getActivePerson(database, 'person'))?.labelId).toBe('destination');
    expect((await getSettings(database)).defaultLabelId).toBeNull();
    expect((await listActiveLabels(database)).map((item) => item.id)).toEqual([
      'destination',
    ]);
  });

  test('rolls back label deletion when its destination is invalid', async () => {
    await createLabel(database, {
      id: 'source',
      name: 'Source',
      color: 'green',
      createdAt: 10,
    });
    await createPerson(database, {
      id: 'person',
      name: 'Ada',
      description: '',
      labelId: 'source',
      createdAt: 20,
    });

    await expect(
      deleteLabelAndHandlePeople(
        database,
        'source',
        { destinationLabelId: 'missing', movePeopleToTrash: false },
        30,
      ),
    ).rejects.toThrow('Destination label missing was not found');

    expect((await getActivePerson(database, 'person'))?.labelId).toBe('source');
    expect((await listActiveLabels(database)).map((item) => item.id)).toEqual([
      'source',
    ]);
  });

  test('moves labeled people to Trash and can empty it', async () => {
    await createLabel(database, {
      id: 'work',
      name: 'Work',
      color: 'orange',
      createdAt: 10,
    });
    for (const id of ['one', 'two']) {
      await createPerson(database, {
        id,
        name: id,
        description: '',
        labelId: 'work',
        createdAt: 20,
      });
    }

    await deleteLabelAndHandlePeople(
      database,
      'work',
      { destinationLabelId: null, movePeopleToTrash: true },
      30,
    );
    expect(await listTrashedPeople(database)).toHaveLength(2);
    await expect(emptyTrash(database)).resolves.toBe(2);
    await expect(listTrashedPeople(database)).resolves.toEqual([]);
  });

  test('saves settings and tolerates malformed reminder data', async () => {
    const saved = await saveSettings(
      database,
      {
        themePreference: 'dark',
        defaultLabelColor: 'violet',
        noLabelColor: 'gray',
        defaultLabelId: null,
        labelSortOrder: 'alphabetical',
        peopleSortOrder: 'oldest',
        showDate: true,
        condensedView: true,
        memoryReminderIntervals: [1, 7],
      },
      100,
    );
    expect(saved.updatedAt).toBe(100);
    await expect(getSettings(database)).resolves.toEqual(saved);

    await database.runAsync(
      `UPDATE app_settings
        SET memory_reminder_intervals = $value
        WHERE id = 1`,
      { $value: '[14,999,1,14]' },
    );
    expect((await getSettings(database)).memoryReminderIntervals).toEqual([1, 14]);

    await database.runAsync(
      `UPDATE app_settings
        SET memory_reminder_intervals = $value
        WHERE id = 1`,
      { $value: 'broken json' },
    );
    expect((await getSettings(database)).memoryReminderIntervals).toEqual([]);
  });
});
