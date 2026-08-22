import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';

import {
  Colors,
  DefaultColorScheme,
  type AppColorScheme,
  type ThemePreference,
} from '@/constants/theme';

export type { ThemePreference } from '@/constants/theme';

type AppThemeContextValue = {
  colorScheme: AppColorScheme;
  themePreference: ThemePreference;
  setThemePreference: (preference: ThemePreference) => void;
};

const AppThemeContext = createContext<AppThemeContextValue | null>(null);

/** Shares the selected color theme with the whole app. */
export function AppThemeProvider({ children }: { children: ReactNode }) {
  const systemColorScheme = useColorScheme();
  const [themePreference, setThemePreference] =
    useState<ThemePreference>('light');
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

/** Gets the theme choice and the function that changes it. */
export function useAppTheme() {
  const context = useContext(AppThemeContext);

  if (!context) {
    throw new Error('useAppTheme must be used within an AppThemeProvider');
  }

  return context;
}

/** Gets the colors for the currently active theme. */
export function useTheme() {
  const { colorScheme } = useAppTheme();

  return Colors[colorScheme];
}
