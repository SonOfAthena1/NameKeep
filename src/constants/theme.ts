/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import '@/global.css';

import { Platform } from 'react-native';

/** The original palette, kept intact so the green version can be restored in one line. */
export const GreenColors = {
  light: {
    background: '#F6FBF8',
    backgroundRaised: '#FFFFFF',
    surface: '#FFFFFF',
    surfacePressed: '#E8F5ED',
    backgroundElement: '#E8F5ED',
    backgroundSelected: '#D6EBDD',
    border: '#B8D8C4',
    borderSoft: '#D7EADF',
    accent: '#128044',
    accentStrong: '#0F713D',
    accentMuted: '#DDF4E6',
    danger: '#B42318',
    text: '#102018',
    textSecondary: '#4F6F5C',
    textMuted: '#4F6F5C',
    textDescription: '#263b2f',
    textFaint: '#587765',
    glowTop: '#65C78B',
    glowBottom: '#8BD7A7',
    buttonBorder: '#128246',
    shadow: '#173D28',
  },
  dark: {
    background: '#061A12',
    backgroundRaised: '#09251A',
    surface: '#0D3021',
    surfacePressed: '#12452E',
    backgroundElement: '#0D3021',
    backgroundSelected: '#12452E',
    border: '#1B5A3B',
    borderSoft: '#123F2A',
    accent: '#45E37F',
    accentStrong: '#20BE61',
    accentMuted: '#08753A',
    danger: '#FF7A70',
    text: '#ECFFF2',
    textSecondary: '#91CBA6',
    textMuted: '#91CBA6',
    textDescription: '#AFDDBF',
    textFaint: '#649577',
    glowTop: '#0B6B39',
    glowBottom: '#08753A',
    buttonBorder: '#74F1A3',
    shadow: '#000000',
  },
} as const;

/**
 * The blue version uses the app's existing blue label hue for every primary
 * interaction: buttons, selections, navigation, and highlights.
 */
export const BlueColors = {
  light: {
    background: '#F7F9FF',
    backgroundRaised: '#FFFFFF',
    surface: '#FFFFFF',
    surfacePressed: '#E7EDFF',
    backgroundElement: '#E7EDFF',
    backgroundSelected: '#D7E2FF',
    border: '#B9C9F0',
    borderSoft: '#D8E2F8',
    accent: '#2854B8',
    accentStrong: '#20459E',
    accentMuted: '#E3EAFF',
    danger: '#B42318',
    text: '#111B35',
    textSecondary: '#4E638D',
    textMuted: '#4E638D',
    textDescription: '#263550',
    textFaint: '#5A6D96',
    glowTop: '#7697ED',
    glowBottom: '#A5B8F5',
    buttonBorder: '#2854B8',
    shadow: '#182950',
  },
  dark: {
    background: '#081124',
    backgroundRaised: '#0B1730',
    surface: '#10203D',
    surfacePressed: '#18335E',
    backgroundElement: '#10203D',
    backgroundSelected: '#18335E',
    border: '#264B88',
    borderSoft: '#193461',
    accent: '#7191FF',
    accentStrong: '#5775E8',
    accentMuted: '#243F8E',
    danger: '#FF7A70',
    text: '#EEF2FF',
    textSecondary: '#AABCF6',
    textMuted: '#AABCF6',
    textDescription: '#C7D3FF',
    textFaint: '#8297CE',
    glowTop: '#2E52B3',
    glowBottom: '#243F8E',
    buttonBorder: '#98B0FF',
    shadow: '#000000',
  },
} as const;

// Change this to GreenColors to restore the original green app palette.
export const Colors = GreenColors;

export const DefaultColorScheme = 'light' as const;
export type AppColorScheme = keyof typeof Colors;
export type ThemePreference = AppColorScheme | 'system';
export type AppTheme = (typeof Colors)[AppColorScheme];
export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
