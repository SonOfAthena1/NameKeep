export type Label = {
  id: string;
  name: string;
  createdAt: number;
};

export type Person = {
  id: string;
  name: string;
  description: string;
  labelId: string;
  createdAt: number;
};
