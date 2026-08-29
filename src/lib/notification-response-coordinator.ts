import type * as Notifications from 'expo-notifications';

import { getMemoryReminderPersonId } from '@/lib/memory-reminders';

type PendingMemoryReminder = {
  identifier: string;
  personId: string;
};

type CoordinatorOptions = {
  navigate: (personId: string) => void;
  clearLastResponse: () => void;
  onError?: (error: unknown) => void;
};

/**
 * Queues memory-reminder taps until startup navigation is ready, then handles
 * every notification request at most once for the lifetime of the app.
 */
export class MemoryReminderNotificationResponseCoordinator {
  private readonly clearLastResponse: () => void;
  private readonly handledIdentifiers = new Set<string>();
  private readonly navigate: (personId: string) => void;
  private readonly onError: (error: unknown) => void;
  private readonly pending: PendingMemoryReminder[] = [];
  private readonly pendingIdentifiers = new Set<string>();
  private isReady = false;

  constructor({ navigate, clearLastResponse, onError }: CoordinatorOptions) {
    this.navigate = navigate;
    this.clearLastResponse = clearLastResponse;
    this.onError = onError ?? (() => undefined);
  }

  /** Captures either a startup response or a response received while running. */
  receive(response: Notifications.NotificationResponse | null | undefined) {
    const personId = getMemoryReminderPersonId(response);
    const identifier = response?.notification.request.identifier;
    if (!personId || !identifier) return;

    if (
      this.handledIdentifiers.has(identifier) ||
      this.pendingIdentifiers.has(identifier)
    ) {
      return;
    }

    this.pending.push({ identifier, personId });
    this.pendingIdentifiers.add(identifier);
    this.drain();
  }

  /** Allows queued responses to navigate only after SQLite and the router exist. */
  setReady(isReady: boolean) {
    this.isReady = isReady;
    this.drain();
  }

  /** Navigates pending responses in order, retaining one if navigation fails. */
  private drain() {
    while (this.isReady && this.pending.length > 0) {
      const next = this.pending[0];

      try {
        this.navigate(next.personId);
      } catch (error) {
        this.onError(error);
        return;
      }

      this.pending.shift();
      this.pendingIdentifiers.delete(next.identifier);
      this.handledIdentifiers.add(next.identifier);

      try {
        this.clearLastResponse();
      } catch (error) {
        // Navigation already succeeded, so do not risk opening the same route twice.
        this.onError(error);
      }
    }
  }
}
