const UNNAMED_PERSON_NAMES = [
  'Unnamed',
  'Person',
  'Somebody',
  'Name Here',
  'Blank',
] as const;

/** Picks a friendly placeholder when a person does not have a name yet. */
export function getRandomUnnamedPersonName() {
  return UNNAMED_PERSON_NAMES[
    Math.floor(Math.random() * UNNAMED_PERSON_NAMES.length)
  ];
}

/** Checks whether a name is one of the placeholders used for an unknown name. */
export function isUnnamedPersonName(name: string) {
  return UNNAMED_PERSON_NAMES.includes(
    name.trim() as (typeof UNNAMED_PERSON_NAMES)[number],
  );
}

/** Returns up to two initials from a person's name. */
export function getInitials(name: string) {
  return name
    .split(' ')
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
}
