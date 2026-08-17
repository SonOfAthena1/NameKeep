import { StatusBar } from 'expo-status-bar';
import { useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { Label, Person } from '@/database/types';

const PALETTE = {
  background: '#061A12',
  backgroundRaised: '#09251A',
  surface: '#0D3021',
  surfacePressed: '#12452E',
  border: '#1B5A3B',
  borderSoft: '#123F2A',
  accent: '#45E37F',
  accentStrong: '#20BE61',
  accentDark: '#08753A',
  text: '#ECFFF2',
  textMuted: '#91CBA6',
  textFaint: '#649577',
} as const;

const SAMPLE_LABELS: Label[] = [
  { id: 'work', name: 'Work', createdAt: 1_755_907_200_000 },
  { id: 'speech', name: 'Speech Class', createdAt: 1_753_315_200_000 },
  { id: 'math', name: 'Math Class', createdAt: 1_748_736_000_000 },
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

function getInitials(name: string) {
  return name
    .split(' ')
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
}

export default function HomeScreen() {
  const [search, setSearch] = useState('');
  const [collapsedLabelIds, setCollapsedLabelIds] = useState<Set<string>>(
    () => new Set(),
  );

  const sections = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();

    return [...SAMPLE_LABELS]
      .sort((a, b) => b.createdAt - a.createdAt)
      .map((label) => {
        const labelMatches = label.name.toLocaleLowerCase().includes(query);
        const people = SAMPLE_PEOPLE.filter((person) => person.labelId === label.id)
          .filter(
            (person) =>
              !query ||
              labelMatches ||
              person.name.toLocaleLowerCase().includes(query) ||
              person.description.toLocaleLowerCase().includes(query),
          )
          .sort((a, b) => b.createdAt - a.createdAt);

        return { label, people };
      })
      .filter(({ people }) => !query || people.length > 0);
  }, [search]);

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

  return (
    <View style={styles.screen}>
      <StatusBar style="light" />
      <View pointerEvents="none" style={styles.glowTop} />
      <View pointerEvents="none" style={styles.glowBottom} />

      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <View style={styles.brandRow}>
            <View style={styles.brandMark}>
              <Text style={styles.brandInitial}>N</Text>
            </View>
            <Text style={styles.brandName}>NameKeep</Text>
          </View>

          <Text style={styles.title}>People you’ve met</Text>
          <Text style={styles.subtitle}>Names, context, remembered.</Text>
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
            placeholderTextColor={PALETTE.textFaint}
            returnKeyType="search"
            selectionColor={PALETTE.accent}
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
              {SAMPLE_PEOPLE.length} {SAMPLE_PEOPLE.length === 1 ? 'person' : 'people'}
            </Text>
          </View>

          {sections.map(({ label, people }) => {
            const isCollapsed = collapsedLabelIds.has(label.id);

            return (
              <View key={label.id} style={styles.section}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ expanded: !isCollapsed }}
                  onPress={() => toggleLabel(label.id)}
                  style={({ pressed }) => [
                    styles.sectionHeader,
                    pressed && styles.sectionHeaderPressed,
                  ]}>
                  <View style={styles.chevronBox}>
                    <Text style={styles.chevron}>{isCollapsed ? '›' : '⌄'}</Text>
                  </View>
                  <Text style={styles.sectionTitle}>{label.name}</Text>
                  <View style={styles.countPill}>
                    <Text style={styles.countText}>{people.length}</Text>
                  </View>
                </Pressable>

                {!isCollapsed && (
                  <View style={styles.peopleList}>
                    {people.map((person, index) => (
                      <View
                        key={person.id}
                        style={[styles.personRow, index > 0 && styles.personDivider]}>
                        <View style={styles.avatar}>
                          <Text style={styles.avatarText}>{getInitials(person.name)}</Text>
                        </View>
                        <View style={styles.personCopy}>
                          <Text style={styles.personName}>{person.name}</Text>
                          <Text style={styles.personDescription}>{person.description}</Text>
                        </View>
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

        <Pressable
          accessibilityLabel="Add a person"
          accessibilityRole="button"
          style={({ pressed }) => [styles.addButton, pressed && styles.addButtonPressed]}>
          <Text style={styles.addButtonText}>＋</Text>
        </Pressable>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: PALETTE.background,
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
    backgroundColor: '#0B6B39',
    opacity: 0.18,
    top: -190,
    right: -120,
  },
  glowBottom: {
    position: 'absolute',
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: '#08753A',
    opacity: 0.1,
    bottom: -170,
    left: -150,
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 22,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 30,
  },
  brandMark: {
    width: 30,
    height: 30,
    borderRadius: 9,
    backgroundColor: PALETTE.accent,
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ rotate: '-4deg' }],
  },
  brandInitial: {
    color: PALETTE.background,
    fontSize: 18,
    fontWeight: '900',
  },
  brandName: {
    color: PALETTE.text,
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  title: {
    color: PALETTE.text,
    fontSize: 32,
    lineHeight: 37,
    fontWeight: '800',
    letterSpacing: -1.1,
  },
  subtitle: {
    color: PALETTE.textMuted,
    fontSize: 15,
    lineHeight: 22,
    marginTop: 5,
  },
  searchBox: {
    height: 54,
    marginHorizontal: 24,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: PALETTE.border,
    backgroundColor: PALETTE.backgroundRaised,
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
    borderColor: PALETTE.textMuted,
  },
  searchHandle: {
    position: 'absolute',
    width: 7,
    height: 2,
    borderRadius: 1,
    backgroundColor: PALETTE.textMuted,
    transform: [{ rotate: '45deg' }],
    right: 1,
    bottom: 3,
  },
  searchInput: {
    flex: 1,
    height: '100%',
    color: PALETTE.text,
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
    color: PALETTE.textFaint,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  peopleCount: {
    color: PALETTE.textFaint,
    fontSize: 12,
    fontWeight: '600',
  },
  section: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: PALETTE.borderSoft,
    backgroundColor: PALETTE.surface,
    marginBottom: 13,
    overflow: 'hidden',
  },
  sectionHeader: {
    minHeight: 59,
    paddingHorizontal: 15,
    flexDirection: 'row',
    alignItems: 'center',
  },
  sectionHeaderPressed: {
    backgroundColor: PALETTE.surfacePressed,
  },
  chevronBox: {
    width: 29,
    height: 29,
    borderRadius: 10,
    backgroundColor: PALETTE.accentDark,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  chevron: {
    color: PALETTE.accent,
    fontSize: 23,
    lineHeight: 24,
    fontWeight: '700',
    marginTop: -2,
  },
  sectionTitle: {
    flex: 1,
    color: PALETTE.text,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.25,
  },
  countPill: {
    minWidth: 27,
    height: 25,
    borderRadius: 13,
    paddingHorizontal: 8,
    backgroundColor: PALETTE.backgroundRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countText: {
    color: PALETTE.textMuted,
    fontSize: 12,
    fontWeight: '800',
  },
  peopleList: {
    paddingHorizontal: 15,
    paddingBottom: 7,
  },
  personRow: {
    minHeight: 70,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  personDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: PALETTE.border,
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 13,
    backgroundColor: PALETTE.backgroundRaised,
    borderWidth: 1,
    borderColor: PALETTE.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarText: {
    color: PALETTE.accent,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.3,
  },
  personCopy: {
    flex: 1,
    gap: 3,
  },
  personName: {
    color: PALETTE.text,
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: -0.15,
  },
  personDescription: {
    color: PALETTE.textMuted,
    fontSize: 13,
    lineHeight: 18,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 54,
    paddingHorizontal: 24,
  },
  emptyTitle: {
    color: PALETTE.text,
    fontSize: 17,
    fontWeight: '700',
  },
  emptyText: {
    color: PALETTE.textMuted,
    fontSize: 14,
    marginTop: 6,
  },
  addButton: {
    position: 'absolute',
    right: 24,
    bottom: 24,
    width: 60,
    height: 60,
    borderRadius: 21,
    backgroundColor: PALETTE.accent,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#74F1A3',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 9 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 8,
  },
  addButtonPressed: {
    backgroundColor: PALETTE.accentStrong,
    transform: [{ scale: 0.96 }],
  },
  addButtonText: {
    color: PALETTE.background,
    fontSize: 31,
    lineHeight: 34,
    fontWeight: '500',
    marginTop: -2,
  },
});
