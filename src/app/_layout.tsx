import {
  DarkTheme,
  DefaultTheme,
  type Href,
  router,
  Stack,
  ThemeProvider,
  useRootNavigationState,
} from 'expo-router';
import * as Notifications from 'expo-notifications';
import { SQLiteProvider } from 'expo-sqlite';
import { useEffect, useLayoutEffect, useMemo } from 'react';
import { Platform } from 'react-native';

import { AppErrorProvider } from '@/components/app-error-dialog';
import { Colors } from '@/constants/theme';
import { migrateDatabase } from '@/database/migrate';
import { AppThemeProvider, useAppTheme } from '@/hooks/use-theme';
import { MemoryReminderNotificationResponseCoordinator } from '@/lib/notification-response-coordinator';

export const unstable_settings = {
  initialRouteName: 'index',
};

if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}

/** Sets up the app-wide theme provider and navigation shell. */
export default function RootLayout() {
  const notificationCoordinator = useMemo(
    () =>
      new MemoryReminderNotificationResponseCoordinator({
        navigate: (personId) =>
          router.push({
            pathname: '/remember/[personId]',
            params: { personId },
          } as Href),
        clearLastResponse: () =>
          Notifications.clearLastNotificationResponse(),
        onError: (error) =>
          console.error(
            'Could not handle memory reminder notification response',
            error,
          ),
      }),
    [],
  );

  useLayoutEffect(() => {
    if (Platform.OS === 'web') return;

    const subscription = Notifications.addNotificationResponseReceivedListener(
      (response) => notificationCoordinator.receive(response),
    );

    // Read after subscribing so a response arriving during startup cannot fall
    // into a gap between checking native state and installing the live listener.
    notificationCoordinator.receive(
      Notifications.getLastNotificationResponse(),
    );

    return () => subscription.remove();
  }, [notificationCoordinator]);

  return (
    <AppThemeProvider>
      <AppErrorProvider>
        <RootNavigator notificationCoordinator={notificationCoordinator} />
      </AppErrorProvider>
    </AppThemeProvider>
  );
}

/** Applies the selected colors to navigation and opens the app database. */
function RootNavigator({
  notificationCoordinator,
}: {
  notificationCoordinator: MemoryReminderNotificationResponseCoordinator;
}) {
  const { colorScheme } = useAppTheme();
  const colors = Colors[colorScheme];
  const baseTheme = colorScheme === 'dark' ? DarkTheme : DefaultTheme;
  const navigationTheme = {
    ...baseTheme,
    colors: {
      ...baseTheme.colors,
      primary: colors.accent,
      background: colors.background,
      card: colors.surface,
      text: colors.text,
      border: colors.border,
      notification: colors.accent,
    },
  };

  return (
    <ThemeProvider value={navigationTheme}>
      <SQLiteProvider databaseName="namekeep.db" onInit={migrateDatabase}>
        <Stack screenOptions={{ headerShown: false }} />
        <NotificationNavigationReadiness
          notificationCoordinator={notificationCoordinator}
        />
      </SQLiteProvider>
    </ThemeProvider>
  );
}

/** Releases queued notification taps after SQLite and root navigation mount. */
function NotificationNavigationReadiness({
  notificationCoordinator,
}: {
  notificationCoordinator: MemoryReminderNotificationResponseCoordinator;
}) {
  const rootNavigationState = useRootNavigationState();
  const navigationKey = rootNavigationState?.key;

  useEffect(() => {
    notificationCoordinator.setReady(Boolean(navigationKey));
    return () => notificationCoordinator.setReady(false);
  }, [navigationKey, notificationCoordinator]);

  return null;
}
