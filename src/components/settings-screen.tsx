import { SymbolView } from 'expo-symbols';
import { StatusBar } from 'expo-status-bar';
import { useMemo, useState } from 'react';
import {
  Alert,
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
import type { Label, Person } from '@/database/types';
import { useAppTheme, useTheme, type ThemePreference } from '@/hooks/use-theme';

export type SortOrder = 'newest' | 'oldest' | 'alphabetical';
export type TrashedPerson = Person & { deletedAt: number };

type Picker = 'theme' | 'color' | 'defaultLabel' | 'labelsSort' | 'peopleSort' | null;

type SettingsScreenProps = {
  labels: Label[];
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
  trash: TrashedPerson[];
  onRestore: (personId: string) => void;
  onDeleteForever: (personId: string) => void;
  onEmptyTrash: () => void;
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

export function SettingsScreen({
  labels,
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
  trash,
  onRestore,
  onDeleteForever,
  onEmptyTrash,
  onBack,
}: SettingsScreenProps) {
  const theme = useTheme();
  const { colorScheme, themePreference, setThemePreference } = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [picker, setPicker] = useState<Picker>(null);
  const [showTrash, setShowTrash] = useState(false);

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

  function togglePicker(nextPicker: Exclude<Picker, null>) {
    setPicker((current) => (current === nextPicker ? null : nextPicker));
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
                  <View key={person.id} style={[styles.trashRow, index > 0 && styles.rowDivider]}>
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

        <Section title="DATA" styles={styles}>
          <SettingRow title="Trash" subtitle="View, restore, or permanently delete people" value={trash.length ? String(trash.length) : undefined} onPress={() => setShowTrash(true)} styles={styles} theme={theme} leading={<SymbolView name={{ ios: 'trash', android: 'delete', web: 'delete' }} size={20} tintColor={theme.danger} />} />
        </Section>
      </ScrollView>
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

function SettingRow({ title, subtitle, value, onPress, expanded, leading, styles, theme }: { title: string; subtitle?: string; value?: string; onPress: () => void; expanded?: boolean; leading?: React.ReactNode; styles: ReturnType<typeof createStyles>; theme: AppTheme }) {
  return <Pressable accessibilityRole="button" accessibilityState={expanded === undefined ? undefined : { expanded }} onPress={onPress} style={({ pressed }) => [styles.settingRow, pressed && styles.rowPressed]}>{leading}<View style={styles.rowCopy}><Text style={styles.rowTitle}>{title}</Text>{subtitle && <Text style={styles.rowSubtitle}>{subtitle}</Text>}</View>{value && <Text numberOfLines={1} style={styles.rowValue}>{value}</Text>}<SymbolView name={{ ios: expanded ? 'chevron.up' : 'chevron.right', android: expanded ? 'keyboard_arrow_up' : 'chevron_right', web: expanded ? 'keyboard_arrow_up' : 'chevron_right' }} size={19} tintColor={theme.textFaint} /></Pressable>;
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
  rowPressed: { backgroundColor: theme.surfacePressed },
  rowDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.borderSoft, marginLeft: 15 },
  rowCopy: { flex: 1, minWidth: 0 },
  rowTitle: { color: theme.text, fontSize: 15, fontWeight: '700' },
  rowSubtitle: { color: theme.textMuted, fontSize: 12, lineHeight: 17, marginTop: 3 },
  rowValue: { maxWidth: '42%', color: theme.textSecondary, fontSize: 13, fontWeight: '600' },
  colorDot: { width: 16, height: 16, borderRadius: 8 },
  choiceList: { padding: 7, paddingTop: 0 },
  choiceRow: { minHeight: 43, borderRadius: 10, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  choiceRowSelected: { backgroundColor: theme.accentMuted },
  choiceText: { color: theme.text, fontSize: 14, fontWeight: '600' },
  colorGrid: { paddingHorizontal: 11, paddingBottom: 12, flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  colorChoice: { width: 45, height: 45, borderRadius: 13, borderWidth: 2, borderColor: 'transparent', alignItems: 'center', justifyContent: 'center' },
  colorChoiceSelected: { borderColor: theme.text },
  colorSwatch: { width: 33, height: 33, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
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
