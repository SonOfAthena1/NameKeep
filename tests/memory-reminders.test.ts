import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import type { Person } from '@/database/types';
import {
  cancelMemoryRemindersForPeople,
  getMemoryReminderPersonId,
  requestMemoryReminderPermission,
  scheduleMemoryReminders,
} from '@/lib/memory-reminders';

jest.mock('expo-notifications', () => ({
  AndroidImportance: { DEFAULT: 5 },
  SchedulableTriggerInputTypes: { DATE: 'date' },
  setNotificationChannelAsync: jest.fn().mockResolvedValue(null),
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
  scheduleNotificationAsync: jest.fn().mockResolvedValue('scheduled'),
  getAllScheduledNotificationsAsync: jest.fn(),
  cancelScheduledNotificationAsync: jest.fn().mockResolvedValue(undefined),
}));

const notifications = jest.mocked(Notifications);
const originalPlatform = Platform.OS;
const createdAt = Date.UTC(2026, 0, 1, 12);
const person = (overrides: Partial<Person> = {}): Person => ({
  id: 'person-1',
  name: 'Ada Lovelace',
  description: 'Met at a conference',
  labelId: null,
  createdAt,
  ...overrides,
});

function setPlatform(os: typeof Platform.OS) {
  Object.defineProperty(Platform, 'OS', { configurable: true, value: os });
}

afterAll(() => setPlatform(originalPlatform));

beforeEach(() => {
  jest.clearAllMocks();
  setPlatform('android');
  notifications.setNotificationChannelAsync.mockResolvedValue(null);
  notifications.scheduleNotificationAsync.mockResolvedValue('scheduled');
  notifications.cancelScheduledNotificationAsync.mockResolvedValue();
});

describe('memory reminder permission', () => {
  test('creates the Android channel before checking permission', async () => {
    notifications.getPermissionsAsync.mockResolvedValue({ granted: true } as never);

    await expect(requestMemoryReminderPermission()).resolves.toBe(true);

    expect(notifications.setNotificationChannelAsync).toHaveBeenCalledWith(
      'memory-reminders',
      expect.objectContaining({
        name: 'Memory reminders',
        importance: Notifications.AndroidImportance.DEFAULT,
      }),
    );
    expect(
      notifications.setNotificationChannelAsync.mock.invocationCallOrder[0],
    ).toBeLessThan(notifications.getPermissionsAsync.mock.invocationCallOrder[0]);
    expect(notifications.requestPermissionsAsync).not.toHaveBeenCalled();
  });

  test('returns the result of a new permission request', async () => {
    notifications.getPermissionsAsync.mockResolvedValue({ granted: false } as never);
    notifications.requestPermissionsAsync.mockResolvedValue({ granted: true } as never);
    await expect(requestMemoryReminderPermission()).resolves.toBe(true);
  });

  test('does nothing on web', async () => {
    setPlatform('web');
    await expect(requestMemoryReminderPermission()).resolves.toBe(false);
    expect(notifications.setNotificationChannelAsync).not.toHaveBeenCalled();
    expect(notifications.getPermissionsAsync).not.toHaveBeenCalled();
  });
});

describe('scheduling and cancellation', () => {
  test('schedules each interval on the Android channel', async () => {
    await scheduleMemoryReminders(person(), [1, 7]);

    expect(notifications.scheduleNotificationAsync).toHaveBeenCalledTimes(2);
    const first = notifications.scheduleNotificationAsync.mock.calls[0][0];
    const second = notifications.scheduleNotificationAsync.mock.calls[1][0];
    expect(first.content).toMatchObject({
      title: 'NameKeep memory reminder',
      data: { kind: 'memory-reminder', personId: 'person-1' },
    });
    expect(first.content.body).toContain('Met at a conference');
    expect(first.trigger).toMatchObject({ channelId: 'memory-reminders' });
    expect(new Date((first.trigger as { date: Date }).date).getTime()).toBe(
      createdAt + 24 * 60 * 60 * 1000,
    );
    expect(new Date((second.trigger as { date: Date }).date).getTime()).toBe(
      createdAt + 7 * 24 * 60 * 60 * 1000,
    );
  });

  test('uses a name hint without revealing the full name', async () => {
    await scheduleMemoryReminders(person({ description: '' }), [1]);
    const body = notifications.scheduleNotificationAsync.mock.calls[0][0].content.body;
    expect(body).toContain('started with: A');
    expect(body).not.toContain('Ada Lovelace');
  });

  test('does not treat a placeholder as a real name hint', async () => {
    await scheduleMemoryReminders(person({ name: 'Somebody', description: '' }), [1]);
    const body = notifications.scheduleNotificationAsync.mock.calls[0][0].content.body;
    expect(body).toContain('name and description were not saved');
  });

  test('does not schedule when intervals are empty', async () => {
    await scheduleMemoryReminders(person(), []);
    expect(notifications.setNotificationChannelAsync).not.toHaveBeenCalled();
    expect(notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
  });

  test('cancels only matching NameKeep reminders', async () => {
    notifications.getAllScheduledNotificationsAsync.mockResolvedValue([
      {
        identifier: 'cancel-me',
        content: { data: { kind: 'memory-reminder', personId: 'person-1' } },
      },
      {
        identifier: 'keep-person',
        content: { data: { kind: 'memory-reminder', personId: 'person-2' } },
      },
      {
        identifier: 'keep-other-kind',
        content: { data: { kind: 'other', personId: 'person-1' } },
      },
    ] as never);

    await cancelMemoryRemindersForPeople(['person-1']);

    expect(notifications.cancelScheduledNotificationAsync).toHaveBeenCalledTimes(1);
    expect(notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith(
      'cancel-me',
    );
  });
});

test('extracts only valid memory-reminder person IDs', () => {
  const response = (data: unknown) =>
    ({ notification: { request: { content: { data } } } }) as never;

  expect(
    getMemoryReminderPersonId(
      response({ kind: 'memory-reminder', personId: 'person-1' }),
    ),
  ).toBe('person-1');
  expect(getMemoryReminderPersonId(response({ kind: 'other', personId: 'person-1' }))).toBeNull();
  expect(getMemoryReminderPersonId(null)).toBeNull();
});
