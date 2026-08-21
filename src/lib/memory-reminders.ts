import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import type { MemoryReminderInterval, Person } from '@/database/types';

const DAY_IN_MILLISECONDS = 24 * 60 * 60 * 1000;
const MEMORY_REMINDER_KIND = 'memory-reminder';

type MemoryReminderData = {
  kind: typeof MEMORY_REMINDER_KIND;
  personId: string;
};

function isMemoryReminderData(value: unknown): value is MemoryReminderData {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as Partial<MemoryReminderData>).kind === MEMORY_REMINDER_KIND &&
    typeof (value as Partial<MemoryReminderData>).personId === 'string'
  );
}

function notificationsAreAvailable() {
  return Platform.OS !== 'web';
}

export async function requestMemoryReminderPermission(): Promise<boolean> {
  if (!notificationsAreAvailable()) return false;

  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;

  const requested = await Notifications.requestPermissionsAsync();
  return requested.granted;
}

export async function scheduleMemoryReminders(
  person: Person,
  intervals: MemoryReminderInterval[],
): Promise<void> {
  if (!notificationsAreAvailable() || intervals.length === 0) return;

  await Promise.all(
    intervals.map((interval) =>
      Notifications.scheduleNotificationAsync({
        content: {
          title: 'NameKeep memory reminder',
          body: `You met someone described as: “${person.description || 'No description saved.'}”\nDo you remember their name? Tap to reveal it.`,
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

export function getMemoryReminderPersonId(
  response: Notifications.NotificationResponse | null | undefined,
): string | null {
  const data = response?.notification.request.content.data;
  return isMemoryReminderData(data) ? data.personId : null;
}
