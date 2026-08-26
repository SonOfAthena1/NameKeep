import {
  getInitials,
  getRandomUnnamedPersonName,
  isUnnamedPersonName,
} from '@/lib/names';

describe('name helpers', () => {
  test.each([
    ['Ada Lovelace', 'AL'],
    ['Prince', 'P'],
    ['ada lovelace byron', 'AL'],
    ['', ''],
  ])('gets useful initials for %j', (name, expected) => {
    expect(getInitials(name)).toBe(expected);
  });

  test('recognizes placeholders after trimming', () => {
    expect(isUnnamedPersonName('  Somebody ')).toBe(true);
    expect(isUnnamedPersonName('somebody')).toBe(false);
    expect(isUnnamedPersonName('Ada')).toBe(false);
  });

  test('always returns a recognized placeholder', () => {
    for (let index = 0; index < 50; index += 1) {
      expect(isUnnamedPersonName(getRandomUnnamedPersonName())).toBe(true);
    }
  });
});
