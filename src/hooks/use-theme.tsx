import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';

import { Colors, DefaultColorScheme, type AppColorScheme } from '@/constants/theme';

type AppThemeContextValue = {
  colorScheme: AppColorScheme;
  themePreference: ThemePreference;
  setThemePreference: (preference: ThemePreference) => void;
};

export type ThemePreference = AppColorScheme | 'system';

const AppThemeContext = createContext<AppThemeContextValue | null>(null);

export function AppThemeProvider({ children }: { children: ReactNode }) {
  const systemColorScheme = useColorScheme();
  const [themePreference, setThemePreference] =
    useState<ThemePreference>('system');
  const resolvedSystemColorScheme: AppColorScheme =
    systemColorScheme === 'dark' ? 'dark' : DefaultColorScheme;
  const colorScheme: AppColorScheme =
    themePreference === 'system'
      ? resolvedSystemColorScheme
      : themePreference;
  const value = useMemo(
    () => ({ colorScheme, themePreference, setThemePreference }),
    [colorScheme, themePreference],
  );

  return <AppThemeContext.Provider value={value}>{children}</AppThemeContext.Provider>;
}

export function useAppTheme() {
  const context = useContext(AppThemeContext);

  if (!context) {
    throw new Error('useAppTheme must be used within an AppThemeProvider');
  }

  return context;
}

export function useTheme() {
  const { colorScheme } = useAppTheme();

  return Colors[colorScheme];
}
