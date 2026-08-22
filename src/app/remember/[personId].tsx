import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { AppTheme } from '@/constants/theme';
import { listActiveLabels } from '@/database/labels-repository';
import { getActivePerson } from '@/database/people-repository';
import type { Person } from '@/database/types';
import { useTheme } from '@/hooks/use-theme';

/** Shows the answer after someone opens a memory-reminder notification. */
export default function RememberPersonScreen() {
  const { personId } = useLocalSearchParams<{ personId: string }>();
  const db = useSQLiteContext();
  const router = useRouter();
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [person, setPerson] = useState<Person | null>(null);
  const [labelName, setLabelName] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadPerson() {
      const [storedPerson, labels] = await Promise.all([
        getActivePerson(db, personId),
        listActiveLabels(db),
      ]);
      if (cancelled) return;

      if (storedPerson) {
        setPerson(storedPerson);
        setLabelName(
          labels.find((label) => label.id === storedPerson.labelId)?.name ?? null,
        );
      }
      setIsLoaded(true);
    }

    void loadPerson();
    return () => {
      cancelled = true;
    };
  }, [db, personId]);

  return (
    <View style={styles.screen}>
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
        </View>
        <View style={styles.content}>
          <Text style={styles.eyebrow}>MEMORY REVEAL</Text>
          {isLoaded && person ? (
            <>
              <Text style={styles.name}>{person.name}</Text>
              {!!person.description && (
                <Text style={styles.description}>{person.description}</Text>
              )}
              {labelName && <Text style={styles.label}>{labelName}</Text>}
            </>
          ) : isLoaded ? (
            <Text style={styles.message}>
              This person is no longer available.
            </Text>
          ) : (
            <Text style={styles.message}>Loading…</Text>
          )}
          <Text
            accessibilityRole="button"
            onPress={() => router.back()}
            style={styles.back}>
            Back to home
          </Text>
        </View>
      </SafeAreaView>
    </View>
  );
}

/** Creates this screen's colors and layout for the active theme. */
const createStyles = (theme: AppTheme) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: theme.background, overflow: 'hidden' },
    safeArea: { flex: 1, width: '100%', maxWidth: 720, alignSelf: 'center' },
    glowTop: { position: 'absolute', width: 320, height: 320, borderRadius: 160, backgroundColor: theme.glowTop, opacity: 0.18, top: -190, right: -120 },
    glowBottom: { position: 'absolute', width: 280, height: 280, borderRadius: 140, backgroundColor: theme.glowBottom, opacity: 0.1, bottom: -170, left: -150 },
    header: { paddingHorizontal: 24, paddingTop: 16, paddingBottom: 16, flexDirection: 'row', justifyContent: 'flex-end' },
    brandRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    brandMark: { width: 30, height: 30, borderRadius: 9, backgroundColor: theme.accent, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '-4deg' }] },
    brandInitial: { color: theme.background, fontSize: 18, fontWeight: '900' },
    brandName: { color: theme.text, fontSize: 17, fontWeight: '700', letterSpacing: -0.3 },
    content: { flex: 1, justifyContent: 'center', padding: 30 },
    eyebrow: {
      color: theme.accent,
      fontSize: 11,
      fontWeight: '800',
      letterSpacing: 1.5,
      marginBottom: 14,
    },
    name: {
      color: theme.text,
      fontSize: 42,
      fontWeight: '800',
      letterSpacing: -1.1,
    },
    description: {
      color: theme.textSecondary,
      fontSize: 19,
      lineHeight: 28,
      marginTop: 18,
    },
    label: {
      alignSelf: 'flex-start',
      backgroundColor: theme.accentMuted,
      borderRadius: 12,
      color: theme.accent,
      fontSize: 14,
      fontWeight: '800',
      marginTop: 22,
      paddingHorizontal: 12,
      paddingVertical: 7,
    },
    message: { color: theme.textSecondary, fontSize: 18, lineHeight: 26 },
    back: { color: theme.accent, fontSize: 15, fontWeight: '800', marginTop: 36 },
  });
