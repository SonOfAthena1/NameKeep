import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import type { MemoryReminderInterval, Person } from '@/database/types';
import { isUnnamedPersonName } from '@/lib/names';

const DAY_IN_MILLISECONDS = 24 * 60 * 60 * 1000;
const MEMORY_REMINDER_KIND = 'memory-reminder';

type MemoryReminderData = {
  kind: typeof MEMORY_REMINDER_KIND;
  personId: string;
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

/** Asks for notification access when the device has not granted it yet. */
export async function requestMemoryReminderPermission(): Promise<boolean> {
  if (!notificationsAreAvailable()) return false;

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

  await Promise.all(
    intervals.map((interval) =>
      Notifications.scheduleNotificationAsync({
        content: {
          title: 'NameKeep memory reminder',
          body: getReminderBody(person),
          data: { kind: MEMORY_REMINDER_KIND, personId: person.id },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: new Date(person.createdAt + interval * DAY_IN_MILLISECONDS),
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
