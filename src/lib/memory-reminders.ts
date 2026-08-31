import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import type { MemoryReminderInterval, Person } from '@/database/types';
import { isUnnamedPersonName } from '@/lib/names';

const DAY_IN_MILLISECONDS = 24 * 60 * 60 * 1000;
const MEMORY_REMINDER_KIND = 'memory-reminder';
const MEMORY_REMINDER_CHANNEL_ID = 'memory-reminders';

type MemoryReminderData = {
  kind: typeof MEMORY_REMINDER_KIND;
  personId: string;
  reminderAt?: number;
};

/** Checks whether notification data belongs to one of this app's reminders. */
function isMemoryReminderData(value: unknown): value is MemoryReminderData {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as Partial<MemoryReminderData>).kind === MEMORY_REMINDER_KIND &&
    typeof (value as Partial<MemoryReminderData>).personId === 'string'
  );
}

/** Checks whether this device can schedule notifications. */
function notificationsAreAvailable() {
  return Platform.OS !== 'web';
}

/** Creates the Android channel before permission is requested or reminders are scheduled. */
async function ensureMemoryReminderChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;

  await Notifications.setNotificationChannelAsync(
    MEMORY_REMINDER_CHANNEL_ID,
    {
      name: 'Memory reminders',
      description: 'Reminders that help you practice remembering people’s names.',
      importance: Notifications.AndroidImportance.DEFAULT,
    },
  );
}

/** Creates a quiz prompt without revealing a placeholder name as though it were real. */
function getReminderBody(person: Person) {
  const description = person.description.trim();
  if (description) {
    return `You met someone described as: “${description}”\nDo you remember their name? Tap to reveal it.`;
  }

  const name = person.name.trim();
  if (name && !isUnnamedPersonName(name)) {
    const initial = Array.from(name)[0]?.toUpperCase();
    return `You met someone recently whose name started with: ${initial}. Do you remember their name? Tap to reveal it.`;
  }

  return 'You met someone recently, but their name and description were not saved. Tap to reveal it.';
}

/** Builds the content shared by newly scheduled and refreshed reminders. */
function getReminderContent(person: Person, reminderAt: number) {
  return {
    title: 'NameKeep memory reminder',
    body: getReminderBody(person),
    data: {
      kind: MEMORY_REMINDER_KIND,
      personId: person.id,
      reminderAt,
    },
  };
}

/** Reads a pending reminder's delivery time, including requests from older builds. */
function getReminderAt(
  notification: Notifications.NotificationRequest,
  now: number,
): number | null {
  const data = notification.content.data;
  if (
    isMemoryReminderData(data) &&
    typeof data.reminderAt === 'number' &&
    Number.isFinite(data.reminderAt)
  ) {
    return data.reminderAt;
  }

  const trigger = notification.trigger as unknown as Record<string, unknown> | null;
  if (!trigger) return null;

  if (trigger.type === 'timeInterval' && typeof trigger.seconds === 'number') {
    return now + trigger.seconds * 1_000;
  }

  if (trigger.type !== 'date') return null;
  const value = trigger.date ?? trigger.value ?? trigger.timestamp;
  const timestamp = value instanceof Date ? value.getTime() : value;
  if (typeof timestamp !== 'number' || !Number.isFinite(timestamp)) return null;

  // Native trigger payloads have historically used both seconds and milliseconds.
  return timestamp < 100_000_000_000 ? timestamp * 1_000 : timestamp;
}

/** Asks for notification access when the device has not granted it yet. */
export async function requestMemoryReminderPermission(): Promise<boolean> {
  if (!notificationsAreAvailable()) return false;

  await ensureMemoryReminderChannel();

  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;

  const requested = await Notifications.requestPermissionsAsync();
  return requested.granted;
}

/** Schedules one reminder for every chosen interval after a person is saved. */
export async function scheduleMemoryReminders(
  person: Person,
  intervals: MemoryReminderInterval[],
): Promise<void> {
  if (!notificationsAreAvailable() || intervals.length === 0) {
    return;
  }

  await ensureMemoryReminderChannel();

  await Promise.all(
    intervals.map((interval) => {
      const reminderAt = person.createdAt + interval * DAY_IN_MILLISECONDS;
      return Notifications.scheduleNotificationAsync({
        content: getReminderContent(person, reminderAt),
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: new Date(reminderAt),
          channelId:
            Platform.OS === 'android'
              ? MEMORY_REMINDER_CHANNEL_ID
              : undefined,
        },
      });
    }),
  );
}

/** Replaces a person's pending reminders with updated text at the same times. */
export async function refreshMemoryRemindersForPerson(
  person: Person,
): Promise<void> {
  if (!notificationsAreAvailable()) return;

  const now = Date.now();
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  const reminders = scheduled.flatMap((notification) => {
    const data = notification.content.data;
    if (!isMemoryReminderData(data) || data.personId !== person.id) return [];

    const reminderAt = getReminderAt(notification, now);
    return reminderAt !== null && reminderAt > now
      ? [{ identifier: notification.identifier, reminderAt }]
      : [];
  });
  if (reminders.length === 0) return;

  await ensureMemoryReminderChannel();
  await Promise.all(
    reminders.map(({ identifier, reminderAt }) =>
      Notifications.scheduleNotificationAsync({
        identifier,
        content: getReminderContent(person, reminderAt),
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: new Date(reminderAt),
          channelId:
            Platform.OS === 'android'
              ? MEMORY_REMINDER_CHANNEL_ID
              : undefined,
        },
      }),
    ),
  );
}

/** Cancels every scheduled memory reminder for the given people. */
export async function cancelMemoryRemindersForPeople(
  personIds: string[],
): Promise<void> {
  if (!notificationsAreAvailable() || personIds.length === 0) return;

  const ids = new Set(personIds);
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    scheduled
      .filter((notification) => {
        const data = notification.content.data;
        return isMemoryReminderData(data) && ids.has(data.personId);
      })
      .map((notification) =>
        Notifications.cancelScheduledNotificationAsync(notification.identifier),
      ),
  );
}

/** Gets the person ID from a memory-reminder notification tap. */
export function getMemoryReminderPersonId(
  response: Notifications.NotificationResponse | null | undefined,
): string | null {
  const data = response?.notification.request.content.data;
  return isMemoryReminderData(data) ? data.personId : null;
}
