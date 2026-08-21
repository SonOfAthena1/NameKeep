import { StatusBar } from 'expo-status-bar';
import { SymbolView } from 'expo-symbols';
import { useEffect, useMemo, useState } from 'react';
import { useSQLiteContext } from 'expo-sqlite';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  LABEL_COLOR_OPTIONS,
  LabelColors,
  type LabelColor,
} from '@/constants/label-colors';
import {
  DESCRIPTION_MAX_LENGTH,
  LABEL_MAX_LENGTH,
  NAME_MAX_LENGTH,
} from '@/constants/data-limits';
import {
  SettingsScreen,
  type SortOrder,
  type TrashedPerson,
} from '@/components/settings-screen';
import type { AppTheme, ThemePreference } from '@/constants/theme';
import {
  createLabel as createLabelRecord,
  deleteLabelAndHandlePeople,
  listActiveLabels,
  updateLabel as updateLabelRecord,
} from '@/database/labels-repository';
import { withWriteTransaction } from '@/database/transactions';
import {
  createPerson as createPersonRecord,
  deletePersonPermanently as deletePersonPermanentlyRecord,
  emptyTrash as emptyTrashRecords,
  listActivePeople,
  listTrashedPeople,
  movePersonToTrash,
  restorePerson as restorePersonRecord,
  updatePerson as updatePersonRecord,
} from '@/database/people-repository';
import {
  getSettings,
  updateSettings,
  type SettingsPatch,
} from '@/database/settings-repository';
import type { Label, Person } from '@/database/types';
import { useAppTheme, useTheme } from '@/hooks/use-theme';

const SAMPLE_LABELS: Label[] = [
  { id: 'work', name: 'Work', color: 'green', createdAt: 1_755_907_200_000 },
  {
    id: 'speech',
    name: 'Speech Class',
    color: 'green',
    createdAt: 1_753_315_200_000,
  },
  { id: 'math', name: 'Math Class', color: 'green', createdAt: 1_748_736_000_000 },
];

const SAMPLE_PEOPLE: Person[] = [
  {
    id: '1',
    name: 'Maya Chen',
    description: 'Frontend developer on the mobile team',
    labelId: 'work',
    createdAt: 1_755_993_600_000,
  },
  {
    id: '2',
    name: 'Jordan Lee',
    description: 'Met at the quarterly planning meeting',
    labelId: 'work',
    createdAt: 1_755_388_800_000,
  },
  {
    id: '3',
    name: 'Sarah',
    description: 'Sits near the front, works at Starbucks',
    labelId: 'speech',
    createdAt: 1_754_784_000_000,
  },
  {
    id: '4',
    name: 'Daniel',
    description: 'Tall guy, CS major',
    labelId: 'speech',
    createdAt: 1_754_179_200_000,
  },
  {
    id: '5',
    name: 'Alex',
    description: 'Study group, likes climbing',
    labelId: 'math',
    createdAt: 1_753_574_400_000,
  },
];

const CONTROL_CORNER_RADIUS = 14;

function sortByOrder<T extends { name: string; createdAt: number }>(
  items: T[],
  order: SortOrder,
) {
  return [...items].sort((a, b) => {
    if (order === 'alphabetical') {
      return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
    }
    return order === 'oldest'
      ? a.createdAt - b.createdAt
      : b.createdAt - a.createdAt;
  });
}

function formatShortDate(timestamp: number) {
  const date = new Date(timestamp);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const year = String(date.getFullYear()).slice(-2);
  return `${month}/${day}/${year}`;
}

type Editor = {
  kind: 'person' | 'label';
  id: string | null;
} | null;

