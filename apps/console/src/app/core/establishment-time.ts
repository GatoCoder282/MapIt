/** Format an instant for a datetime-local field in the establishment's timezone. */
export function establishmentWallTime(value: string, timezone: string): string | null {
  if (!value || !timezone) return null;
  try {
    const parts = Object.fromEntries(
      new Intl.DateTimeFormat('en-CA', {
        timeZone: timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
      })
        .formatToParts(new Date(value))
        .map(({ type, value }) => [type, value]),
    );
    return `${parts['year']}-${parts['month']}-${parts['day']}T${parts['hour']}:${parts['minute']}`;
  } catch {
    return null;
  }
}

/** Reject invalid local times, including times skipped when the clocks advance. */
export function establishmentInstant(value: string, timezone: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null;
  const wallTime = Date.parse(`${value}Z`);
  if (!Number.isFinite(wallTime)) return null;

  let instant = wallTime;
  for (let iteration = 0; iteration < 3; iteration++) {
    const iso = new Date(instant).toISOString();
    const observed = establishmentWallTime(iso, timezone);
    if (observed === value) return iso;
    if (!observed) return null;
    instant += wallTime - Date.parse(`${observed}Z`);
  }
  return null;
}
