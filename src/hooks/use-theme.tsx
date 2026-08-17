import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

import { Colors, DefaultColorScheme, type AppColorScheme } from '@/constants/theme';

type AppThemeContextValue = {
  colorScheme: AppColorScheme;
  setColorScheme: (colorScheme: AppColorScheme) => void;
};

const AppThemeContext = createContext<AppThemeContextValue | null>(null);

export function AppThemeProvider({ children }: { children: ReactNode }) {
  const [colorScheme, setColorScheme] = useState<AppColorScheme>(DefaultColorScheme);
  const value = useMemo(() => ({ colorScheme, setColorScheme }), [colorScheme]);

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
