import type { AuditLogEntry } from '@mapit/api-client';
import type { SessionUser } from '@mapit/auth';

import { STRINGS } from '../../../core/strings';

const CHANGES = new Map(
  ['previousState', 'previousStatus', 'newState', 'newStatus', 'initialStatus', 'status'].map(
    (key, index) => [key, index] as const,
  ),
);

function abbreviation(id: string): string {
  return `${id.slice(0, 8)}…${id.slice(-4)}`;
}

function label(labels: Readonly<Record<string, string>>, key: string): string {
  const match = labels[key];
  return typeof match === 'string' ? match : key;
}

export function auditEntryView(entry: AuditLogEntry, user: SessionUser | null) {
  const strings = STRINGS.audit;
  const stateLabels =
    entry.resourceType === 'SPACE_ELEMENT'
      ? STRINGS.spaces.elements.states
      : STRINGS.checkIn.reservationStates;
  const detail = (key: string, value: string) => ({
    key,
    label: label(strings.detailLabels, key),
    value: CHANGES.has(key) ? label(stateLabels, value) : value,
    state: CHANGES.has(key) ? value : null,
  });
  const details = Object.entries(entry.details).map(([key, value]) => detail(key, value));
  const previous = entry.details['previousState'] ?? entry.details['previousStatus'];
  const next =
    entry.details['newState'] ??
    entry.details['newStatus'] ??
    entry.details['status'] ??
    entry.details['initialStatus'];

  return {
    entry,
    action: strings.eventLabels[entry.eventType],
    resource: `${strings.resourceLabels[entry.resourceType]} · ${abbreviation(entry.resourceId)}`,
    actor: user?.id === entry.actorId ? user.fullName : abbreviation(entry.actorId),
    change:
      previous && next
        ? `${label(stateLabels, previous)} → ${label(stateLabels, next)}`
        : next
          ? label(stateLabels, next)
          : strings.noChange,
    details: details
      .filter((item) => !item.key.endsWith('Id'))
      .sort((a, b) => (CHANGES.get(a.key) ?? CHANGES.size) - (CHANGES.get(b.key) ?? CHANGES.size)),
    identifiers: [
      { key: 'id', label: strings.eventId, value: entry.id },
      { key: 'resourceId', label: strings.resourceId, value: entry.resourceId },
      { key: 'actorId', label: strings.actorId, value: entry.actorId },
      ...details
        .filter((item) => item.key.endsWith('Id'))
        .map((item) => ({ ...item, key: `detail-${item.key}` })),
    ],
  };
}
