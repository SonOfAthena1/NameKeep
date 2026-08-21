import { SymbolView } from 'expo-symbols';
import { StatusBar } from 'expo-status-bar';
import * as Linking from 'expo-linking';
import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import { Fragment, useMemo, useState } from 'react';
import {
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  LABEL_COLOR_OPTIONS,
  LabelColors,
  type LabelColor,
} from '@/constants/label-colors';
import type { AppTheme } from '@/constants/theme';
import {
  type Label,
  type MemoryReminderInterval,
  type Person,
  type SortOrder,
} from '@/database/types';
import { useAppTheme, useTheme, type ThemePreference } from '@/hooks/use-theme';
import { exportPeopleCsv } from '@/lib/export-people';
import {
  CsvImportError,
  MAX_CSV_FILE_SIZE,
  createPeopleImportPlan,
  parsePeopleCsv,
} from '@/lib/import-people';
import { createPeopleCsv } from '@/lib/people-csv';

export type { SortOrder } from '@/database/types';
export type TrashedPerson = Person & { deletedAt: number };

type Picker =
  | 'theme'
  | 'color'
  | 'defaultLabel'
  | 'labelsSort'
  | 'peopleSort'
  | 'memoryReminders'
  | null;

type SettingsScreenProps = {
  labels: Label[];
  people: Person[];
  themePreference: ThemePreference;
  setThemePreference: (preference: ThemePreference) => void;
  defaultLabelColor: LabelColor;
  setDefaultLabelColor: (color: LabelColor) => void;
  defaultLabelId: string | null;
  setDefaultLabelId: (labelId: string | null) => void;
  labelSortOrder: SortOrder;
  setLabelSortOrder: (order: SortOrder) => void;
  peopleSortOrder: SortOrder;
  setPeopleSortOrder: (order: SortOrder) => void;
  showDate: boolean;
  setShowDate: (showDate: boolean) => void;
  condensedView: boolean;
  setCondensedView: (condensedView: boolean) => void;
  memoryReminderIntervals: MemoryReminderInterval[];
  setMemoryReminderInterval: (
    interval: MemoryReminderInterval,
    enabled: boolean,
  ) => void;
  trash: TrashedPerson[];
  onRestore: (personId: string) => void;
  onDeleteForever: (personId: string) => void;
  onEmptyTrash: () => void;
  onImportPeople: (people: Person[], labels: Label[]) => Promise<void>;
  onBack: () => void;
};

const SORT_OPTIONS: { value: SortOrder; label: string }[] = [
  { value: 'newest', label: 'Date (Newest first)' },
  { value: 'oldest', label: 'Date (Oldest first)' },
  { value: 'alphabetical', label: 'Alphabetical' },
];

const THEME_OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

const SUPPORT_URL = 'https://namekeep.lwcuellar.org/support';

const MEMORY_REMINDER_OPTIONS: { value: MemoryReminderInterval; label: string }[] = [
  { value: 1, label: '1 day later' },
  { value: 3, label: '3 days later' },
  { value: 7, label: '1 week later' },
  { value: 14, label: '2 weeks later' },
];

