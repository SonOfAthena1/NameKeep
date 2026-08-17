import type { LabelColor } from '@/constants/label-colors';

export type Label = {
  id: string;
  name: string;
  color: LabelColor;
  createdAt: number;
};

export type Person = {
  id: string;
  name: string;
  description: string;
  labelId: string | null;
  createdAt: number;
};
