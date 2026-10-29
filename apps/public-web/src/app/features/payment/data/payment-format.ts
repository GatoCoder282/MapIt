import type { PreviewPayment, PreviewReservation, ReservationCheckout } from '@mapit/api-client';

export function formatPaymentExpiry(expiresAt: string, timeZone: string): string {
  return new Intl.DateTimeFormat('es-BO', {
    dateStyle: 'medium',
    timeStyle: 'short',
    hourCycle: 'h23',
    timeZone,
  }).format(new Date(expiresAt));
}

export function formatPaymentAmount(
  minor: number,
  payment: Pick<PreviewPayment, 'currency' | 'fractionDigits'>,
): string {
  return new Intl.NumberFormat('es-BO', {
    style: 'currency',
    currency: payment.currency,
    minimumFractionDigits: payment.fractionDigits,
    maximumFractionDigits: payment.fractionDigits,
  }).format(minor / 10 ** payment.fractionDigits);
}

export function formatReservationDate(
  reservation: PreviewReservation | ReservationCheckout,
): string {
  return new Intl.DateTimeFormat('es-BO', {
    dateStyle: 'long',
    timeZone: 'timezone' in reservation ? reservation.timezone : reservation.timeZone,
  }).format(new Date(reservation.startsAt));
}

export function formatReservationTime(
  reservation: PreviewReservation | ReservationCheckout,
): string {
  const formatter = new Intl.DateTimeFormat('es-BO', {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZone: 'timezone' in reservation ? reservation.timezone : reservation.timeZone,
  });
  return formatter.formatRange(new Date(reservation.startsAt), new Date(reservation.endsAt));
}
