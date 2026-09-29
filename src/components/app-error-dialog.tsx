import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import type { AppTheme } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type ErrorNotice = {
  context?: string;
  details: string;
};

type ErrorReporter = {
  showError: (error: unknown, context?: string) => void;
};

const ErrorReporterContext = createContext<ErrorReporter | null>(null);

/** Keeps the original error available while showing a clear recovery message. */
export function formatError(error: unknown): string {
  if (error instanceof Error) {
    return error.stack || `${error.name}: ${error.message}`;
  }
  return String(error);
}

/** Presents the same recovery message in popups and error fallback screens. */
export function AppErrorCard({
  details,
  context,
  actionLabel,
  onAction,
}: ErrorNotice & { actionLabel: string; onAction: () => void }) {
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <View accessibilityViewIsModal style={styles.card}>
      <Text style={styles.eyebrow}>NAMEKEEP ERROR</Text>
      <Text style={styles.title}>Something went wrong</Text>
      <Text style={styles.message}>
        There was a problem. Please restart the app and try again.
      </Text>
      {context && <Text style={styles.context}>{context}</Text>}
      <Text style={styles.detailsLabel}>Original error</Text>
      <ScrollView style={styles.detailsBox}>
        <Text selectable style={styles.detailsText}>
          {details}
        </Text>
      </ScrollView>
      <Pressable
        accessibilityRole="button"
        onPress={onAction}
        style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}>
        <Text style={styles.buttonText}>{actionLabel}</Text>
      </Pressable>
    </View>
  );
}

/** Shows caught errors from anywhere under the app's root layout. */
export function AppErrorProvider({ children }: { children: ReactNode }) {
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [notices, setNotices] = useState<ErrorNotice[]>([]);
  const currentNotice = notices[0];

  const showError = useCallback((error: unknown, context?: string) => {
    setNotices((current) => [...current, { context, details: formatError(error) }]);
  }, []);
  const dismissError = useCallback(() => {
    setNotices((current) => current.slice(1));
  }, []);
  const reporter = useMemo(() => ({ showError }), [showError]);

  return (
    <ErrorReporterContext.Provider value={reporter}>
      {children}
      <Modal
        animationType="fade"
        onRequestClose={dismissError}
        presentationStyle="overFullScreen"
        transparent
        visible={currentNotice !== undefined}>
        <View style={styles.backdrop}>
          {currentNotice && (
            <AppErrorCard
              actionLabel="OK"
              context={currentNotice.context}
              details={currentNotice.details}
              onAction={dismissError}
            />
          )}
        </View>
      </Modal>
    </ErrorReporterContext.Provider>
  );
}

/** Reports a caught error to the shared app dialog. */
export function useErrorReporter(): ErrorReporter {
  const reporter = useContext(ErrorReporterContext);
  if (!reporter) {
    throw new Error('useErrorReporter must be used within AppErrorProvider');
  }
  return reporter;
}

const createStyles = (theme: AppTheme) =>
  StyleSheet.create({
    backdrop: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(0, 0, 0, 0.55)',
      padding: 24,
    },
    card: {
      width: '100%',
      maxWidth: 480,
      maxHeight: '85%',
      borderRadius: 22,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.surface,
      padding: 24,
    },
    eyebrow: {
      color: theme.danger,
      fontSize: 11,
      fontWeight: '800',
      letterSpacing: 1.3,
      marginBottom: 9,
    },
    title: {
      color: theme.text,
      fontSize: 23,
      fontWeight: '800',
      marginBottom: 12,
    },
    message: {
      color: theme.text,
      fontSize: 16,
      lineHeight: 23,
    },
    context: {
      color: theme.textSecondary,
      fontSize: 14,
      lineHeight: 20,
      marginTop: 10,
    },
    detailsLabel: {
      color: theme.textSecondary,
      fontSize: 12,
      fontWeight: '700',
      marginTop: 22,
      marginBottom: 8,
    },
    detailsBox: {
      flexShrink: 1,
      maxHeight: 180,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: theme.borderSoft,
      backgroundColor: theme.backgroundElement,
      padding: 12,
    },
    detailsText: {
      color: theme.textSecondary,
      fontSize: 12,
      lineHeight: 18,
    },
    button: {
      alignItems: 'center',
      borderRadius: 12,
      backgroundColor: theme.accent,
      marginTop: 22,
      paddingVertical: 14,
    },
    buttonPressed: { backgroundColor: theme.accentStrong },
    buttonText: {
      color: theme.background,
      fontSize: 15,
      fontWeight: '800',
    },
  });
