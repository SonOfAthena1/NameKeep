import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import type { Person } from '@/database/types';
import {
  cancelMemoryRemindersForPeople,
  getMemoryReminderPersonId,
  refreshMemoryRemindersForPerson,
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
      data: {
        kind: 'memory-reminder',
        personId: 'person-1',
        reminderAt: createdAt + 24 * 60 * 60 * 1000,
      },
    });
    expect(first.content.body).toBe(
      'You met someone described as: “Met at a conference”\nDo you remember their name? Tap to reveal it.',
    );
    expect(first.trigger).toMatchObject({ channelId: 'memory-reminders' });
    expect(new Date((first.trigger as { date: Date }).date).getTime()).toBe(
      createdAt + 24 * 60 * 60 * 1000,
    );
    expect(new Date((second.trigger as { date: Date }).date).getTime()).toBe(
      createdAt + 7 * 24 * 60 * 60 * 1000,
    );
  });

  test('includes the label and description in the requested wording', async () => {
    await scheduleMemoryReminders(person({ labelId: 'work' }), [1], 'Work');

    expect(notifications.scheduleNotificationAsync.mock.calls[0][0].content.body).toBe(
      'You met someone from Work: “Met at a conference”, can you remember their name?\nTap to reveal it.',
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

  test('refreshes only the edited person at the original delivery time', async () => {
    const reminderAt = Date.now() + 60_000;
    notifications.getAllScheduledNotificationsAsync.mockResolvedValue([
      {
        identifier: 'refresh-me',
        content: {
          body: 'Old details',
          data: { kind: 'memory-reminder', personId: 'person-1', reminderAt },
        },
        trigger: { type: 'date', value: reminderAt },
      },
      {
        identifier: 'keep-person',
        content: {
          data: {
            kind: 'memory-reminder',
            personId: 'person-2',
            reminderAt,
          },
        },
        trigger: { type: 'date', value: reminderAt },
      },
    ] as never);

    await refreshMemoryRemindersForPerson(
      person({ description: 'Updated conference details', labelId: 'work' }),
      'Work',
    );

    expect(notifications.scheduleNotificationAsync).toHaveBeenCalledTimes(1);
    expect(notifications.scheduleNotificationAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        identifier: 'refresh-me',
        content: expect.objectContaining({
          body: 'You met someone from Work: “Updated conference details”, can you remember their name?\nTap to reveal it.',
          data: expect.objectContaining({ reminderAt }),
        }),
        trigger: expect.objectContaining({
          type: 'date',
          date: new Date(reminderAt),
        }),
      }),
    );
  });

  test('refreshes legacy Android and iOS reminder triggers', async () => {
    const now = Date.now();
    const androidReminderAt = now + 60_000;
    notifications.getAllScheduledNotificationsAsync.mockResolvedValue([
      {
        identifier: 'legacy-android',
        content: { data: { kind: 'memory-reminder', personId: 'person-1' } },
        trigger: { type: 'date', value: androidReminderAt },
      },
      {
        identifier: 'legacy-ios',
        content: { data: { kind: 'memory-reminder', personId: 'person-1' } },
        trigger: { type: 'timeInterval', seconds: 120 },
      },
    ] as never);

    await refreshMemoryRemindersForPerson(person({ description: 'Updated' }));

    expect(notifications.scheduleNotificationAsync).toHaveBeenCalledTimes(2);
    expect(notifications.scheduleNotificationAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        identifier: 'legacy-android',
        trigger: expect.objectContaining({ date: new Date(androidReminderAt) }),
      }),
    );
    expect(notifications.scheduleNotificationAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        identifier: 'legacy-ios',
        trigger: expect.objectContaining({
          date: expect.any(Date),
        }),
      }),
    );
    const iosRequest = notifications.scheduleNotificationAsync.mock.calls
      .map(([request]) => request)
      .find((request) => request.identifier === 'legacy-ios');
    expect(
      new Date((iosRequest?.trigger as { date: Date }).date).getTime(),
    ).toBeGreaterThanOrEqual(now + 119_000);
  });

  test('does not refresh expired or unrecognized reminders', async () => {
    notifications.getAllScheduledNotificationsAsync.mockResolvedValue([
      {
        identifier: 'expired',
        content: {
          data: {
            kind: 'memory-reminder',
            personId: 'person-1',
            reminderAt: Date.now() - 1,
          },
        },
        trigger: { type: 'date', value: Date.now() - 1 },
      },
      {
        identifier: 'unknown-trigger',
        content: { data: { kind: 'memory-reminder', personId: 'person-1' } },
        trigger: { type: 'unknown' },
      },
    ] as never);

    await refreshMemoryRemindersForPerson(person());

    expect(notifications.setNotificationChannelAsync).not.toHaveBeenCalled();
    expect(notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
  });

  test('reports a refresh failure without cancelling the original reminder', async () => {
    const reminderAt = Date.now() + 60_000;
    notifications.getAllScheduledNotificationsAsync.mockResolvedValue([
      {
        identifier: 'original-reminder',
        content: {
          data: { kind: 'memory-reminder', personId: 'person-1', reminderAt },
        },
        trigger: { type: 'date', value: reminderAt },
      },
    ] as never);
    notifications.scheduleNotificationAsync.mockRejectedValueOnce(
      new Error('Native scheduler unavailable'),
    );

    await expect(refreshMemoryRemindersForPerson(person())).rejects.toThrow(
      'Native scheduler unavailable',
    );
    expect(notifications.cancelScheduledNotificationAsync).not.toHaveBeenCalled();
  });

  test('does not inspect scheduled reminders on web', async () => {
    setPlatform('web');
    await refreshMemoryRemindersForPerson(person());
    expect(notifications.getAllScheduledNotificationsAsync).not.toHaveBeenCalled();
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
