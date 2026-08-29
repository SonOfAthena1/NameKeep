import type * as Notifications from 'expo-notifications';

import { MemoryReminderNotificationResponseCoordinator } from '@/lib/notification-response-coordinator';

jest.mock('expo-notifications', () => ({}));

function response(
  identifier: string,
  personId: string,
  kind = 'memory-reminder',
) {
  return {
    notification: {
      request: {
        identifier,
        content: { data: { kind, personId } },
      },
    },
  } as unknown as Notifications.NotificationResponse;
}

function setup() {
  const navigate = jest.fn();
  const clearLastResponse = jest.fn();
  const onError = jest.fn();
  const coordinator = new MemoryReminderNotificationResponseCoordinator({
    navigate,
    clearLastResponse,
    onError,
  });

  return { coordinator, navigate, clearLastResponse, onError };
}

test('holds a cold-start response until database and navigation are ready', () => {
  const { coordinator, navigate, clearLastResponse } = setup();

  coordinator.receive(response('notification-1', 'person-1'));

  expect(navigate).not.toHaveBeenCalled();
  expect(clearLastResponse).not.toHaveBeenCalled();

  coordinator.setReady(true);

  expect(navigate).toHaveBeenCalledTimes(1);
  expect(navigate).toHaveBeenCalledWith('person-1');
  expect(clearLastResponse).toHaveBeenCalledTimes(1);
});

test('handles a warm response immediately when navigation is ready', () => {
  const { coordinator, navigate, clearLastResponse } = setup();
  coordinator.setReady(true);

  coordinator.receive(response('notification-1', 'person-1'));

  expect(navigate).toHaveBeenCalledWith('person-1');
  expect(clearLastResponse).toHaveBeenCalledTimes(1);
});

test('deduplicates the same response from startup state and the live listener', () => {
  const { coordinator, navigate, clearLastResponse } = setup();
  const notificationResponse = response('notification-1', 'person-1');

  coordinator.receive(notificationResponse);
  coordinator.receive(notificationResponse);
  coordinator.setReady(true);
  coordinator.receive(notificationResponse);

  expect(navigate).toHaveBeenCalledTimes(1);
  expect(clearLastResponse).toHaveBeenCalledTimes(1);
});

test('preserves queued responses across a temporary not-ready state', () => {
  const { coordinator, navigate } = setup();

  coordinator.receive(response('notification-1', 'person-1'));
  coordinator.setReady(false);
  coordinator.setReady(true);

  expect(navigate).toHaveBeenCalledTimes(1);
  expect(navigate).toHaveBeenCalledWith('person-1');
});

test('retains a response for retry when navigation throws', () => {
  const { coordinator, navigate, clearLastResponse, onError } = setup();
  navigate.mockImplementationOnce(() => {
    throw new Error('Router is not ready');
  });
  coordinator.setReady(true);

  coordinator.receive(response('notification-1', 'person-1'));

  expect(navigate).toHaveBeenCalledTimes(1);
  expect(clearLastResponse).not.toHaveBeenCalled();
  expect(onError).toHaveBeenCalledTimes(1);

  coordinator.setReady(true);

  expect(navigate).toHaveBeenCalledTimes(2);
  expect(clearLastResponse).toHaveBeenCalledTimes(1);
});

test('ignores responses that are not NameKeep memory reminders', () => {
  const { coordinator, navigate, clearLastResponse } = setup();
  coordinator.setReady(true);

  coordinator.receive(response('notification-1', 'person-1', 'other'));
  coordinator.receive(null);

  expect(navigate).not.toHaveBeenCalled();
  expect(clearLastResponse).not.toHaveBeenCalled();
});