export function SettingsScreen({
  labels,
  people,
  themePreference,
  setThemePreference,
  defaultLabelColor,
  setDefaultLabelColor,
  defaultLabelId,
  setDefaultLabelId,
  labelSortOrder,
  setLabelSortOrder,
  peopleSortOrder,
  setPeopleSortOrder,
  showDate,
  setShowDate,
  condensedView,
  setCondensedView,
  memoryReminderIntervals,
  setMemoryReminderInterval,
  trash,
  onRestore,
  onDeleteForever,
  onEmptyTrash,
  onImportPeople,
  onBack,
}: SettingsScreenProps) {
  const theme = useTheme();
  const { colorScheme } = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [picker, setPicker] = useState<Picker>(null);
  const [showTrash, setShowTrash] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isImportGuideOpen, setIsImportGuideOpen] = useState(false);

  const defaultLabelName =
    labels.find((label) => label.id === defaultLabelId)?.name ?? 'None';
  const defaultColorName =
    LABEL_COLOR_OPTIONS.find((color) => color.id === defaultLabelColor)?.name ??
    'Green';
  const themeName =
    THEME_OPTIONS.find((option) => option.value === themePreference)?.label ??
    'System';
  const labelsSortName =
    SORT_OPTIONS.find((option) => option.value === labelSortOrder)?.label ?? '';
  const peopleSortName =
    SORT_OPTIONS.find((option) => option.value === peopleSortOrder)?.label ?? '';
  const memoryReminderName = memoryReminderIntervals.length
    ? `${memoryReminderIntervals.length} selected`
    : 'Off';

  function togglePicker(nextPicker: Exclude<Picker, null>) {
    setPicker((current) => (current === nextPicker ? null : nextPicker));
  }

  function openSupport() {
    void Linking.openURL(SUPPORT_URL).catch((error) => {
      console.error('Could not open support page', error);
      showMessage('Could not open Help', 'Please try again in a moment.');
    });
  }

  function confirmDeleteForever(person: TrashedPerson) {
    const performDelete = () => onDeleteForever(person.id);
    const message = `Permanently delete “${person.name || 'this person'}”? This cannot be undone.`;

    if (Platform.OS === 'web') {
      if (globalThis.confirm(message)) performDelete();
      return;
    }

    Alert.alert('Delete forever?', message, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete Forever', style: 'destructive', onPress: performDelete },
    ]);
  }

  function confirmEmptyTrash() {
    const message = `Permanently delete all ${trash.length} ${trash.length === 1 ? 'person' : 'people'} in Trash? This cannot be undone.`;

    if (Platform.OS === 'web') {
      if (globalThis.confirm(message)) onEmptyTrash();
      return;
    }

    Alert.alert('Empty Trash?', message, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Empty Trash', style: 'destructive', onPress: onEmptyTrash },
    ]);
  }

  async function exportPeople() {
    if (people.length === 0 || isExporting) {
      if (people.length === 0) {
        Alert.alert('Nothing to export', 'Add at least one person before exporting.');
      }
      return;
    }

    setIsExporting(true);
    try {
      await exportPeopleCsv(createPeopleCsv(people, labels));
    } catch (error) {
      console.error('Could not export people', error);
      Alert.alert(
        'Export failed',
        'NameKeep could not create the CSV file. Please try again.',
      );
    } finally {
      setIsExporting(false);
    }
  }

  function showMessage(title: string, message: string) {
    if (Platform.OS === 'web') {
      globalThis.alert(`${title}\n\n${message}`);
      return;
    }
    Alert.alert(title, message);
  }

  async function importPeople() {
    if (isImporting) return;

    setIsImporting(true);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          'text/csv',
          'text/comma-separated-values',
          'application/csv',
          'application/vnd.ms-excel',
          'text/plain',
        ],
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (result.canceled) return;

      const asset = result.assets[0];
      if (!asset.name.toLocaleLowerCase().endsWith('.csv')) {
        throw new CsvImportError('Please choose a file ending in .csv.');
      }
      if (asset.size !== undefined && asset.size > MAX_CSV_FILE_SIZE) {
        throw new CsvImportError('The CSV file is larger than 2 MB.');
      }

      const contents =
        Platform.OS === 'web' && asset.file
          ? await asset.file.text()
          : await new File(asset.uri).text();
      if (contents.length > MAX_CSV_FILE_SIZE) {
        throw new CsvImportError('The CSV file is larger than 2 MB.');
      }

      const plan = createPeopleImportPlan(
        parsePeopleCsv(contents),
        people,
        labels,
        defaultLabelColor,
      );
      if (plan.people.length === 0) {
        const details = [
          plan.duplicateCount
            ? `${plan.duplicateCount} exact ${plan.duplicateCount === 1 ? 'duplicate was' : 'duplicates were'} skipped.`
            : '',
          plan.invalidRows.length
            ? `${plan.invalidRows.length} invalid ${plan.invalidRows.length === 1 ? 'row was' : 'rows were'} skipped.`
            : '',
        ].filter(Boolean).join('\n');
        showMessage('Nothing to import', details || 'No people were found in the CSV.');
        return;
      }

      const summary = [
        `Add ${plan.people.length} ${plan.people.length === 1 ? 'person' : 'people'} to NameKeep?`,
        `${plan.labels.length} new ${plan.labels.length === 1 ? 'label' : 'labels'}`,
        plan.duplicateCount
          ? `${plan.duplicateCount} exact ${plan.duplicateCount === 1 ? 'duplicate' : 'duplicates'} will be skipped`
          : '',
        plan.invalidRows.length
          ? `${plan.invalidRows.length} invalid ${plan.invalidRows.length === 1 ? 'row' : 'rows'} will be skipped (lines ${plan.invalidRows.slice(0, 5).join(', ')}${plan.invalidRows.length > 5 ? ', …' : ''})`
          : '',
      ].filter(Boolean).join('\n\n');

      const performImport = async () => {
        try {
          await onImportPeople(plan.people, plan.labels);
          showMessage(
            'Import complete',
            `${plan.people.length} ${plan.people.length === 1 ? 'person was' : 'people were'} added.`,
          );
        } catch (error) {
          console.error('Could not save imported people', error);
          showMessage(
            'Import failed',
            'NameKeep could not save the imported people. Your existing data has not been changed.',
          );
        }
      };

      if (Platform.OS === 'web') {
        if (globalThis.confirm(summary)) await performImport();
      } else {
        Alert.alert('Review import', summary, [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Import', onPress: () => void performImport() },
        ]);
      }
    } catch (error) {
      console.error('Could not import people', error);
      showMessage(
        error instanceof CsvImportError ? 'Cannot import CSV' : 'Import failed',
        error instanceof CsvImportError
          ? error.message
          : 'NameKeep could not read the CSV file. Please try again.',
      );
    } finally {
      setIsImporting(false);
    }
  }

  function chooseImportFile() {
    setIsImportGuideOpen(false);
    if (Platform.OS === 'web') {
      void importPeople();
      return;
    }

    // Let the guide finish dismissing before presenting the native file picker.
    setTimeout(() => void importPeople(), 200);
  }

  if (showTrash) {
    return (
      <ScreenFrame styles={styles}>
        <SettingsHeader title="Trash" onBack={() => setShowTrash(false)} styles={styles} theme={theme} />
        <ScrollView contentContainerStyle={styles.trashContent} showsVerticalScrollIndicator={false}>
          {trash.length === 0 ? (
            <View style={styles.emptyTrash}>
              <View style={styles.emptyTrashIcon}>
                <SymbolView name={{ ios: 'trash', android: 'delete', web: 'delete' }} size={25} tintColor={theme.accent} />
              </View>
              <Text style={styles.emptyTrashTitle}>Trash is empty</Text>
              <Text style={styles.emptyTrashText}>Deleted people will appear here so you can restore them.</Text>
            </View>
          ) : (
            <>
              <View style={styles.trashIntroRow}>
                <Text style={styles.trashHelper}>Deleted people stay here until you restore or permanently delete them.</Text>
                <Pressable accessibilityRole="button" onPress={confirmEmptyTrash} style={({ pressed }) => [styles.emptyTrashButton, pressed && styles.pressed]}>
                  <Text style={styles.emptyTrashButtonText}>Empty Trash</Text>
                </Pressable>
              </View>
              <View style={styles.groupCard}>
                {trash.map((person, index) => (
                  <Fragment key={person.id}>
                    {index > 0 && <View style={styles.rowDivider} />}
                    <View style={styles.trashRow}>
                      <View style={styles.trashCopy}>
                        <Text style={styles.rowTitle}>{person.name || 'Unnamed person'}</Text>
                        {!!person.description && <Text numberOfLines={2} style={styles.rowSubtitle}>{person.description}</Text>}
                      </View>
                      <Pressable accessibilityRole="button" onPress={() => onRestore(person.id)} style={({ pressed }) => [styles.restoreButton, pressed && styles.pressed]}>
                        <Text style={styles.restoreButtonText}>Restore</Text>
                      </Pressable>
                      <Pressable accessibilityLabel={`Delete ${person.name || 'person'} forever`} accessibilityRole="button" hitSlop={8} onPress={() => confirmDeleteForever(person)} style={({ pressed }) => [styles.foreverButton, pressed && styles.pressed]}>
                        <SymbolView name={{ ios: 'trash', android: 'delete_forever', web: 'delete_forever' }} size={18} tintColor={theme.danger} />
                      </Pressable>
                    </View>
                  </Fragment>
                ))}
              </View>
            </>
          )}
        </ScrollView>
      </ScreenFrame>
    );
  }

  return (
    <ScreenFrame styles={styles}>
      <SettingsHeader title="Settings" onBack={onBack} styles={styles} theme={theme} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Section title="APPEARANCE" styles={styles}>
          <SettingRow title="App theme" value={themeName} onPress={() => togglePicker('theme')} expanded={picker === 'theme'} styles={styles} theme={theme} />
          {picker === 'theme' && (
            <ChoiceList options={THEME_OPTIONS} selected={themePreference} onSelect={(value) => { setThemePreference(value); setPicker(null); }} styles={styles} theme={theme} />
          )}
          <View style={styles.rowDivider} />
          <SettingRow title="Default label color" value={defaultColorName} onPress={() => togglePicker('color')} expanded={picker === 'color'} styles={styles} theme={theme} leading={<View style={[styles.colorDot, { backgroundColor: LabelColors[colorScheme][defaultLabelColor].base }]} />} />
          {picker === 'color' && (
            <View style={styles.colorGrid}>
              {LABEL_COLOR_OPTIONS.map((option) => {
                const colors = LabelColors[colorScheme][option.id];
                const selected = option.id === defaultLabelColor;
                return (
                  <Pressable key={option.id} accessibilityLabel={option.name} accessibilityRole="radio" accessibilityState={{ checked: selected }} onPress={() => { setDefaultLabelColor(option.id); setPicker(null); }} style={({ pressed }) => [styles.colorChoice, selected && styles.colorChoiceSelected, pressed && styles.pressed]}>
                    <View style={[styles.colorSwatch, { backgroundColor: colors.base }]}>
                      {selected && <SymbolView name={{ ios: 'checkmark', android: 'check', web: 'check' }} size={17} tintColor={colors.foreground} />}
                    </View>
                  </Pressable>
                );
              })}
            </View>
          )}
        </Section>

        <Section title="DEFAULTS" styles={styles}>
          <SettingRow title="Default label" subtitle="Assigned when you add a new person" value={defaultLabelName} onPress={() => togglePicker('defaultLabel')} expanded={picker === 'defaultLabel'} styles={styles} theme={theme} />
          {picker === 'defaultLabel' && (
            <ChoiceList options={[{ value: null, label: 'None' }, ...labels.map((label) => ({ value: label.id, label: label.name }))]} selected={defaultLabelId} onSelect={(value) => { setDefaultLabelId(value); setPicker(null); }} styles={styles} theme={theme} />
          )}
        </Section>

        <Section title="SORTING" styles={styles}>
          <SettingRow title="Order labels" value={labelsSortName} onPress={() => togglePicker('labelsSort')} expanded={picker === 'labelsSort'} styles={styles} theme={theme} />
          {picker === 'labelsSort' && <ChoiceList options={SORT_OPTIONS} selected={labelSortOrder} onSelect={(value) => { setLabelSortOrder(value); setPicker(null); }} styles={styles} theme={theme} />}
          <View style={styles.rowDivider} />
          <SettingRow title="Order people" value={peopleSortName} onPress={() => togglePicker('peopleSort')} expanded={picker === 'peopleSort'} styles={styles} theme={theme} />
          {picker === 'peopleSort' && <ChoiceList options={SORT_OPTIONS} selected={peopleSortOrder} onSelect={(value) => { setPeopleSortOrder(value); setPicker(null); }} styles={styles} theme={theme} />}
        </Section>

        <Section title="DISPLAY" styles={styles}>
          <View style={styles.settingRow}>
            <View style={styles.rowCopy}>
              <Text style={styles.rowTitle}>Show date</Text>
              <Text style={styles.rowSubtitle}>Show the date after each person’s description</Text>
            </View>
            <Switch accessibilityLabel="Show date" value={showDate} onValueChange={setShowDate} trackColor={{ false: theme.border, true: theme.accent }} thumbColor={theme.backgroundRaised} />
          </View>
          <View style={styles.rowDivider} />
          <View style={styles.settingRow}>
            <View style={styles.rowCopy}>
              <Text style={styles.rowTitle}>Condensed view</Text>
              <Text style={styles.rowSubtitle}>Fit more people on screen with tighter spacing</Text>
            </View>
            <Switch accessibilityLabel="Condensed view" value={condensedView} onValueChange={setCondensedView} trackColor={{ false: theme.border, true: theme.accent }} thumbColor={theme.backgroundRaised} />
          </View>
        </Section>

        <Section title="MEMORY REMINDERS" styles={styles}>
          <SettingRow
            title="Memory reminders"
            subtitle="Choose reminders for people you add from now on"
            value={memoryReminderName}
            onPress={() => togglePicker('memoryReminders')}
            expanded={picker === 'memoryReminders'}
            styles={styles}
            theme={theme}
          />
          {picker === 'memoryReminders' && (
            <View style={styles.multiChoiceList}>
              <Text style={styles.multiChoiceHelper}>
                Selecting any option opts you in to notifications.
              </Text>
              {MEMORY_REMINDER_OPTIONS.map((option) => {
                const selected = memoryReminderIntervals.includes(option.value);
                return (
                  <Pressable
                    key={option.value}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: selected }}
                    onPress={() =>
                      setMemoryReminderInterval(option.value, !selected)
                    }
                    style={({ pressed }) => [
                      styles.choiceRow,
                      selected && styles.choiceRowSelected,
                      pressed && styles.rowPressed,
                    ]}>
                    <Text style={styles.choiceText}>{option.label}</Text>
                    {selected && (
                      <SymbolView
                        name={{ ios: 'checkmark', android: 'check', web: 'check' }}
                        size={17}
                        tintColor={theme.accent}
                      />
                    )}
                  </Pressable>
                );
              })}
            </View>
          )}
        </Section>

        <Section title="DATA" styles={styles}>
          <SettingRow title="Export people" subtitle="Choose where to save or share a CSV file" value={isExporting ? 'Preparing…' : undefined} disabled={isExporting} onPress={exportPeople} styles={styles} theme={theme} leading={<SymbolView name={{ ios: 'square.and.arrow.up', android: 'upload_file', web: 'upload_file' }} size={20} tintColor={theme.accent} />} />
          <View style={styles.rowDivider} />
          <SettingRow title="Import people" subtitle="Add people and labels from a CSV file" value={isImporting ? 'Reading…' : undefined} disabled={isImporting} onPress={() => setIsImportGuideOpen(true)} styles={styles} theme={theme} leading={<SymbolView name={{ ios: 'square.and.arrow.down', android: 'download', web: 'download' }} size={20} tintColor={theme.accent} />} />
          <View style={styles.rowDivider} />
          <SettingRow title="Trash" subtitle="View, restore, or permanently delete people" value={trash.length ? String(trash.length) : undefined} onPress={() => setShowTrash(true)} styles={styles} theme={theme} leading={<SymbolView name={{ ios: 'trash', android: 'delete', web: 'delete' }} size={20} tintColor={theme.danger} />} />
        </Section>

        <Section title="SUPPORT" styles={styles}>
          <SettingRow title="Help" subtitle="Get support with NameKeep" onPress={openSupport} styles={styles} theme={theme} leading={<SymbolView name={{ ios: 'questionmark.circle', android: 'help_outline', web: 'help_outline' }} size={20} tintColor={theme.accent} />} />
        </Section>
      </ScrollView>

      <Modal
        animationType="fade"
        onRequestClose={() => setIsImportGuideOpen(false)}
        transparent
        visible={isImportGuideOpen}>
        <View style={styles.importGuideBackdrop}>
          <Pressable
            accessibilityLabel="Close import guide"
            accessibilityRole="button"
            onPress={() => setIsImportGuideOpen(false)}
            style={StyleSheet.absoluteFill}
          />
          <View
            style={styles.importGuideCard}>
            <View style={styles.importGuideHeader}>
              <View style={styles.importGuideTitleGroup}>
                <Text style={styles.importGuideEyebrow}>CSV IMPORT</Text>
                <Text style={styles.importGuideTitle}>Prepare your file</Text>
              </View>
              <Pressable
                accessibilityLabel="Close import guide"
                accessibilityRole="button"
                hitSlop={8}
                onPress={() => setIsImportGuideOpen(false)}
                style={({ pressed }) => [
                  styles.importGuideClose,
                  pressed && styles.pressed,
                ]}>
                <SymbolView
                  name={{ ios: 'xmark', android: 'close', web: 'close' }}
                  size={18}
                  tintColor={theme.textSecondary}
                />
              </Pressable>
            </View>

            <ScrollView
              contentContainerStyle={styles.importGuideContent}
              showsVerticalScrollIndicator={false}>
              <Text style={styles.importGuideIntro}>
                Choose a CSV file with one person per row. It should follow this format:
              </Text>

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.csvExample}>
                <Text selectable style={styles.csvExampleText}>
                  {'name,description,label,label_color\nMaya Chen,Frontend developer,Work,green\nJordan Lee,,Friends,blue'}
                </Text>
              </ScrollView>

              <Text style={styles.importRulesTitle}>Rules</Text>
              <View style={styles.importRules}>
                <Text style={styles.importRule}>• The file must end in .csv and be no larger than 2 MB.</Text>
                <Text style={styles.importRule}>• The first row must contain a name column.</Text>
                <Text style={styles.importRule}>• Description, label, and label_color are optional.</Text>
                <Text style={styles.importRule}>• Valid colors: green, blue, violet, pink, red, orange, amber, teal, and gray.</Text>
                <Text style={styles.importRule}>• Put values containing commas inside double quotes.</Text>
                <Text style={styles.importRule}>• Existing labels are reused and exact duplicate people are skipped.</Text>
              </View>
            </ScrollView>

            <View style={styles.importGuideActions}>
              <Pressable
                accessibilityRole="button"
                onPress={() => setIsImportGuideOpen(false)}
                style={({ pressed }) => [
                  styles.importGuideCancel,
                  pressed && styles.rowPressed,
                ]}>
                <Text style={styles.importGuideCancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={chooseImportFile}
                style={({ pressed }) => [
                  styles.importGuideChoose,
                  pressed && styles.pressed,
                ]}>
                <Text style={styles.importGuideChooseText}>Choose CSV file</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </ScreenFrame>
  );
}