export default function HomeScreen() {
  const [search, setSearch] = useState('');
  const [labels, setLabels] = useState<Label[]>(SAMPLE_LABELS);
  const [people, setPeople] = useState<Person[]>(SAMPLE_PEOPLE);
  const [trash, setTrash] = useState<TrashedPerson[]>([]);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [defaultLabelColor, setDefaultLabelColor] =
    useState<LabelColor>('green');
  const [defaultLabelId, setDefaultLabelId] = useState<string | null>(null);
  const [labelSortOrder, setLabelSortOrder] =
    useState<SortOrder>('newest');
  const [peopleSortOrder, setPeopleSortOrder] =
    useState<SortOrder>('newest');
  const [showDate, setShowDate] = useState(false);
  const [condensedView, setCondensedView] = useState(false);
  const [collapsedLabelIds, setCollapsedLabelIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [isAddMenuOpen, setIsAddMenuOpen] = useState(false);
  const [editor, setEditor] = useState<Editor>(null);
  const [personName, setPersonName] = useState('');
  const [personDescription, setPersonDescription] = useState('');
  const [personLabelId, setPersonLabelId] = useState<string | null>(null);
  const [isLabelPickerOpen, setIsLabelPickerOpen] = useState(false);
  const [labelName, setLabelName] = useState('');
  const [labelColor, setLabelColor] = useState<LabelColor>('green');
  const [labelDeleteId, setLabelDeleteId] = useState<string | null>(null);
  const [deleteDestinationLabelId, setDeleteDestinationLabelId] = useState<
    string | null
  >(null);
  const [isDeleteDestinationPickerOpen, setIsDeleteDestinationPickerOpen] =
    useState(false);
  const [isDatabaseLoading, setIsDatabaseLoading] = useState(true);
  const [databaseLoadError, setDatabaseLoadError] = useState<string | null>(null);
  const [databaseLoadAttempt, setDatabaseLoadAttempt] = useState(0);
  const [isEditorSaving, setIsEditorSaving] = useState(false);
  const [isLabelDeleting, setIsLabelDeleting] = useState(false);
  const db = useSQLiteContext();
  const theme = useTheme();
  const { colorScheme, themePreference, setThemePreference } = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  useEffect(() => {
    let cancelled = false;

    async function loadDatabaseState() {
      setIsDatabaseLoading(true);
      setDatabaseLoadError(null);

      try {
        const [storedLabels, storedPeople, storedTrash, settings] =
          await Promise.all([
            listActiveLabels(db),
            listActivePeople(db),
            listTrashedPeople(db),
            getSettings(db),
          ]);
        if (cancelled) return;

        const loadedLabels: Label[] = storedLabels.map((label) => ({
          id: label.id,
          name: label.name,
          color: label.color,
          createdAt: label.createdAt,
        }));
        const loadedPeople: Person[] = storedPeople.map((person) => ({
          id: person.id,
          name: person.name,
          description: person.description,
          labelId: person.labelId,
          createdAt: person.createdAt,
        }));
        const loadedTrash: TrashedPerson[] = storedTrash.map((person) => ({
          id: person.id,
          name: person.name,
          description: person.description,
          labelId: person.labelId,
          createdAt: person.createdAt,
          deletedAt: person.deletedAt,
        }));

        setLabels(loadedLabels);
        setPeople(loadedPeople);
        setTrash(loadedTrash);
        setDefaultLabelColor(settings.defaultLabelColor);
        setDefaultLabelId(
          loadedLabels.some((label) => label.id === settings.defaultLabelId)
            ? settings.defaultLabelId
            : null,
        );
        setLabelSortOrder(settings.labelSortOrder);
        setPeopleSortOrder(settings.peopleSortOrder);
        setShowDate(settings.showDate);
        setCondensedView(settings.condensedView);
        setThemePreference(settings.themePreference);
      } catch (error) {
        if (cancelled) return;
        console.error('Could not load database state', error);
        setDatabaseLoadError(
          error instanceof Error ? error.message : 'Unknown database error',
        );
      } finally {
        if (!cancelled) setIsDatabaseLoading(false);
      }
    }

    void loadDatabaseState();
    return () => {
      cancelled = true;
    };
  }, [databaseLoadAttempt, db, setThemePreference]);

  const sections = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();

    const labeledSections = sortByOrder(labels, labelSortOrder)
      .map((label) => {
        const labelMatches = label.name.toLocaleLowerCase().includes(query);
        const sectionPeople = people.filter((person) => person.labelId === label.id)
          .filter(
            (person) =>
              !query ||
              labelMatches ||
              person.name.toLocaleLowerCase().includes(query) ||
              person.description.toLocaleLowerCase().includes(query),
          )
        const sortedPeople = sortByOrder(sectionPeople, peopleSortOrder);

        return { label, people: sortedPeople };
      })
      .filter(({ people: sectionPeople }) => !query || sectionPeople.length > 0);

    const unlabeledPeople = people
      .filter((person) => person.labelId === null)
      .filter(
        (person) =>
          !query ||
          'no label'.includes(query) ||
          person.name.toLocaleLowerCase().includes(query) ||
          person.description.toLocaleLowerCase().includes(query),
      )
    const sortedUnlabeledPeople = sortByOrder(unlabeledPeople, peopleSortOrder);

    if (sortedUnlabeledPeople.length > 0) {
      labeledSections.push({
        label: {
          id: 'no-label',
          name: 'No Label',
          color: 'green',
          createdAt: Number.MIN_SAFE_INTEGER,
        },
        people: sortedUnlabeledPeople,
      });
    }

    return labeledSections;
  }, [labelSortOrder, labels, people, peopleSortOrder, search]);

  const selectedLabelName =
    labels.find((label) => label.id === personLabelId)?.name ?? 'No Label';
  const labelBeingDeleted = labels.find((label) => label.id === labelDeleteId);
  const deleteDestinationLabelName =
    labels.find((label) => label.id === deleteDestinationLabelId)?.name ??
    'No Label';
  const peopleInDeletedLabel = people.filter(
    (person) => person.labelId === labelDeleteId,
  ).length;
  const areAllVisibleSectionsCollapsed =
    sections.length > 0 &&
    sections.every(({ label }) => collapsedLabelIds.has(label.id));

  function toggleLabel(labelId: string) {
    setCollapsedLabelIds((current) => {
      const next = new Set(current);
      if (next.has(labelId)) {
        next.delete(labelId);
      } else {
        next.add(labelId);
      }
      return next;
    });
  }

  function toggleAllLabels() {
    const visibleLabelIds = sections.map(({ label }) => label.id);
    setCollapsedLabelIds((current) => {
      const next = new Set(current);
      if (areAllVisibleSectionsCollapsed) {
        visibleLabelIds.forEach((labelId) => next.delete(labelId));
      } else {
        visibleLabelIds.forEach((labelId) => next.add(labelId));
      }
      return next;
    });
  }

  function openSettings() {
    setIsAddMenuOpen(false);
    setIsSettingsOpen(true);
  }

  function openCreateModal(kind: 'person' | 'label') {
    setIsAddMenuOpen(false);
    if (kind === 'person') {
      setPersonLabelId(
        labels.some((label) => label.id === defaultLabelId)
          ? defaultLabelId
          : null,
      );
    } else {
      setLabelColor(defaultLabelColor);
    }
    setEditor({ kind, id: null });
  }

  function openPersonEditor(person: Person) {
    setIsAddMenuOpen(false);
    setPersonName(person.name);
    setPersonDescription(person.description);
    setPersonLabelId(person.labelId);
    setEditor({ kind: 'person', id: person.id });
  }

  function openLabelEditor(label: Label) {
    setIsAddMenuOpen(false);
    setLabelName(label.name);
    setLabelColor(label.color);
    setEditor({ kind: 'label', id: label.id });
  }

  function closeEditor() {
    setEditor(null);
    setIsLabelPickerOpen(false);
    setPersonName('');
    setPersonDescription('');
    setPersonLabelId(null);
    setLabelName('');
    setLabelColor(defaultLabelColor);
  }

  function showMutationError(action: string, error: unknown) {
    console.error(`Could not ${action}`, error);
    const message = `NameKeep couldn’t ${action}. Your saved data has not been changed.`;
    if (Platform.OS === 'web') {
      globalThis.alert(message);
      return;
    }
    Alert.alert('Couldn’t save changes', message);
  }

  async function persistSetting(
    patch: SettingsPatch,
    applyToApp: () => void,
  ) {
    try {
      await updateSettings(db, patch);
      applyToApp();
    } catch (error) {
      showMutationError('save this setting', error);
    }
  }

  function changeThemePreference(preference: ThemePreference) {
    void persistSetting(
      { themePreference: preference },
      () => setThemePreference(preference),
    );
  }

  function changeDefaultLabelColor(color: LabelColor) {
    void persistSetting(
      { defaultLabelColor: color },
      () => setDefaultLabelColor(color),
    );
  }

  function changeDefaultLabelId(labelId: string | null) {
    void persistSetting(
      { defaultLabelId: labelId },
      () => setDefaultLabelId(labelId),
    );
  }

  function changeLabelSortOrder(order: SortOrder) {
    void persistSetting(
      { labelSortOrder: order },
      () => setLabelSortOrder(order),
    );
  }

  function changePeopleSortOrder(order: SortOrder) {
    void persistSetting(
      { peopleSortOrder: order },
      () => setPeopleSortOrder(order),
    );
  }

  function changeShowDate(value: boolean) {
    void persistSetting({ showDate: value }, () => setShowDate(value));
  }

  function changeCondensedView(value: boolean) {
    void persistSetting(
      { condensedView: value },
      () => setCondensedView(value),
    );
  }

  async function savePerson() {
    if (isEditorSaving) return;

    const updates = {
      name: personName.trim(),
      description: personDescription.trim(),
      labelId: personLabelId,
    };

    setIsEditorSaving(true);
    try {
      if (editor?.kind === 'person' && editor.id) {
        const personId = editor.id;
        const updated = await updatePersonRecord(db, personId, updates);
        if (!updated) throw new Error(`Person ${personId} was not found.`);
        setPeople((current) =>
          current.map((person) =>
            person.id === personId ? { ...person, ...updates } : person,
          ),
        );
      } else {
        const createdAt = Date.now();
        const person: Person = {
          id: `person-${createdAt}-${Math.random().toString(36).slice(2, 8)}`,
          ...updates,
          createdAt,
        };
        await createPersonRecord(db, person);
        setPeople((current) => [...current, person]);
      }
      closeEditor();
    } catch (error) {
      showMutationError('save this person', error);
    } finally {
      setIsEditorSaving(false);
    }
  }

  async function saveLabel() {
    if (isEditorSaving) return;

    const trimmedName = labelName.trim();
    if (!trimmedName) {
      return;
    }

    setIsEditorSaving(true);
    try {
      if (editor?.kind === 'label' && editor.id) {
        const labelId = editor.id;
        const updated = await updateLabelRecord(db, labelId, {
          name: trimmedName,
          color: labelColor,
        });
        if (!updated) throw new Error(`Label ${labelId} was not found.`);
        setLabels((current) =>
          current.map((label) =>
            label.id === labelId
              ? { ...label, name: trimmedName, color: labelColor }
              : label,
          ),
        );
      } else {
        const createdAt = Date.now();
        const label: Label = {
          id: `label-${createdAt}-${Math.random().toString(36).slice(2, 8)}`,
          name: trimmedName,
          color: labelColor,
          createdAt,
        };
        await createLabelRecord(db, label);
        setLabels((current) => [...current, label]);
      }
      closeEditor();
    } catch (error) {
      showMutationError('save this label', error);
    } finally {
      setIsEditorSaving(false);
    }
  }

  function deleteEditedItem() {
    if (!editor?.id) {
      return;
    }

    const { id, kind } = editor;
    if (kind === 'label') {
      setLabelDeleteId(id);
      setDeleteDestinationLabelId(null);
      setIsDeleteDestinationPickerOpen(false);
      closeEditor();
      return;
    }

    const itemName =
      people.find((person) => person.id === id)?.name || 'this person';
    const message = `Move “${itemName}” to Trash? You can restore them later.`;

    const performDelete = async () => {
      const deletedPerson = people.find((person) => person.id === id);
      if (!deletedPerson) return;

      const deletedAt = Date.now();
      try {
        const moved = await movePersonToTrash(db, id, deletedAt);
        if (!moved) throw new Error(`Person ${id} was not found.`);
        setTrash((currentTrash) => [
          { ...deletedPerson, deletedAt },
          ...currentTrash,
        ]);
        setPeople((current) => current.filter((person) => person.id !== id));
        closeEditor();
      } catch (error) {
        showMutationError('move this person to Trash', error);
      }
    };

    if (Platform.OS === 'web') {
      if (globalThis.confirm(message)) {
        void performDelete();
      }
      return;
    }

    Alert.alert(
      'Move to Trash?',
      message,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Move to Trash',
          style: 'destructive',
          onPress: () => void performDelete(),
        },
      ],
    );
  }

  function closeLabelDeleteDialog() {
    setLabelDeleteId(null);
    setDeleteDestinationLabelId(null);
    setIsDeleteDestinationPickerOpen(false);
  }

  function cancelLabelDeletion() {
    if (isLabelDeleting) return;

    const label = labels.find((candidate) => candidate.id === labelDeleteId);
    closeLabelDeleteDialog();
    if (label) {
      openLabelEditor(label);
    }
  }

  async function confirmLabelDeletion(movePeopleToTrash: boolean) {
    if (!labelDeleteId || isLabelDeleting) {
      return;
    }

    const deletedLabelId = labelDeleteId;
    const deletedPeople = movePeopleToTrash
      ? people.filter((person) => person.labelId === deletedLabelId)
      : [];
    const deletedAt = Date.now();

    setIsLabelDeleting(true);
    try {
      await deleteLabelAndHandlePeople(
        db,
        deletedLabelId,
        {
          destinationLabelId: deleteDestinationLabelId,
          movePeopleToTrash,
        },
        deletedAt,
      );

      if (deletedPeople.length > 0) {
        setTrash((currentTrash) => [
          ...deletedPeople.map((person) => ({ ...person, deletedAt })),
          ...currentTrash,
        ]);
      }

      setPeople((current) => {
        if (movePeopleToTrash) {
          return current.filter((person) => person.labelId !== deletedLabelId);
        }
        return current.map((person) =>
          person.labelId === deletedLabelId
            ? { ...person, labelId: deleteDestinationLabelId }
            : person,
        );
      });
      setLabels((current) =>
        current.filter((label) => label.id !== deletedLabelId),
      );
      setCollapsedLabelIds((current) => {
        const next = new Set(current);
        next.delete(deletedLabelId);
        return next;
      });
      if (defaultLabelId === deletedLabelId) {
        setDefaultLabelId(null);
      }
      closeLabelDeleteDialog();
    } catch (error) {
      showMutationError('delete this label', error);
    } finally {
      setIsLabelDeleting(false);
    }
  }

  async function restorePerson(personId: string) {
    const restoredPerson = trash.find((person) => person.id === personId);
    if (!restoredPerson) return;

    const restoredLabelId = labels.some(
      (label) => label.id === restoredPerson.labelId,
    )
      ? restoredPerson.labelId
      : null;
    const person: Person = {
      id: restoredPerson.id,
      name: restoredPerson.name,
      description: restoredPerson.description,
      labelId: restoredLabelId,
      createdAt: restoredPerson.createdAt,
    };

    try {
      const restored = await restorePersonRecord(db, personId);
      if (!restored) throw new Error(`Person ${personId} was not found in Trash.`);
      setPeople((current) => [...current, person]);
      setTrash((current) => current.filter((item) => item.id !== personId));
    } catch (error) {
      showMutationError('restore this person', error);
    }
  }

  async function deletePersonForever(personId: string) {
    try {
      const deleted = await deletePersonPermanentlyRecord(db, personId);
      if (!deleted) throw new Error(`Person ${personId} was not found in Trash.`);
      setTrash((current) => current.filter((person) => person.id !== personId));
    } catch (error) {
      showMutationError('permanently delete this person', error);
    }
  }

  async function emptyTrash() {
    try {
      await emptyTrashRecords(db);
      setTrash([]);
    } catch (error) {
      showMutationError('empty Trash', error);
    }
  }

  async function importPeople(
    importedPeople: Person[],
    importedLabels: Label[],
  ) {
    await withWriteTransaction(db, async (db) => {
      for (const label of importedLabels) {
        await createLabelRecord(db, label);
      }
      for (const person of importedPeople) {
        await createPersonRecord(db, person);
      }
    });
    setLabels((current) => [...current, ...importedLabels]);
    setPeople((current) => [...current, ...importedPeople]);
  }

  if (isDatabaseLoading) {
    return (
      <View style={styles.screen}>
        <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
        <View pointerEvents="none" style={styles.glowTop} />
        <SafeAreaView style={styles.databaseStateScreen}>
          <ActivityIndicator color={theme.accent} size="large" />
          <Text style={styles.databaseStateTitle}>Loading NameKeep</Text>
          <Text style={styles.databaseStateText}>Opening your saved people…</Text>
        </SafeAreaView>
      </View>
    );
  }

  if (databaseLoadError) {
    return (
      <View style={styles.screen}>
        <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
        <View pointerEvents="none" style={styles.glowTop} />
        <SafeAreaView style={styles.databaseStateScreen}>
          <View style={styles.databaseErrorIcon}>
            <SymbolView
              name={{ ios: 'exclamationmark.triangle', android: 'warning', web: 'warning' }}
              size={25}
              tintColor={theme.danger}
            />
          </View>
          <Text style={styles.databaseStateTitle}>Couldn’t load your data</Text>
          <Text style={styles.databaseStateText}>
            NameKeep couldn’t open its database. Your saved data has not been changed.
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => setDatabaseLoadAttempt((attempt) => attempt + 1)}
            style={({ pressed }) => [
              styles.databaseRetryButton,
              pressed && styles.databaseRetryButtonPressed,
            ]}>
            <Text style={styles.databaseRetryButtonText}>Try Again</Text>
          </Pressable>
        </SafeAreaView>
      </View>
    );
  }

  if (isSettingsOpen) {
    return (
      <SettingsScreen
        condensedView={condensedView}
        defaultLabelColor={defaultLabelColor}
        defaultLabelId={defaultLabelId}
        labelSortOrder={labelSortOrder}
        labels={labels}
        people={people}
        onBack={() => setIsSettingsOpen(false)}
        onDeleteForever={deletePersonForever}
        onEmptyTrash={emptyTrash}
        onImportPeople={importPeople}
        onRestore={restorePerson}
        peopleSortOrder={peopleSortOrder}
        setDefaultLabelColor={changeDefaultLabelColor}
        setDefaultLabelId={changeDefaultLabelId}
        setLabelSortOrder={changeLabelSortOrder}
        setPeopleSortOrder={changePeopleSortOrder}
        setCondensedView={changeCondensedView}
        setShowDate={changeShowDate}
        showDate={showDate}
        setThemePreference={changeThemePreference}
        themePreference={themePreference}
        trash={trash}
      />
    );
  }

  return (
    <View style={styles.screen}>
      <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
      <View pointerEvents="none" style={styles.glowTop} />
      <View pointerEvents="none" style={styles.glowBottom} />

      <SafeAreaView style={styles.safeArea}>
        <View style={[styles.header, condensedView && styles.headerCondensed]}>
          <Text style={styles.title}>People you’ve met</Text>

          <View style={styles.brandRow}>
            <View style={styles.brandMark}>
              <Text style={styles.brandInitial}>N</Text>
            </View>
            <Text style={styles.brandName}>NameKeep</Text>
          </View>
        </View>

        <View
          style={[
            styles.searchRow,
            condensedView && styles.searchRowCondensed,
          ]}>
          <View style={styles.searchBox}>
            <View style={styles.searchIcon}>
              <View style={styles.searchLens} />
              <View style={styles.searchHandle} />
            </View>
            <TextInput
              accessibilityLabel="Search people"
              autoCapitalize="none"
              autoCorrect={false}
              clearButtonMode="while-editing"
              onChangeText={setSearch}
              placeholder="Search people..."
              placeholderTextColor={theme.textFaint}
              returnKeyType="search"
              selectionColor={theme.accent}
              style={styles.searchInput}
              value={search}
            />
          </View>
          <Pressable
            accessibilityLabel="Open settings"
            accessibilityRole="button"
            onPress={openSettings}
            style={({ pressed }) => [
              styles.settingsButton,
              pressed && styles.settingsButtonPressed,
            ]}>
            <SymbolView
              name={{ ios: 'gearshape', android: 'settings', web: 'settings' }}
              size={21}
              tintColor={theme.textSecondary}
            />
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={[
            styles.listContent,
            condensedView && styles.listContentCondensed,
          ]}
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          <View
            style={[
              styles.listHeadingRow,
              condensedView && styles.listHeadingRowCondensed,
            ]}>
            <View style={styles.listHeadingLabelGroup}>
              {sections.length > 0 && (
                <Pressable
                  accessibilityLabel={
                    areAllVisibleSectionsCollapsed
                      ? 'Open all labels'
                      : 'Collapse all labels'
                  }
                  accessibilityRole="button"
                  hitSlop={9}
                  onPress={toggleAllLabels}
                  style={({ pressed }) => [
                    styles.collapseAllButton,
                    pressed && styles.collapseAllButtonPressed,
                  ]}>
                  <SymbolView
                    name={{
                      ios: 'chevron.right',
                      android: 'chevron_right',
                      web: 'chevron_right',
                    }}
                    size={17}
                    tintColor={theme.accent}
                    style={{
                      transform: [
                        {
                          rotate: areAllVisibleSectionsCollapsed
                            ? '0deg'
                            : '90deg',
                        },
                      ],
                    }}
                  />
                </Pressable>
              )}
              <Text style={styles.listHeading}>YOUR LABELS</Text>
            </View>
            <Text style={styles.peopleCount}>
              {people.length} {people.length === 1 ? 'person' : 'people'}
            </Text>
          </View>

          {sections.map(({ label, people }) => {
            const isCollapsed = collapsedLabelIds.has(label.id);
            const labelTheme = LabelColors[colorScheme][label.color];

            return (
              <View
                key={label.id}
                style={[
                  styles.section,
                  condensedView && styles.sectionCondensed,
                  { borderColor: labelTheme.base },
                ]}>
                <View
                  style={[
                    styles.sectionHeader,
                    condensedView && styles.sectionHeaderCondensed,
                    { backgroundColor: labelTheme.base },
                  ]}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ expanded: !isCollapsed }}
                    onPress={() => toggleLabel(label.id)}
                    style={({ pressed }) => [
                      styles.sectionToggle,
                      condensedView && styles.sectionToggleCondensed,
                      label.id === 'no-label' && styles.sectionToggleWithoutEdit,
                      {
                        backgroundColor: pressed ? labelTheme.pressed : labelTheme.base,
                      },
                    ]}>
                    <View
                      style={[styles.chevronBox, { backgroundColor: labelTheme.foreground }]}>
                      <SymbolView
                        name={{
                          ios: 'chevron.right',
                          android: 'chevron_right',
                          web: 'chevron_right',
                        }}
                        size={17}
                        tintColor={labelTheme.base}
                        style={{ transform: [{ rotate: isCollapsed ? '0deg' : '90deg' }] }}
                      />
                    </View>
                    <Text
                      style={[
                        styles.sectionTitle,
                        condensedView && styles.sectionTitleCondensed,
                        { color: labelTheme.foreground },
                      ]}>
                      {label.name}
                    </Text>
                      <View
                      style={styles.countPill}>
                      <Text
                        style={[
                          styles.countText,
                          condensedView && styles.countTextCondensed,
                          { color: labelTheme.foreground },
                        ]}>
                        {people.length}
                      </Text>
                    </View>
                  </Pressable>
                  {label.id !== 'no-label' && (
                    <Pressable
                      accessibilityLabel={`Edit ${label.name} label`}
                      accessibilityRole="button"
                      hitSlop={10}
                      onPress={() => openLabelEditor(label)}
                      style={({ pressed }) => [
                        styles.labelEditButton,
                        pressed && styles.editButtonPressed,
                      ]}>
                      <SymbolView
                        name={{ ios: 'pencil', android: 'edit', web: 'edit' }}
                        size={18}
                        tintColor={labelTheme.foreground}
                      />
                    </Pressable>
                  )}
                </View>

                {!isCollapsed && people.length > 0 && (
                  <View
                    style={[
                      styles.peopleList,
                      condensedView && styles.peopleListCondensed,
                    ]}>
                    {people.map((person, index) => (
                      <View
                        key={person.id}
                        style={[
                          styles.personRow,
                          condensedView && styles.personRowCondensed,
                          index > 0 && !condensedView && styles.personDivider,
                        ]}>
                        <View style={styles.personCopy}>
                          <Text style={styles.personLine}>
                            <Text
                              style={[
                                styles.personName,
                                condensedView && styles.personNameCondensed,
                              ]}>
                              {person.name || 'Unnamed person'}
                            </Text>
                            {!!person.description && (
                              <Text style={styles.personDescription}>
                                {' '}— {person.description}
                              </Text>
                            )}
                            {showDate && (
                              <Text style={styles.personDate}>
                                {' '}({formatShortDate(person.createdAt)})
                              </Text>
                            )}
                          </Text>
                        </View>
                        <Pressable
                          accessibilityLabel={`Edit ${person.name || 'unnamed person'}`}
                          accessibilityRole="button"
                          hitSlop={10}
                          onPress={() => openPersonEditor(person)}
                          style={({ pressed }) => [
                            styles.personEditButton,
                            pressed && styles.editButtonPressed,
                          ]}>
                          <SymbolView
                            name={{ ios: 'pencil', android: 'edit', web: 'edit' }}
                            size={18}
                            tintColor={theme.textMuted}
                          />
                        </Pressable>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            );
          })}

          {people.length === 0 && (
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>Go meet people!</Text>
              <Text style={styles.emptyText}>
                Then add them with the + button below
              </Text>
            </View>
          )}

          {people.length > 0 && sections.length === 0 && (
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>No one found</Text>
              <Text style={styles.emptyText}>Try a different name or detail.</Text>
            </View>
          )}
        </ScrollView>

        {isAddMenuOpen && (
          <View style={styles.addMenu}>
            <Pressable
              accessibilityRole="button"
              onPress={() => openCreateModal('person')}
              style={({ pressed }) => [
                styles.addMenuButton,
                pressed && styles.addMenuButtonPressed,
              ]}>
              <SymbolView
                name={{ ios: 'person.badge.plus', android: 'person_add', web: 'person_add' }}
                size={20}
                tintColor={theme.accent}
              />
              <Text style={styles.addMenuButtonText}>New Person</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => openCreateModal('label')}
              style={({ pressed }) => [
                styles.addMenuButton,
                pressed && styles.addMenuButtonPressed,
              ]}>
              <SymbolView
                name={{ ios: 'tag.fill', android: 'label', web: 'label' }}
                size={19}
                tintColor={theme.accent}
              />
              <Text style={styles.addMenuButtonText}>New Label</Text>
            </Pressable>
          </View>
        )}

        <Pressable
          accessibilityLabel={isAddMenuOpen ? 'Close add menu' : 'Open add menu'}
          accessibilityRole="button"
          accessibilityState={{ expanded: isAddMenuOpen }}
          onPress={() => setIsAddMenuOpen((current) => !current)}
          style={({ pressed }) => [styles.addButton, pressed && styles.addButtonPressed]}>
          <Text style={[styles.addButtonText, isAddMenuOpen && styles.addButtonTextOpen]}>＋</Text>
        </Pressable>
      </SafeAreaView>

      <Modal
        animationType="fade"
        onRequestClose={closeEditor}
        presentationStyle="overFullScreen"
        transparent
        visible={editor !== null}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalKeyboardView}>
          <Pressable
            accessibilityLabel="Close dialog"
            onPress={closeEditor}
            style={styles.modalBackdrop}>
            <Pressable
              accessibilityRole="none"
              onPress={(event) => event.stopPropagation()}
              style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <View>
                  <Text style={styles.modalEyebrow}>
                    {editor?.id ? 'EDIT IN NAMEKEEP' : 'ADD TO NAMEKEEP'}
                  </Text>
                  <Text style={styles.modalTitle}>
                    {editor?.kind === 'person'
                      ? editor.id ? 'Edit Person' : 'New Person'
                      : editor?.id ? 'Edit Label' : 'New Label'}
                  </Text>
                </View>
                <Pressable
                  accessibilityLabel="Close dialog"
                  accessibilityRole="button"
                  hitSlop={10}
                  onPress={closeEditor}
                  style={({ pressed }) => [
                    styles.modalCloseButton,
                    pressed && styles.modalCloseButtonPressed,
                  ]}>
                  <SymbolView
                    name={{ ios: 'xmark', android: 'close', web: 'close' }}
                    size={18}
                    tintColor={theme.textMuted}
                  />
                </Pressable>
              </View>

              {editor?.kind === 'person' ? (
                <>
                  <View style={styles.fieldGroup}>
                    <View style={styles.fieldLabelRow}>
                      <Text style={styles.fieldLabel}>Name</Text>
                      <Text style={styles.characterCount}>
                        {personName.length}/{NAME_MAX_LENGTH}
                      </Text>
                    </View>
                    <TextInput
                      autoCapitalize="words"
                      maxLength={NAME_MAX_LENGTH}
                      onChangeText={setPersonName}
                      placeholder="Their name (if you know it)"
                      placeholderTextColor={theme.textFaint}
                      selectionColor={theme.accent}
                      style={styles.fieldInput}
                      value={personName}
                    />
                  </View>

                  <View style={styles.fieldGroup}>
                    <View style={styles.fieldLabelRow}>
                      <Text style={styles.fieldLabel}>Description</Text>
                      <Text style={styles.characterCount}>
                        {personDescription.length}/{DESCRIPTION_MAX_LENGTH}
                      </Text>
                    </View>
                    <TextInput
                      maxLength={DESCRIPTION_MAX_LENGTH}
                      multiline
                      numberOfLines={2}
                      onChangeText={setPersonDescription}
                      placeholder="Where you met, what they look like, or anything memorable"
                      placeholderTextColor={theme.textFaint}
                      selectionColor={theme.accent}
                      style={[styles.fieldInput, styles.descriptionInput]}
                      textAlignVertical="top"
                      value={personDescription}
                    />
                  </View>

                  <View style={styles.fieldGroup}>
                    <Text style={[styles.fieldLabel, styles.fieldLabelStandalone]}>Label</Text>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityState={{ expanded: isLabelPickerOpen }}
                      onPress={() => setIsLabelPickerOpen((current) => !current)}
                      style={({ pressed }) => [
                        styles.labelSelect,
                        pressed && styles.labelSelectPressed,
                      ]}>
                      <Text style={styles.labelSelectText}>{selectedLabelName}</Text>
                      <SymbolView
                        name={{
                          ios: 'chevron.down',
                          android: 'keyboard_arrow_down',
                          web: 'keyboard_arrow_down',
                        }}
                        size={18}
                        tintColor={theme.textMuted}
                        style={{
                          transform: [{ rotate: isLabelPickerOpen ? '180deg' : '0deg' }],
                        }}
                      />
                    </Pressable>
                    {isLabelPickerOpen && (
                      <ScrollView
                        keyboardShouldPersistTaps="handled"
                        nestedScrollEnabled
                        showsVerticalScrollIndicator={false}
                        style={styles.labelOptions}>
                        <Pressable
                          onPress={() => {
                            setPersonLabelId(null);
                            setIsLabelPickerOpen(false);
                          }}
                          style={({ pressed }) => [
                            styles.labelOption,
                            personLabelId === null && styles.labelOptionSelected,
                            pressed && styles.labelOptionPressed,
                          ]}>
                          <Text style={styles.labelOptionText}>No Label</Text>
                          {personLabelId === null && (
                            <SymbolView
                              name={{ ios: 'checkmark', android: 'check', web: 'check' }}
                              size={17}
                              tintColor={theme.accent}
                            />
                          )}
                        </Pressable>
                        {labels.map((label) => (
                          <Pressable
                            key={label.id}
                            onPress={() => {
                              setPersonLabelId(label.id);
                              setIsLabelPickerOpen(false);
                            }}
                            style={({ pressed }) => [
                              styles.labelOption,
                              personLabelId === label.id && styles.labelOptionSelected,
                              pressed && styles.labelOptionPressed,
                            ]}>
                            <Text style={styles.labelOptionText}>{label.name}</Text>
                            {personLabelId === label.id && (
                              <SymbolView
                                name={{ ios: 'checkmark', android: 'check', web: 'check' }}
                                size={17}
                                tintColor={theme.accent}
                              />
                            )}
                          </Pressable>
                        ))}
                      </ScrollView>
                    )}
                  </View>
                </>
              ) : (
                <View style={styles.fieldGroup}>
                  <View style={styles.fieldLabelRow}>
                    <Text style={styles.fieldLabel}>Label name</Text>
                    <Text style={styles.characterCount}>
                      {labelName.length}/{LABEL_MAX_LENGTH}
                    </Text>
                  </View>
                  <TextInput
                    autoCapitalize="words"
                    autoFocus
                    maxLength={LABEL_MAX_LENGTH}
                    onChangeText={setLabelName}
                    onSubmitEditing={saveLabel}
                    placeholder="For example, Work or Biology"
                    placeholderTextColor={theme.textFaint}
                    returnKeyType="done"
                    selectionColor={theme.accent}
                    style={styles.fieldInput}
                    value={labelName}
                  />
                  <Text style={[styles.fieldLabel, styles.colorFieldLabel]}>Color</Text>
                  <View style={styles.colorOptions}>
                    {LABEL_COLOR_OPTIONS.map((option) => {
                      const optionTheme = LabelColors[colorScheme][option.id];
                      const isSelected = labelColor === option.id;

                      return (
                        <Pressable
                          accessibilityLabel={`${option.name} label color`}
                          accessibilityRole="radio"
                          accessibilityState={{ checked: isSelected }}
                          key={option.id}
                          onPress={() => setLabelColor(option.id)}
                          style={({ pressed }) => [
                            styles.colorOption,
                            isSelected && styles.colorOptionSelected,
                            pressed && styles.colorOptionPressed,
                          ]}>
                          <View
                            style={[
                              styles.colorSwatch,
                              { backgroundColor: optionTheme.base },
                            ]}>
                            {isSelected && (
                              <SymbolView
                                name={{ ios: 'checkmark', android: 'check', web: 'check' }}
                                size={18}
                                tintColor={optionTheme.foreground}
                              />
                            )}
                          </View>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              )}

              <View
                style={[
                  styles.modalActions,
                  !!editor?.id && styles.editorModalActions,
                ]}>
                {!!editor?.id && (
                  <Pressable
                    accessibilityRole="button"
                    disabled={isEditorSaving}
                    onPress={deleteEditedItem}
                    style={({ pressed }) => [
                      styles.deleteButton,
                      isEditorSaving && styles.saveButtonDisabled,
                      pressed && styles.deleteButtonPressed,
                    ]}>
                    <SymbolView
                      name={{ ios: 'trash', android: 'delete', web: 'delete' }}
                      size={17}
                      tintColor="#FFFFFF"
                    />
                    <Text style={styles.deleteButtonText}>Delete</Text>
                  </Pressable>
                )}
                <Pressable
                  accessibilityRole="button"
                  disabled={isEditorSaving}
                  onPress={closeEditor}
                  style={({ pressed }) => [
                    styles.cancelButton,
                    isEditorSaving && styles.saveButtonDisabled,
                    pressed && styles.cancelButtonPressed,
                  ]}>
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  disabled={
                    isEditorSaving ||
                    (editor?.kind === 'label' && !labelName.trim())
                  }
                  onPress={editor?.kind === 'person' ? savePerson : saveLabel}
                  style={({ pressed }) => [
                    styles.saveButton,
                    !!editor?.id && styles.editorSaveButton,
                    (isEditorSaving ||
                      (editor?.kind === 'label' && !labelName.trim())) &&
                      styles.saveButtonDisabled,
                    pressed && styles.saveButtonPressed,
                  ]}>
                  <Text style={styles.saveButtonText}>
                    {isEditorSaving
                      ? 'Saving…'
                      : editor?.id
                      ? 'Save'
                      : editor?.kind === 'person' ? 'Add Person' : 'Add Label'}
                  </Text>
                </Pressable>
              </View>
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>

      <Modal
        animationType="fade"
        onRequestClose={cancelLabelDeletion}
        presentationStyle="overFullScreen"
        transparent
        visible={labelDeleteId !== null}>
        <Pressable
          accessibilityLabel="Close delete label dialog"
          onPress={cancelLabelDeletion}
          style={styles.modalBackdrop}>
          <Pressable
            accessibilityRole="none"
            onPress={(event) => event.stopPropagation()}
            style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderCopy}>
                <Text style={styles.deleteModalEyebrow}>DELETE LABEL</Text>
                <Text style={styles.modalTitle}>
                  Delete “{labelBeingDeleted?.name ?? 'label'}”?
                </Text>
              </View>
              <Pressable
                accessibilityLabel="Close delete label dialog"
                accessibilityRole="button"
                accessibilityState={{ disabled: isLabelDeleting }}
                disabled={isLabelDeleting}
                hitSlop={10}
                onPress={cancelLabelDeletion}
                style={({ pressed }) => [
                  styles.modalCloseButton,
                  pressed && styles.modalCloseButtonPressed,
                ]}>
                <SymbolView
                  name={{ ios: 'xmark', android: 'close', web: 'close' }}
                  size={18}
                  tintColor={theme.textMuted}
                />
              </Pressable>
            </View>

            <Text style={styles.deleteModalDescription}>
              This label contains {peopleInDeletedLabel}{' '}
              {peopleInDeletedLabel === 1 ? 'person' : 'people'}. Choose whether to
              move them or delete them with the label.
            </Text>

            <View style={styles.fieldGroup}>
              <Text style={[styles.fieldLabel, styles.fieldLabelStandalone]}>
                Move people to
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{
                  disabled: isLabelDeleting,
                  expanded: isDeleteDestinationPickerOpen,
                }}
                disabled={isLabelDeleting}
                onPress={() =>
                  setIsDeleteDestinationPickerOpen((current) => !current)
                }
                style={({ pressed }) => [
                  styles.labelSelect,
                  pressed && styles.labelSelectPressed,
                ]}>
                <Text style={styles.labelSelectText}>
                  {deleteDestinationLabelName}
                </Text>
                <SymbolView
                  name={{
                    ios: 'chevron.down',
                    android: 'keyboard_arrow_down',
                    web: 'keyboard_arrow_down',
                  }}
                  size={18}
                  tintColor={theme.textMuted}
                  style={{
                    transform: [
                      {
                        rotate: isDeleteDestinationPickerOpen ? '180deg' : '0deg',
                      },
                    ],
                  }}
                />
              </Pressable>
              {isDeleteDestinationPickerOpen && (
                <ScrollView
                  nestedScrollEnabled
                  showsVerticalScrollIndicator={false}
                  style={styles.labelOptions}>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => {
                      setDeleteDestinationLabelId(null);
                      setIsDeleteDestinationPickerOpen(false);
                    }}
                    style={({ pressed }) => [
                      styles.labelOption,
                      deleteDestinationLabelId === null && styles.labelOptionSelected,
                      pressed && styles.labelOptionPressed,
                    ]}>
                    <Text style={styles.labelOptionText}>No Label</Text>
                    {deleteDestinationLabelId === null && (
                      <SymbolView
                        name={{ ios: 'checkmark', android: 'check', web: 'check' }}
                        size={17}
                        tintColor={theme.accent}
                      />
                    )}
                  </Pressable>
                  {labels
                    .filter((label) => label.id !== labelDeleteId)
                    .map((label) => (
                      <Pressable
                        accessibilityRole="button"
                        key={label.id}
                        onPress={() => {
                          setDeleteDestinationLabelId(label.id);
                          setIsDeleteDestinationPickerOpen(false);
                        }}
                        style={({ pressed }) => [
                          styles.labelOption,
                          deleteDestinationLabelId === label.id &&
                            styles.labelOptionSelected,
                          pressed && styles.labelOptionPressed,
                        ]}>
                        <Text style={styles.labelOptionText}>{label.name}</Text>
                        {deleteDestinationLabelId === label.id && (
                          <SymbolView
                            name={{ ios: 'checkmark', android: 'check', web: 'check' }}
                            size={17}
                            tintColor={theme.accent}
                          />
                        )}
                      </Pressable>
                    ))}
                </ScrollView>
              )}
            </View>

            <View style={styles.deleteDecisionActions}>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ disabled: isLabelDeleting }}
                disabled={isLabelDeleting}
                onPress={() => confirmLabelDeletion(false)}
                style={({ pressed }) => [
                  styles.moveAndDeleteButton,
                  pressed && styles.moveAndDeleteButtonPressed,
                  isLabelDeleting && styles.saveButtonDisabled,
                ]}>
                <Text style={styles.moveAndDeleteButtonText}>
                  {isLabelDeleting
                    ? 'Deleting…'
                    : `Move ${peopleInDeletedLabel} ${
                        peopleInDeletedLabel === 1 ? 'person' : 'people'
                      } & Delete Label`}
                </Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ disabled: isLabelDeleting }}
                disabled={isLabelDeleting}
                onPress={() => confirmLabelDeletion(true)}
                style={({ pressed }) => [
                  styles.deleteAllButton,
                  pressed && styles.deleteAllButtonPressed,
                  isLabelDeleting && styles.saveButtonDisabled,
                ]}>
                <Text style={styles.deleteAllButtonText}>
                  {isLabelDeleting
                    ? 'Deleting…'
                    : `Delete Label & Move ${peopleInDeletedLabel} ${
                        peopleInDeletedLabel === 1 ? 'Person' : 'People'
                      } to Trash`}
                </Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ disabled: isLabelDeleting }}
                disabled={isLabelDeleting}
                onPress={cancelLabelDeletion}
                style={({ pressed }) => [
                  styles.deleteDialogCancelButton,
                  pressed && styles.cancelButtonPressed,
                  isLabelDeleting && styles.saveButtonDisabled,
                ]}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const createStyles = (theme: AppTheme) => StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: theme.background,
    overflow: 'hidden',
  },
  safeArea: {
    flex: 1,
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
  },
  databaseStateScreen: {
    flex: 1,
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
    paddingHorizontal: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  databaseStateTitle: {
    color: theme.text,
    fontSize: 19,
    fontWeight: '800',
    textAlign: 'center',
    marginTop: 17,
  },
  databaseStateText: {
    maxWidth: 340,
    color: theme.textMuted,
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
    marginTop: 7,
  },
  databaseErrorIcon: {
    width: 54,
    height: 54,
    borderRadius: 17,
    backgroundColor: theme.backgroundElement,
    alignItems: 'center',
    justifyContent: 'center',
  },
  databaseRetryButton: {
    minHeight: 45,
    paddingHorizontal: 20,
    borderRadius: CONTROL_CORNER_RADIUS,
    backgroundColor: theme.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
  },
  databaseRetryButtonPressed: {
    backgroundColor: theme.accentStrong,
    transform: [{ scale: 0.98 }],
  },
  databaseRetryButtonText: {
    color: theme.background,
    fontSize: 14,
    fontWeight: '800',
  },
  glowTop: {
    position: 'absolute',
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: theme.glowTop,
    opacity: 0.18,
    top: -190,
    right: -120,
  },
  glowBottom: {
    position: 'absolute',
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: theme.glowBottom,
    opacity: 0.1,
    bottom: -170,
    left: -150,
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerCondensed: {
    paddingTop: 10,
    paddingBottom: 10,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  brandMark: {
    width: 30,
    height: 30,
    borderRadius: 9,
    backgroundColor: theme.accent,
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ rotate: '-4deg' }],
  },
  brandInitial: {
    color: theme.background,
    fontSize: 18,
    fontWeight: '900',
  },
  brandName: {
    color: theme.text,
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  title: {
    flexShrink: 1,
    color: theme.text,
    fontSize: 20,
    lineHeight: 24,
    fontWeight: '800',
    letterSpacing: -0.45,
  },
  subtitle: {
    color: theme.textMuted,
    fontSize: 15,
    lineHeight: 22,
    marginTop: 5,
  },
  searchRow: {
    marginHorizontal: 24,
    marginBottom: 24,
    flexDirection: 'row',
    gap: 10,
  },
  searchRowCondensed: {
    marginBottom: 14,
  },
  searchBox: {
    flex: 1,
    height: 48,
    borderRadius: CONTROL_CORNER_RADIUS,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.backgroundRaised,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 17,
  },
  settingsButton: {
    width: 48,
    height: 48,
    borderRadius: CONTROL_CORNER_RADIUS,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.backgroundRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingsButtonPressed: {
    backgroundColor: theme.surfacePressed,
    transform: [{ scale: 0.97 }],
  },
  searchIcon: {
    width: 20,
    height: 20,
    marginRight: 11,
  },
  searchLens: {
    width: 13,
    height: 13,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: theme.textMuted,
  },
  searchHandle: {
    position: 'absolute',
    width: 7,
    height: 2,
    borderRadius: 1,
    backgroundColor: theme.textMuted,
    transform: [{ rotate: '45deg' }],
    right: 1,
    bottom: 3,
  },
  searchInput: {
    flex: 1,
    height: '100%',
    color: theme.text,
    fontSize: 16,
    paddingVertical: 0,
  },
  listContent: {
    paddingHorizontal: 24,
    paddingBottom: 118,
  },
  listContentCondensed: {
    paddingBottom: 102,
  },
  listHeadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 11,
    paddingHorizontal: 2,
  },
  listHeadingRowCondensed: {
    marginBottom: 7,
  },
  listHeadingLabelGroup: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  collapseAllButton: {
    width: 25,
    height: 25,
    marginRight: 10,
    borderRadius: 8,
    backgroundColor: theme.accentMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  collapseAllButtonPressed: {
    backgroundColor: theme.backgroundSelected,
    opacity: 0.72,
  },
  listHeading: {
    color: theme.textFaint,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  peopleCount: {
    color: theme.textFaint,
    fontSize: 12,
    fontWeight: '600',
  },
  section: {
    borderRadius: CONTROL_CORNER_RADIUS,
    borderWidth: 1,
    borderColor: theme.accent,
    backgroundColor: theme.surface,
    marginBottom: 13,
    overflow: 'hidden',
  },
  sectionCondensed: {
    marginBottom: 8,
  },
  sectionHeader: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
  },
  sectionHeaderCondensed: {
    minHeight: 41,
  },
  sectionToggle: {
    flex: 1,
    minHeight: 48,
    paddingLeft: 15,
    flexDirection: 'row',
    alignItems: 'center',
  },
  sectionToggleCondensed: {
    minHeight: 41,
  },
  sectionToggleWithoutEdit: {
    paddingRight: 15,
  },
  chevronBox: {
    width: 25,
    height: 25,
    borderRadius: 8,
    backgroundColor: theme.accentMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  sectionTitle: {
    flex: 1,
    color: theme.backgroundRaised,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.25,
  },
  sectionTitleCondensed: {
    fontWeight: '400',
    letterSpacing: 0,
  },
  countPill: {
    minWidth: 22,
    paddingLeft: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countText: {
    fontSize: 15,
    fontWeight: '800',
  },
  countTextCondensed: {
    fontWeight: '400',
  },
  labelEditButton: {
    width: 18,
    height: 18,
    marginLeft: 11,
    marginRight: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editButtonPressed: {
    opacity: 0.55,
  },
  peopleList: {
    paddingHorizontal: 15,
    paddingBottom: 4,
    backgroundColor: theme.surface,
  },
  peopleListCondensed: {
    paddingBottom: 2,
  },
  personRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
  },
  personRowCondensed: {
    paddingVertical: 2,
  },
  personDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.border,
  },
  personCopy: {
    flex: 1,
    minWidth: 0,
  },
  personEditButton: {
    width: 18,
    height: 18,
    marginLeft: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  personLine: {
    color: theme.textMuted,
    fontSize: 13,
    lineHeight: 20,
  },
  personName: {
    color: theme.text,
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: -0.15,
  },
  personNameCondensed: {
    fontSize: 13,
    fontWeight: '400',
    letterSpacing: 0,
  },
  personDescription: {
    color: theme.textDescription,
    fontSize: 13,
    lineHeight: 18,
  },
  personDate: {
    color: theme.textFaint,
    fontSize: 12,
    lineHeight: 18,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 54,
    paddingHorizontal: 24,
  },
  emptyTitle: {
    color: theme.text,
    fontSize: 17,
    fontWeight: '700',
  },
  emptyText: {
    color: theme.textMuted,
    fontSize: 14,
    marginTop: 6,
  },
  addButton: {
    position: 'absolute',
    right: 24,
    bottom: 24,
    width: 60,
    height: 60,
    borderRadius: CONTROL_CORNER_RADIUS,
    backgroundColor: theme.accent,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: theme.buttonBorder,
    shadowColor: theme.shadow,
    shadowOffset: { width: 0, height: 9 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 8,
  },
  addButtonPressed: {
    backgroundColor: theme.accentStrong,
    transform: [{ scale: 0.96 }],
  },
  addButtonText: {
    color: theme.background,
    fontSize: 31,
    lineHeight: 34,
    fontWeight: '500',
    marginTop: -2,
  },
  addButtonTextOpen: {
    transform: [{ rotate: '45deg' }],
  },
  addMenu: {
    position: 'absolute',
    right: 24,
    bottom: 96,
    gap: 9,
    alignItems: 'flex-end',
  },
  addMenuButton: {
    minWidth: 154,
    height: 49,
    paddingHorizontal: 17,
    borderRadius: CONTROL_CORNER_RADIUS,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.backgroundRaised,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    shadowColor: theme.shadow,
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 5,
  },
  addMenuButtonPressed: {
    backgroundColor: theme.surfacePressed,
    transform: [{ scale: 0.98 }],
  },
  addMenuButtonText: {
    color: theme.text,
    fontSize: 15,
    fontWeight: '700',
  },
  modalKeyboardView: {
    flex: 1,
  },
  modalBackdrop: {
    flex: 1,
    paddingHorizontal: 20,
    paddingVertical: 32,
    backgroundColor: 'rgba(3, 18, 11, 0.58)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCard: {
    width: '100%',
    maxWidth: 520,
    maxHeight: '92%',
    padding: 22,
    borderRadius: CONTROL_CORNER_RADIUS,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.backgroundRaised,
    shadowColor: theme.shadow,
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.32,
    shadowRadius: 28,
    elevation: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 22,
  },
  modalHeaderCopy: {
    flex: 1,
    minWidth: 0,
    paddingRight: 16,
  },
  modalEyebrow: {
    color: theme.accent,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.35,
    marginBottom: 4,
  },
  deleteModalEyebrow: {
    color: theme.danger,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.35,
    marginBottom: 4,
  },
  deleteModalDescription: {
    color: theme.textSecondary,
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 20,
  },
  modalTitle: {
    color: theme.text,
    fontSize: 20,
    lineHeight: 24,
    fontWeight: '800',
    letterSpacing: -0.45,
  },
  modalCloseButton: {
    width: 34,
    height: 34,
    borderRadius: CONTROL_CORNER_RADIUS,
    backgroundColor: theme.backgroundElement,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCloseButtonPressed: {
    backgroundColor: theme.backgroundSelected,
  },
  fieldGroup: {
    marginBottom: 17,
  },
  fieldLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 7,
  },
  fieldLabel: {
    color: theme.text,
    fontSize: 13,
    fontWeight: '700',
  },
  fieldLabelStandalone: {
    marginBottom: 7,
  },
  characterCount: {
    color: theme.textFaint,
    fontSize: 11,
    fontWeight: '600',
  },
  fieldInput: {
    minHeight: 49,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: CONTROL_CORNER_RADIUS,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.background,
    color: theme.text,
    fontSize: 15,
  },
  colorFieldLabel: {
    marginTop: 17,
    marginBottom: 9,
  },
  colorOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 9,
  },
  colorOption: {
    width: 46,
    height: 46,
    borderRadius: CONTROL_CORNER_RADIUS,
    borderWidth: 2,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  colorOptionSelected: {
    borderColor: theme.text,
  },
  colorOptionPressed: {
    backgroundColor: theme.backgroundElement,
    transform: [{ scale: 0.96 }],
  },
  colorSwatch: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  descriptionInput: {
    minHeight: 64,
    maxHeight: 64,
    lineHeight: 20,
  },
  labelSelect: {
    minHeight: 49,
    paddingHorizontal: 14,
    borderRadius: CONTROL_CORNER_RADIUS,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.background,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  labelSelectPressed: {
    backgroundColor: theme.surfacePressed,
  },
  labelSelectText: {
    color: theme.text,
    fontSize: 15,
    fontWeight: '600',
  },
  labelOptions: {
    marginTop: 7,
    maxHeight: 190,
    borderRadius: CONTROL_CORNER_RADIUS,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.surface,
    overflow: 'hidden',
  },
  labelOption: {
    minHeight: 42,
    paddingHorizontal: 13,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.borderSoft,
  },
  labelOptionSelected: {
    backgroundColor: theme.accentMuted,
  },
  labelOptionPressed: {
    backgroundColor: theme.surfacePressed,
  },
  labelOptionText: {
    color: theme.text,
    fontSize: 14,
    fontWeight: '600',
  },
  modalActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 5,
  },
  editorModalActions: {
    flexWrap: 'nowrap',
  },
  editorSaveButton: {
    minWidth: 72,
    paddingHorizontal: 16,
  },
  deleteButton: {
    minHeight: 46,
    paddingHorizontal: 13,
    borderRadius: CONTROL_CORNER_RADIUS,
    borderWidth: 1,
    borderColor: theme.danger,
    backgroundColor: theme.danger,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    marginRight: 'auto',
  },
  deleteButtonPressed: {
    opacity: 0.82,
    transform: [{ scale: 0.98 }],
  },
  deleteButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  deleteDecisionActions: {
    gap: 10,
    marginTop: 5,
  },
  moveAndDeleteButton: {
    minHeight: 48,
    paddingHorizontal: 16,
    borderRadius: CONTROL_CORNER_RADIUS,
    borderWidth: 1,
    borderColor: theme.accent,
    backgroundColor: theme.backgroundElement,
    alignItems: 'center',
    justifyContent: 'center',
  },
  moveAndDeleteButtonPressed: {
    backgroundColor: theme.backgroundSelected,
    transform: [{ scale: 0.98 }],
  },
  moveAndDeleteButtonText: {
    color: theme.accent,
    fontSize: 14,
    fontWeight: '800',
  },
  deleteAllButton: {
    minHeight: 48,
    paddingHorizontal: 16,
    borderRadius: CONTROL_CORNER_RADIUS,
    borderWidth: 1,
    borderColor: theme.danger,
    backgroundColor: theme.danger,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteAllButtonPressed: {
    opacity: 0.82,
    transform: [{ scale: 0.98 }],
  },
  deleteAllButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  deleteDialogCancelButton: {
    minHeight: 46,
    paddingHorizontal: 18,
    borderRadius: CONTROL_CORNER_RADIUS,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    minHeight: 46,
    paddingHorizontal: 18,
    borderRadius: CONTROL_CORNER_RADIUS,
    borderWidth: 1,
    borderColor: theme.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButtonPressed: {
    backgroundColor: theme.surfacePressed,
  },
  cancelButtonText: {
    color: theme.textSecondary,
    fontSize: 14,
    fontWeight: '700',
  },
  saveButton: {
    minHeight: 46,
    minWidth: 112,
    paddingHorizontal: 18,
    borderRadius: CONTROL_CORNER_RADIUS,
    backgroundColor: theme.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonPressed: {
    backgroundColor: theme.accentStrong,
    transform: [{ scale: 0.98 }],
  },
  saveButtonDisabled: {
    opacity: 0.45,
  },
  saveButtonText: {
    color: theme.background,
    fontSize: 14,
    fontWeight: '800',
  },
});
