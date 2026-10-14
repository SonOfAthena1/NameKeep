import type { SQLiteDatabase } from 'expo-sqlite';

import { createPersonWithLabel } from '@/database/create-person-with-label';
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
    expect(version?.user_version).toBe(9);
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

    await expect(restorePerson(database, 'ada', 50)).resolves.toMatchObject({
      person: { id: 'ada', labelId: 'friends', deletedAt: null },
      label: { id: 'friends', color: 'blue' },
    });
    expect((await getActivePerson(database, 'ada'))?.deletedAt).toBeNull();
    await movePersonToTrash(database, 'ada', 60);
    await expect(deletePersonPermanently(database, 'ada')).resolves.toBe(true);
    await expect(listTrashedPeople(database)).resolves.toEqual([]);
  });

  test.each(['person-first', 'label-first'])('restores the original label after %s deletion without duplicates', async (path) => {
    await createLabel(database, { id: 'work', name: 'Work', color: 'orange', createdAt: 10 });
    for (const id of ['one', 'two']) {
      await createPerson(database, { id, name: id, description: '', labelId: 'work', createdAt: 20 });
      if (path === 'person-first') await movePersonToTrash(database, id, 30);
    }
    await deleteLabelAndHandlePeople(database, 'work', {
      destinationLabelId: null,
      movePeopleToTrash: path === 'label-first',
    }, 40);

    for (const id of ['one', 'two']) {
      await expect(restorePerson(database, id, 50)).resolves.toMatchObject({
        person: { id, labelId: 'work', deletedAt: null },
        label: { id: 'work', name: 'Work', color: 'orange', createdAt: 10, deletedAt: null },
      });
    }
    expect(await listActiveLabels(database)).toHaveLength(1);
    expect(await listTrashedPeople(database)).toEqual([]);
    expect((await listActivePeople(database)).map((person) => person.labelId)).toEqual(['work', 'work']);
    await expect(restorePerson(database, 'one')).resolves.toBeNull();
    await expect(restorePerson(database, 'missing')).resolves.toBeNull();
  });

  test('reuses a replacement label with the same normalized name', async () => {
    await createLabel(database, { id: 'old-work', name: 'Work', color: 'orange' });
    for (const id of ['one', 'two']) {
      await createPerson(database, { id, name: id, description: '', labelId: 'old-work' });
    }
    await deleteLabelAndHandlePeople(database, 'old-work', {
      destinationLabelId: null, movePeopleToTrash: true,
    });
    await createLabel(database, { id: 'new-work', name: '  ｗＯＲＫ  ', color: 'blue' });

    for (const id of ['one', 'two']) {
      await expect(restorePerson(database, id)).resolves.toMatchObject({
        person: { labelId: 'new-work' }, label: { id: 'new-work', color: 'blue' },
      });
      const originalLabel = await database.getFirstAsync(
        "SELECT id FROM labels WHERE id = 'old-work'",
      );
      if (id === 'one') expect(originalLabel).not.toBeNull();
      else expect(originalLabel).toBeNull();
    }
    expect((await listActiveLabels(database)).map((label) => label.id)).toEqual(['new-work']);
    expect((await listActivePeople(database)).every((person) => person.labelId === 'new-work')).toBe(true);
  });

  test('keeps the original active label even after a rename', async () => {
    await createLabel(database, { id: 'work', name: 'Work', color: 'orange' });
    await createPerson(database, { id: 'ada', name: 'Ada', description: '', labelId: 'work' });
    await movePersonToTrash(database, 'ada');
    await database.runAsync("UPDATE labels SET name = 'Office', color = 'blue' WHERE id = 'work'");
    await createLabel(database, { id: 'other-work', name: 'Work', color: 'green' });
    await expect(restorePerson(database, 'ada')).resolves.toMatchObject({
      person: { labelId: 'work' }, label: { id: 'work', name: 'Office', color: 'blue' },
    });
  });

  test('restores an unlabeled person without creating a label', async () => {
    await createPerson(database, { id: 'ada', name: 'Ada', description: '', labelId: null });
    await movePersonToTrash(database, 'ada');
    await expect(restorePerson(database, 'ada')).resolves.toMatchObject({
      person: { labelId: null, deletedAt: null }, label: null,
    });
    expect(await listActiveLabels(database)).toEqual([]);
  });

  test('rolls back label reactivation when restoring the person fails', async () => {
    await createLabel(database, { id: 'work', name: 'Work', color: 'orange' });
    await createPerson(database, { id: 'ada', name: 'Ada', description: '', labelId: 'work' });
    await deleteLabelAndHandlePeople(database, 'work', {
      destinationLabelId: null, movePeopleToTrash: true,
    });
    await database.execAsync(`
      CREATE TRIGGER fail_restore BEFORE UPDATE OF deleted_at ON people
      WHEN NEW.deleted_at IS NULL
      BEGIN SELECT RAISE(ABORT, 'Restore failed'); END;
    `);
    await expect(restorePerson(database, 'ada')).rejects.toThrow('Restore failed');
    expect(await listActiveLabels(database)).toEqual([]);
    expect(await getActivePerson(database, 'ada')).toBeNull();
    expect(await listTrashedPeople(database)).toMatchObject([{ id: 'ada', labelId: 'work' }]);
  });

  test('creates a typed label before saving the person who uses it', async () => {
    const result = await createPersonWithLabel(database, {
      person: { id: 'ada', name: 'Ada', description: 'Conference', createdAt: 20 },
      label: { kind: 'typed', name: '  Friends  ' },
      defaultLabelColor: 'blue',
    });

    expect(result.createdLabel).toMatchObject({ name: 'Friends', color: 'blue' });
    expect(result.person.labelId).toBe(result.createdLabel?.id);
    expect((await listActivePeople(database))[0]?.labelId).toBe(result.label?.id);
    expect(await listActiveLabels(database)).toHaveLength(1);
  });

  test('reuses an existing label for a case-insensitive typed match', async () => {
    await createLabel(database, {
      id: 'friends',
      name: 'Friends',
      color: 'green',
      createdAt: 10,
    });

    const result = await createPersonWithLabel(database, {
      person: { id: 'ada', name: 'Ada', description: '' },
      label: { kind: 'typed', name: '  fRiEnDs  ' },
      defaultLabelColor: 'blue',
    });

    expect(result.person.labelId).toBe('friends');
    expect(result.createdLabel).toBeNull();
    expect(await listActiveLabels(database)).toHaveLength(1);
  });

  test('keeps an empty typed label as No Label', async () => {
    const result = await createPersonWithLabel(database, {
      person: { id: 'ada', name: 'Ada', description: '' },
      label: { kind: 'typed', name: '   ' },
      defaultLabelColor: 'blue',
    });

    expect(result.person.labelId).toBeNull();
    expect(result.createdLabel).toBeNull();
    expect(await listActiveLabels(database)).toEqual([]);
  });

  test('uses an explicitly selected existing label', async () => {
    await createLabel(database, {
      id: 'friends',
      name: 'Friends',
      color: 'green',
    });

    const result = await createPersonWithLabel(database, {
      person: { id: 'ada', name: 'Ada', description: '' },
      label: { kind: 'existing', id: 'friends' },
      defaultLabelColor: 'blue',
    });

    expect(result.person.labelId).toBe('friends');
    expect(result.createdLabel).toBeNull();
  });

  test('rolls back a new label when saving its person fails', async () => {
    await createPerson(database, {
      id: 'ada',
      name: 'Original Ada',
      description: '',
      labelId: null,
    });

    await expect(
      createPersonWithLabel(database, {
        person: { id: 'ada', name: 'Second Ada', description: '' },
        label: { kind: 'typed', name: 'Friends' },
        defaultLabelColor: 'blue',
      }),
    ).rejects.toThrow();

    expect(await listActiveLabels(database)).toEqual([]);
    expect((await getActivePerson(database, 'ada'))?.name).toBe('Original Ada');
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
    expect(await database.getFirstAsync("SELECT id FROM labels WHERE id = 'source'")).toBeNull();
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
    expect(await database.getFirstAsync("SELECT id FROM labels WHERE id = 'work'")).toBeNull();
  });

  test('removes an empty deleted label but keeps active empty labels', async () => {
    for (const id of ['deleted', 'active']) {
      await createLabel(database, { id, name: id, color: 'green' });
    }
    await deleteLabelAndHandlePeople(database, 'deleted', {
      destinationLabelId: null,
      movePeopleToTrash: false,
    });
    expect(await database.getFirstAsync("SELECT id FROM labels WHERE id = 'deleted'")).toBeNull();
    await expect(emptyTrash(database)).resolves.toBe(0);
    expect((await listActiveLabels(database)).map((label) => label.id)).toEqual(['active']);
  });

  test('keeps a deleted label until the last person in Trash is permanently deleted', async () => {
    await createLabel(database, { id: 'work', name: 'Work', color: 'orange' });
    await createLabel(database, { id: 'active', name: 'Active', color: 'blue' });
    for (const id of ['one', 'two']) {
      await createPerson(database, { id, name: id, description: '', labelId: 'work' });
    }
    await deleteLabelAndHandlePeople(database, 'work', {
      destinationLabelId: null,
      movePeopleToTrash: true,
    });
    await expect(deletePersonPermanently(database, 'one')).resolves.toBe(true);
    expect(await database.getFirstAsync("SELECT id FROM labels WHERE id = 'work'")).not.toBeNull();
    await expect(deletePersonPermanently(database, 'two')).resolves.toBe(true);
    expect(await database.getFirstAsync("SELECT id FROM labels WHERE id = 'work'")).toBeNull();
    expect((await listActiveLabels(database)).map((label) => label.id)).toEqual(['active']);
    await expect(deletePersonPermanently(database, 'two')).resolves.toBe(false);
  });

  test('cleans up old unused labels during an upgrade while preserving all person references', async () => {
    for (const id of ['unused', 'trashed', 'referenced', 'active']) {
      await createLabel(database, { id, name: id, color: 'orange' });
    }
    await createPerson(database, { id: 'trash-person', name: 'Trash', description: '', labelId: 'trashed' });
    await createPerson(database, { id: 'active-person', name: 'Active', description: '', labelId: 'referenced' });
    await movePersonToTrash(database, 'trash-person');
    // Reproduce the records and schema left by version 8, before cleanup existed.
    await database.execAsync(`
      UPDATE labels SET deleted_at = 40 WHERE id != 'active';
      DROP INDEX people_label_id_idx;
      PRAGMA user_version = 8;
    `);

    await migrateDatabase(database);
    expect(await database.getFirstAsync("SELECT id FROM labels WHERE id = 'unused'")).toBeNull();
    expect(await database.getAllAsync('SELECT id FROM labels ORDER BY id')).toEqual([
      { id: 'active' }, { id: 'referenced' }, { id: 'trashed' },
    ]);
    expect(await database.getFirstAsync('PRAGMA user_version')).toEqual({ user_version: 9 });
    expect(await database.getFirstAsync("SELECT name FROM sqlite_master WHERE type = 'index' AND name = 'people_label_id_idx'")).not.toBeNull();
    await expect(restorePerson(database, 'trash-person')).resolves.toMatchObject({
      person: { labelId: 'trashed' }, label: { id: 'trashed', color: 'orange' },
    });
    await expect(migrateDatabase(database)).resolves.toBeUndefined();
  });

  test.each(['person', 'all'])('rolls back permanent deletion of %s when label cleanup fails', async (scope) => {
    await createLabel(database, { id: 'work', name: 'Work', color: 'orange' });
    await createPerson(database, { id: 'ada', name: 'Ada', description: '', labelId: 'work' });
    await deleteLabelAndHandlePeople(database, 'work', {
      destinationLabelId: null,
      movePeopleToTrash: true,
    });
    await database.execAsync(`
      CREATE TRIGGER fail_cleanup BEFORE DELETE ON labels
      BEGIN SELECT RAISE(ABORT, 'Cleanup failed'); END;
    `);
    await expect(scope === 'person'
      ? deletePersonPermanently(database, 'ada')
      : emptyTrash(database)).rejects.toThrow('Cleanup failed');
    expect(await listTrashedPeople(database)).toMatchObject([{ id: 'ada', labelId: 'work' }]);
    expect(await database.getFirstAsync("SELECT id FROM labels WHERE id = 'work'")).not.toBeNull();
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
