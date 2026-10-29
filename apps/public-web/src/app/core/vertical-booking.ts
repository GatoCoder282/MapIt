import type { VerticalProfile } from '@mapit/api-client';
import { STRINGS } from './strings';

export type VerticalTerms = (typeof STRINGS.verticals)[keyof typeof STRINGS.verticals];

/**
 * Textos de la vertical (HU-7.01/7.02). Sin perfil todavía se usan los de restaurante, que
 * son los genéricos de fecha y horas que el portal tenía antes.
 */
export function verticalTerms(profile: VerticalProfile | null): VerticalTerms {
  return STRINGS.verticals[profile?.establishmentType ?? 'RESTAURANT'];
}

/** Rellena `{hours}`, `{start}`, `{end}`, `{min}`, `{max}` con los límites reales del perfil. */
export function fillVerticalText(template: string, profile: VerticalProfile | null): string {
  if (!profile) return template;
  return template
    .replace('{hours}', String((profile.maxDurationMinutes ?? 0) / 60))
    .replace('{start}', profile.defaultStartTime ?? '')
    .replace('{end}', profile.defaultEndTime ?? '')
    .replace('{min}', String(profile.minNights ?? ''))
    .replace('{max}', String(profile.maxNights ?? ''));
}

const DAY_MS = 86_400_000;

function day(value: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parsed = new Date(value + 'T12:00:00Z');
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
    ? Date.UTC(+value.slice(0, 4), +value.slice(5, 7) - 1, +value.slice(8, 10))
    : null;
}

function minutes(value: string): number | null {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value);
  return match ? +match[1]! * 60 + +match[2]! : null;
}

/** Día local siguiente a `date` (YYYY-MM-DD), sin depender de la zona del navegador. */
export function nextDay(date: string): string {
  const start = day(date);
  return start === null ? '' : new Date(start + DAY_MS).toISOString().slice(0, 10);
}

/**
 * Comprueba en el navegador la misma ventana que valida el backend (`BookingWindow`), para no
 * enviar una búsqueda que solo puede volver con 400. El backend sigue siendo quien decide.
 *
 * - Estadía: `endDate` obligatorio y entre `minNights` y `maxNights` noches.
 * - Por horas: sin `endDate`, el fin es ese día o, si la vertical admite noches y
 *   `end ≤ start`, el siguiente; duración positiva y dentro de `maxDurationMinutes`.
 * - Sin perfil (aún cargando) se acepta el intervalo del mismo día, como antes, o uno con
 *   `endDate` explícito; el mapa trae después el perfil y el backend decide.
 */
export function validVerticalInterval(
  profile: VerticalProfile | null,
  date: string,
  start: string,
  end: string,
  endDate = '',
): boolean {
  const startDay = day(date);
  const startMinutes = minutes(start);
  const endMinutes = minutes(end);
  if (startDay === null || startMinutes === null || endMinutes === null) return false;
  if (profile?.bookingMode === 'STAY') {
    const endDay = day(endDate);
    if (endDay === null) return false;
    const nights = Math.round((endDay - startDay) / DAY_MS);
    return nights >= (profile.minNights ?? 1) && nights <= (profile.maxNights ?? nights);
  }
  let endDay = endDate ? day(endDate) : startDay;
  if (endDay === null) return false;
  if (!endDate && endMinutes <= startMinutes) {
    if (!profile?.allowsOvernight) return false;
    endDay = startDay + DAY_MS;
  }
  const duration = (endDay - startDay) / 60_000 + endMinutes - startMinutes;
  if (duration <= 0) return false;
  // Sin perfil: el mismo día, o una fecha de fin explícita que llega de un enlace (hotel).
  if (!profile) return Boolean(endDate) || endDay === startDay;
  if (!profile.allowsOvernight && endDay !== startDay && !(endMinutes === 0 && duration <= 1440))
    return false;
  return profile.maxDurationMinutes === null || duration <= profile.maxDurationMinutes;
}
