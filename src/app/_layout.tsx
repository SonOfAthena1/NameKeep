import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { SQLiteProvider } from 'expo-sqlite';
import { Platform } from 'react-native';

import { Colors } from '@/constants/theme';
import { migrateDatabase } from '@/database/migrate';
import { AppThemeProvider, useAppTheme } from '@/hooks/use-theme';

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
  return (
    <AppThemeProvider>
      <RootNavigator />
    </AppThemeProvider>
  );
}

/** Applies the selected colors to navigation and opens the app database. */
function RootNavigator() {
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
      </SQLiteProvider>
    </ThemeProvider>
  );
}
