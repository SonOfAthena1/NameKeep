export const LABEL_COLOR_OPTIONS = [
  { id: 'green', name: 'Green' },
  { id: 'blue', name: 'Blue' },
  { id: 'violet', name: 'Violet' },
  { id: 'pink', name: 'Pink' },
  { id: 'red', name: 'Red' },
  { id: 'orange', name: 'Orange' },
  { id: 'amber', name: 'Amber' },
  { id: 'teal', name: 'Teal' },
  { id: 'gray', name: 'Gray' },
] as const;

export type LabelColor = (typeof LABEL_COLOR_OPTIONS)[number]['id'];

type LabelColorTheme = {
  base: string;
  pressed: string;
  foreground: string;
};

export const LabelColors: Record<
  'light' | 'dark',
  Record<LabelColor, LabelColorTheme>
> = {
  light: {
    green: { base: '#128044', pressed: '#0F713D', foreground: '#FFFFFF' },
    blue: { base: '#2854B8', pressed: '#20459E', foreground: '#FFFFFF' },
    violet: { base: '#6D4DB3', pressed: '#5D3FA0', foreground: '#FFFFFF' },
    pink: { base: '#B43E70', pressed: '#9E315F', foreground: '#FFFFFF' },
    red: { base: '#C43737', pressed: '#A92C2C', foreground: '#FFFFFF' },
    orange: { base: '#B86024', pressed: '#9F501B', foreground: '#FFFFFF' },
    amber: { base: '#936600', pressed: '#7D5600', foreground: '#FFFFFF' },
    teal: { base: '#087FA6', pressed: '#076B8C', foreground: '#FFFFFF' },
    gray: { base: '#292D30', pressed: '#1D2022', foreground: '#FFFFFF' },
  },
  dark: {
    green: { base: '#45E37F', pressed: '#20BE61', foreground: '#061A12' },
    blue: { base: '#7191FF', pressed: '#5775E8', foreground: '#090E2A' },
    violet: { base: '#AE91FF', pressed: '#9677EC', foreground: '#160E2A' },
    pink: { base: '#F889B6', pressed: '#E36D9E', foreground: '#2B0B18' },
    red: { base: '#FF6666', pressed: '#E84E4E', foreground: '#2C0909' },
    orange: { base: '#FFAA67', pressed: '#E9904E', foreground: '#291207' },
    amber: { base: '#EBC85C', pressed: '#D3AE3F', foreground: '#211A04' },
    teal: { base: '#48C9EF', pressed: '#2DAED4', foreground: '#051D28' },
    gray: { base: '#A8AFB5', pressed: '#8E969D', foreground: '#101315' },
  },
};