function ScreenFrame({ children, styles }: { children: React.ReactNode; styles: ReturnType<typeof createStyles> }) {
  const { colorScheme } = useAppTheme();
  return <View style={styles.screen}><StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} /><View pointerEvents="none" style={styles.glowTop} /><SafeAreaView style={styles.safeArea}>{children}</SafeAreaView></View>;
}

function SettingsHeader({ title, onBack, styles, theme }: { title: string; onBack: () => void; styles: ReturnType<typeof createStyles>; theme: AppTheme }) {
  return <View style={styles.header}><Pressable accessibilityLabel="Go back" accessibilityRole="button" onPress={onBack} style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}><SymbolView name={{ ios: 'chevron.left', android: 'arrow_back', web: 'arrow_back' }} size={22} tintColor={theme.text} /></Pressable><Text style={styles.headerTitle}>{title}</Text><View style={styles.headerSpacer} /></View>;
}

function Section({ title, children, styles }: { title: string; children: React.ReactNode; styles: ReturnType<typeof createStyles> }) {
  return <View style={styles.section}><Text style={styles.sectionTitle}>{title}</Text><View style={styles.groupCard}>{children}</View></View>;
}

function SettingRow({ title, subtitle, value, onPress, expanded, disabled, leading, styles, theme }: { title: string; subtitle?: string; value?: string; onPress: () => void; expanded?: boolean; disabled?: boolean; leading?: React.ReactNode; styles: ReturnType<typeof createStyles>; theme: AppTheme }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled, ...(expanded === undefined ? {} : { expanded }) }} disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.settingRow, disabled && styles.settingRowDisabled, pressed && styles.rowPressed]}>{leading}<View style={styles.rowCopy}><Text style={styles.rowTitle}>{title}</Text>{subtitle && <Text style={styles.rowSubtitle}>{subtitle}</Text>}</View>{value && <Text numberOfLines={1} style={styles.rowValue}>{value}</Text>}<SymbolView name={{ ios: expanded ? 'chevron.up' : 'chevron.right', android: expanded ? 'keyboard_arrow_up' : 'chevron_right', web: expanded ? 'keyboard_arrow_up' : 'chevron_right' }} size={19} tintColor={theme.textFaint} /></Pressable>;
}

