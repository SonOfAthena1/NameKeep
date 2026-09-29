import type { ErrorBoundaryProps } from 'expo-router';
import { Component, useMemo, type ErrorInfo, type ReactNode } from 'react';
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppErrorCard, formatError } from '@/components/app-error-dialog';
import type { AppTheme } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/** Keeps the error visible when the affected screen cannot stay mounted. */
function AppErrorRecoveryScreen({
  error,
  onRetry,
}: {
  error: Error;
  onRetry: () => void;
}) {
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <SafeAreaView style={styles.screen}>
      <AppErrorCard
        actionLabel="Try Again"
        details={formatError(error)}
        onAction={onRetry}
      />
    </SafeAreaView>
  );
}

/** Catches errors thrown while rendering an individual Expo Router screen. */
export function ScreenErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  return <AppErrorRecoveryScreen error={error} onRetry={() => void retry()} />;
}

/** Catches layout and database startup failures outside the screen boundary. */
export class AppErrorBoundary extends Component<
  { children: ReactNode },
  { error: Error | null }
> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Unexpected app error', error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <AppErrorRecoveryScreen
          error={this.state.error}
          onRetry={() => this.setState({ error: null })}
        />
      );
    }
    return this.props.children;
  }
}

const createStyles = (theme: AppTheme) =>
  StyleSheet.create({
    screen: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.background,
      padding: 24,
    },
  });
