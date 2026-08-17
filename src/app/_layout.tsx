import { DarkTheme, Stack, ThemeProvider } from 'expo-router';
import { SQLiteProvider } from 'expo-sqlite';

import { migrateDatabase } from '@/database/migrate';

const nameKeepTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: '#45E37F',
    background: '#061A12',
    card: '#0D3021',
    text: '#ECFFF2',
    border: '#1B5A3B',
    notification: '#45E37F',
  },
};

export default function RootLayout() {
  return (
    <ThemeProvider value={nameKeepTheme}>
      <SQLiteProvider databaseName="namekeep.db" onInit={migrateDatabase}>
        <Stack screenOptions={{ headerShown: false }} />
      </SQLiteProvider>
    </ThemeProvider>
  );
}
