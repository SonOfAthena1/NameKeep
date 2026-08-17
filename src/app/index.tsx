import { StatusBar } from 'expo-status-bar';
import { SymbolView } from 'expo-symbols';
import { useMemo, useState } from 'react';
import {
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
import type { AppTheme } from '@/constants/theme';
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

const NAME_MAX_LENGTH = 40;
const DESCRIPTION_MAX_LENGTH = 180;
const LABEL_MAX_LENGTH = 40;
const CONTROL_CORNER_RADIUS = 14;

type Editor = {
  kind: 'person' | 'label';
  id: string | null;
} | null;

export default function HomeScreen() {
  const [search, setSearch] = useState('');
  const [labels, setLabels] = useState<Label[]>(SAMPLE_LABELS);
  const [people, setPeople] = useState<Person[]>(SAMPLE_PEOPLE);
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
  const theme = useTheme();
  const { colorScheme } = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const sections = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();

    const labeledSections = [...labels]
      .sort((a, b) => b.createdAt - a.createdAt)
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
          .sort((a, b) => b.createdAt - a.createdAt);

        return { label, people: sectionPeople };
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
      .sort((a, b) => b.createdAt - a.createdAt);

    if (unlabeledPeople.length > 0) {
      labeledSections.push({
        label: {
          id: 'no-label',
          name: 'No Label',
          color: 'green',
          createdAt: Number.MIN_SAFE_INTEGER,
        },
        people: unlabeledPeople,
      });
    }

    return labeledSections;
  }, [labels, people, search]);

  const selectedLabelName =
    labels.find((label) => label.id === personLabelId)?.name ?? 'No Label';

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

  function openCreateModal(kind: 'person' | 'label') {
    setIsAddMenuOpen(false);
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
    setLabelColor('green');
  }

  function savePerson() {
    const updates = {
      name: personName.trim(),
      description: personDescription.trim(),
      labelId: personLabelId,
    };

    if (editor?.kind === 'person' && editor.id) {
      setPeople((current) =>
        current.map((person) =>
          person.id === editor.id ? { ...person, ...updates } : person,
        ),
      );
    } else {
      setPeople((current) => [
        ...current,
        {
          id: `person-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          ...updates,
          createdAt: Date.now(),
        },
      ]);
    }
    closeEditor();
  }

  function saveLabel() {
    const trimmedName = labelName.trim();
    if (!trimmedName) {
      return;
    }

    if (editor?.kind === 'label' && editor.id) {
      setLabels((current) =>
        current.map((label) =>
          label.id === editor.id
            ? { ...label, name: trimmedName, color: labelColor }
            : label,
        ),
      );
    } else {
      setLabels((current) => [
        ...current,
        {
          id: `label-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          name: trimmedName,
          color: labelColor,
          createdAt: Date.now(),
        },
      ]);
    }
    closeEditor();
  }

  function deleteEditedItem() {
    if (!editor?.id) {
      return;
    }

    const { id, kind } = editor;
    const itemName = kind === 'person'
      ? people.find((person) => person.id === id)?.name || 'this person'
      : labels.find((label) => label.id === id)?.name || 'this label';
    const message = kind === 'label'
      ? `Delete “${itemName}”? People using this label will move to No Label.`
      : `Delete “${itemName}”? This cannot be undone.`;

    const performDelete = () => {
      if (kind === 'person') {
        setPeople((current) =>
          current.filter((person) => person.id !== id),
        );
      } else {
        setPeople((current) =>
          current.map((person) =>
            person.labelId === id ? { ...person, labelId: null } : person,
          ),
        );
        setLabels((current) =>
          current.filter((label) => label.id !== id),
        );
        setCollapsedLabelIds((current) => {
          const next = new Set(current);
          next.delete(id);
          return next;
        });
      }
      closeEditor();
    };

    if (Platform.OS === 'web') {
      if (globalThis.confirm(message)) {
        performDelete();
      }
      return;
    }

    Alert.alert(
      `Delete ${kind}?`,
      message,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: performDelete,
        },
      ],
    );
  }

  return (
    <View style={styles.screen}>
      <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
      <View pointerEvents="none" style={styles.glowTop} />
      <View pointerEvents="none" style={styles.glowBottom} />

      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <Text style={styles.title}>People you’ve met</Text>

          <View style={styles.brandRow}>
            <View style={styles.brandMark}>
              <Text style={styles.brandInitial}>N</Text>
            </View>
            <Text style={styles.brandName}>NameKeep</Text>
          </View>
        </View>

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

        <ScrollView
          contentContainerStyle={styles.listContent}
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          <View style={styles.listHeadingRow}>
            <Text style={styles.listHeading}>YOUR LABELS</Text>
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
                style={[styles.section, { borderColor: labelTheme.base }]}>
                <View
                  style={[styles.sectionHeader, { backgroundColor: labelTheme.base }]}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ expanded: !isCollapsed }}
                    onPress={() => toggleLabel(label.id)}
                    style={({ pressed }) => [
                      styles.sectionToggle,
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
                    <Text style={[styles.sectionTitle, { color: labelTheme.foreground }]}>
                      {label.name}
                    </Text>
                    <View
                      style={[styles.countPill, { backgroundColor: labelTheme.foreground }]}>
                      <Text style={[styles.countText, { color: labelTheme.base }]}>
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
                  <View style={styles.peopleList}>
                    {people.map((person, index) => (
                      <View
                        key={person.id}
                        style={[styles.personRow, index > 0 && styles.personDivider]}>
                        <View style={styles.personCopy}>
                          <Text style={styles.personLine}>
                            <Text style={styles.personName}>
                              {person.name || 'Unnamed person'}
                            </Text>
                            {!!person.description && (
                              <Text style={styles.personDescription}>
                                {' '}— {person.description}
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

          {sections.length === 0 && (
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

              <View style={styles.modalActions}>
                {!!editor?.id && (
                  <Pressable
                    accessibilityRole="button"
                    onPress={deleteEditedItem}
                    style={({ pressed }) => [
                      styles.deleteButton,
                      pressed && styles.deleteButtonPressed,
                    ]}>
                    <SymbolView
                      name={{ ios: 'trash', android: 'delete', web: 'delete' }}
                      size={17}
                      tintColor={theme.danger}
                    />
                    <Text style={styles.deleteButtonText}>Delete</Text>
                  </Pressable>
                )}
                <Pressable
                  accessibilityRole="button"
                  onPress={closeEditor}
                  style={({ pressed }) => [
                    styles.cancelButton,
                    pressed && styles.cancelButtonPressed,
                  ]}>
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  disabled={editor?.kind === 'label' && !labelName.trim()}
                  onPress={editor?.kind === 'person' ? savePerson : saveLabel}
                  style={({ pressed }) => [
                    styles.saveButton,
                    editor?.kind === 'label' && !labelName.trim() && styles.saveButtonDisabled,
                    pressed && styles.saveButtonPressed,
                  ]}>
                  <Text style={styles.saveButtonText}>
                    {editor?.id
                      ? 'Save Changes'
                      : editor?.kind === 'person' ? 'Add Person' : 'Add Label'}
                  </Text>
                </Pressable>
              </View>
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
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
  searchBox: {
    height: 54,
    marginHorizontal: 24,
    borderRadius: CONTROL_CORNER_RADIUS,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.backgroundRaised,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 17,
    marginBottom: 24,
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
  listHeadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 11,
    paddingHorizontal: 2,
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
  sectionHeader: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
  },
  sectionToggle: {
    flex: 1,
    minHeight: 48,
    paddingLeft: 15,
    flexDirection: 'row',
    alignItems: 'center',
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
  countPill: {
    minWidth: 27,
    height: 25,
    borderRadius: 13,
    paddingHorizontal: 8,
    backgroundColor: theme.backgroundRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countText: {
    color: theme.accentStrong,
    fontSize: 12,
    fontWeight: '800',
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
  personRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
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
    marginLeft: 12,
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
  personDescription: {
    color: theme.textDescription,
    fontSize: 13,
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
  modalEyebrow: {
    color: theme.accent,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.35,
    marginBottom: 4,
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
  deleteButton: {
    minHeight: 46,
    paddingHorizontal: 13,
    borderRadius: CONTROL_CORNER_RADIUS,
    borderWidth: 1,
    borderColor: theme.danger,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    marginRight: 'auto',
  },
  deleteButtonPressed: {
    backgroundColor: theme.surfacePressed,
    opacity: 0.75,
  },
  deleteButtonText: {
    color: theme.danger,
    fontSize: 14,
    fontWeight: '700',
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
