import {
  formatDecimalMoney,
  type PreviewPayment,
  type PreviewReservation,
  type ReservationCheckout,
} from '@mapit/api-client';
import { currentLocaleTag } from '@mapit/i18n';

export function formatPaymentMoney(value: string, currency: string): string {
  return formatDecimalMoney(value, currency, currentLocaleTag());
}

export function formatPaymentExpiry(expiresAt: string, timeZone: string): string {
  return new Intl.DateTimeFormat(currentLocaleTag(), {
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
  return new Intl.NumberFormat(currentLocaleTag(), {
    style: 'currency',
    currency: payment.currency,
    minimumFractionDigits: payment.fractionDigits,
    maximumFractionDigits: payment.fractionDigits,
  }).format(minor / 10 ** payment.fractionDigits);
}

export function formatReservationDate(
  reservation: PreviewReservation | ReservationCheckout,
): string {
  return new Intl.DateTimeFormat(currentLocaleTag(), {
    dateStyle: 'long',
    timeZone: 'timezone' in reservation ? reservation.timezone : reservation.timeZone,
  }).format(new Date(reservation.startsAt));
}

export function formatReservationTime(
  reservation: PreviewReservation | ReservationCheckout,
  arrivalOnly = false,
): string {
  const formatter = new Intl.DateTimeFormat(currentLocaleTag(), {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZone: 'timezone' in reservation ? reservation.timezone : reservation.timeZone,
  });
  const start = new Date(reservation.startsAt);
  return arrivalOnly
    ? formatter.format(start)
    : formatter.formatRange(start, new Date(reservation.endsAt));
}