function ChoiceList<T extends string | null>({ options, selected, onSelect, styles, theme }: { options: { value: T; label: string }[]; selected: T; onSelect: (value: T) => void; styles: ReturnType<typeof createStyles>; theme: AppTheme }) {
  return <View style={styles.choiceList}>{options.map((option) => <Pressable key={option.value ?? 'none'} accessibilityRole="radio" accessibilityState={{ checked: option.value === selected }} onPress={() => onSelect(option.value)} style={({ pressed }) => [styles.choiceRow, option.value === selected && styles.choiceRowSelected, pressed && styles.rowPressed]}><Text style={styles.choiceText}>{option.label}</Text>{option.value === selected && <SymbolView name={{ ios: 'checkmark', android: 'check', web: 'check' }} size={17} tintColor={theme.accent} />}</Pressable>)}</View>;
}

const createStyles = (theme: AppTheme) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.background, overflow: 'hidden' },
  safeArea: { flex: 1, width: '100%', maxWidth: 720, alignSelf: 'center' },
  glowTop: { position: 'absolute', width: 320, height: 320, borderRadius: 160, backgroundColor: theme.glowTop, opacity: 0.16, top: -195, right: -120 },
  header: { minHeight: 66, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.borderSoft },
  backButton: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.backgroundRaised, borderWidth: 1, borderColor: theme.border },
  pressed: { opacity: 0.65, transform: [{ scale: 0.97 }] },
  headerTitle: { flex: 1, textAlign: 'center', color: theme.text, fontSize: 20, fontWeight: '800', letterSpacing: -0.4 },
  headerSpacer: { width: 42 },
  content: { paddingHorizontal: 24, paddingTop: 22, paddingBottom: 50 },
  section: { marginBottom: 25 },
  sectionTitle: { color: theme.textFaint, fontSize: 11, fontWeight: '800', letterSpacing: 1.4, marginLeft: 4, marginBottom: 9 },
  groupCard: { borderRadius: 14, borderWidth: 1, borderColor: theme.border, backgroundColor: theme.backgroundRaised, overflow: 'hidden' },
  settingRow: { minHeight: 62, paddingHorizontal: 15, paddingVertical: 11, flexDirection: 'row', alignItems: 'center', gap: 11 },
  settingRowDisabled: { opacity: 0.55 },
  rowPressed: { backgroundColor: theme.surfacePressed },
  rowDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.borderSoft, marginLeft: 15 },
  rowCopy: { flex: 1, minWidth: 0 },
  rowTitle: { color: theme.text, fontSize: 15, fontWeight: '700' },
  rowSubtitle: { color: theme.textMuted, fontSize: 12, lineHeight: 17, marginTop: 3 },
  rowValue: { maxWidth: '42%', color: theme.textSecondary, fontSize: 13, fontWeight: '600' },
  colorDot: { width: 16, height: 16, borderRadius: 8 },
  choiceList: { padding: 7, paddingTop: 0 },
  multiChoiceList: { padding: 7, paddingTop: 0 },
  multiChoiceHelper: { color: theme.textMuted, fontSize: 12, lineHeight: 18, paddingHorizontal: 7, paddingTop: 7, paddingBottom: 6 },
  choiceRow: { minHeight: 43, borderRadius: 10, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  choiceRowSelected: { backgroundColor: theme.accentMuted },
  choiceText: { color: theme.text, fontSize: 14, fontWeight: '600' },
  colorGrid: { paddingHorizontal: 11, paddingBottom: 12, flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  colorChoice: { width: 45, height: 45, borderRadius: 13, borderWidth: 2, borderColor: 'transparent', alignItems: 'center', justifyContent: 'center' },
  colorChoiceSelected: { borderColor: theme.text },
  colorSwatch: { width: 33, height: 33, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  importGuideBackdrop: { flex: 1, paddingHorizontal: 20, paddingVertical: 30, backgroundColor: 'rgba(3, 18, 11, 0.62)', alignItems: 'center', justifyContent: 'center' },
  importGuideCard: { width: '100%', maxWidth: 540, maxHeight: '90%', borderRadius: 18, borderWidth: 1, borderColor: theme.border, backgroundColor: theme.backgroundRaised, overflow: 'hidden', shadowColor: theme.shadow, shadowOffset: { width: 0, height: 14 }, shadowOpacity: 0.32, shadowRadius: 28, elevation: 16 },
  importGuideHeader: { paddingHorizontal: 20, paddingTop: 19, paddingBottom: 14, flexDirection: 'row', alignItems: 'flex-start', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.borderSoft },
  importGuideTitleGroup: { flex: 1, minWidth: 0 },
  importGuideEyebrow: { color: theme.accent, fontSize: 10, fontWeight: '800', letterSpacing: 1.35, marginBottom: 4 },
  importGuideTitle: { color: theme.text, fontSize: 20, lineHeight: 25, fontWeight: '800', letterSpacing: -0.4 },
  importGuideClose: { width: 34, height: 34, marginLeft: 12, borderRadius: 11, backgroundColor: theme.backgroundElement, alignItems: 'center', justifyContent: 'center' },
  importGuideContent: { paddingHorizontal: 20, paddingTop: 17, paddingBottom: 19 },
  importGuideIntro: { color: theme.textSecondary, fontSize: 14, lineHeight: 21, marginBottom: 12 },
  csvExample: { borderRadius: 12, borderWidth: 1, borderColor: theme.border, backgroundColor: theme.background, marginBottom: 18 },
  csvExampleText: { minWidth: '100%', paddingHorizontal: 13, paddingVertical: 12, color: theme.text, fontSize: 12, lineHeight: 19, fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', web: 'monospace' }) },
  importRulesTitle: { color: theme.text, fontSize: 14, fontWeight: '800', marginBottom: 8 },
  importRules: { gap: 6 },
  importRule: { color: theme.textMuted, fontSize: 13, lineHeight: 19 },
  importGuideActions: { paddingHorizontal: 16, paddingVertical: 14, flexDirection: 'row', justifyContent: 'flex-end', gap: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.borderSoft },
  importGuideCancel: { minHeight: 44, paddingHorizontal: 16, borderRadius: 12, borderWidth: 1, borderColor: theme.border, alignItems: 'center', justifyContent: 'center' },
  importGuideCancelText: { color: theme.textSecondary, fontSize: 14, fontWeight: '700' },
  importGuideChoose: { minHeight: 44, paddingHorizontal: 17, borderRadius: 12, backgroundColor: theme.accent, alignItems: 'center', justifyContent: 'center' },
  importGuideChooseText: { color: theme.background, fontSize: 14, fontWeight: '800' },
  trashContent: { paddingHorizontal: 24, paddingTop: 22, paddingBottom: 50 },
  trashIntroRow: { marginBottom: 14, gap: 11, alignItems: 'flex-start' },
  trashHelper: { color: theme.textMuted, fontSize: 13, lineHeight: 19 },
  emptyTrashButton: { minHeight: 36, paddingHorizontal: 13, borderRadius: 11, borderWidth: 1, borderColor: theme.danger, alignItems: 'center', justifyContent: 'center' },
  emptyTrashButtonText: { color: theme.danger, fontSize: 13, fontWeight: '800' },
  trashRow: { minHeight: 72, paddingHorizontal: 15, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 9 },
  trashCopy: { flex: 1, minWidth: 0 },
  restoreButton: { height: 36, paddingHorizontal: 12, borderRadius: 11, backgroundColor: theme.accentMuted, alignItems: 'center', justifyContent: 'center' },
  restoreButtonText: { color: theme.accent, fontSize: 13, fontWeight: '800' },
  foreverButton: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  emptyTrash: { alignItems: 'center', paddingTop: 86, paddingHorizontal: 30 },
  emptyTrashIcon: { width: 54, height: 54, borderRadius: 17, backgroundColor: theme.accentMuted, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  emptyTrashTitle: { color: theme.text, fontSize: 18, fontWeight: '800' },
  emptyTrashText: { maxWidth: 310, color: theme.textMuted, textAlign: 'center', fontSize: 14, lineHeight: 21, marginTop: 6 },
});
