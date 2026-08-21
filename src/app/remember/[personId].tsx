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
    <SafeAreaView style={styles.screen}>
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
          Back to NameKeep
        </Text>
      </View>
    </SafeAreaView>
  );
}

const createStyles = (theme: AppTheme) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: theme.background },
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
