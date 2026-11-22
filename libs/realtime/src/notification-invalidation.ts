/** Aviso de invalidación, nunca contenido de la bandeja ni un delta del contador. */
export interface NotificationInvalidation {
  readonly eventId: string;
  readonly eventType: 'notification.inbox.invalidated.v1';
  readonly schemaVersion: 1;
  readonly occurredAt: string;
}

/** Vinculación local del socket con la sesión; no es una autorización del servidor. */
export interface NotificationRealtimeSession {
  readonly tenantId: string;
  readonly userId: string;
  readonly sessionId: string;
}

export const NOTIFICATION_USER_DESTINATION = '/user/topic/notifications';
const UUID = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i;

export function sameNotificationSession(
  left: NotificationRealtimeSession | null | undefined,
  right: NotificationRealtimeSession | null | undefined,
): boolean {
  return (
    !!left &&
    !!right &&
    left.tenantId === right.tenantId &&
    left.userId === right.userId &&
    left.sessionId === right.sessionId
  );
}

export function validNotificationSession(value: NotificationRealtimeSession): boolean {
  return (
    /^[a-z0-9][a-z0-9-]{1,62}$/.test(value.tenantId) &&
    UUID.test(value.userId) &&
    UUID.test(value.sessionId)
  );
}

export function parseNotificationInvalidation(body: string): NotificationInvalidation | null {
  if (body.length > 512) return null;
  try {
    const value: unknown = JSON.parse(body);
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const event = value as Partial<NotificationInvalidation>;
    if (
      Object.keys(event).length !== 4 ||
      typeof event.eventId !== 'string' ||
      !UUID.test(event.eventId) ||
      event.eventType !== 'notification.inbox.invalidated.v1' ||
      event.schemaVersion !== 1 ||
      typeof event.occurredAt !== 'string' ||
      !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?Z$/.test(event.occurredAt) ||
      !Number.isFinite(Date.parse(event.occurredAt))
    )
      return null;
    return {
      eventId: event.eventId,
      eventType: event.eventType,
      schemaVersion: 1,
      occurredAt: event.occurredAt,
    };
  } catch {
    return null;
  }
}
