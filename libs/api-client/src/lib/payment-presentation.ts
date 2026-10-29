import type {
  PaymentAttempt,
  PaymentReceipt,
  PreviewPayment,
  PreviewReceipt,
  PreviewReservation,
  PublicCheckout,
  ReservationCheckout,
} from '../index';
import type { PreviewMethod } from './payment-preview';
interface CheckoutPreview {
  readonly reservation: PreviewReservation;
  readonly payment: PreviewPayment;
  readonly methods: readonly PreviewMethod[];
}

/** Solo transforma fixtures; los importes reales ya llegan como strings exactos. */
function fixtureAmount(minor: number, digits: number): string {
  const text = minor.toString().padStart(digits + 1, '0');
  return digits === 0 ? text : text.slice(0, -digits) + '.' + text.slice(-digits);
}
function fixtureReservation(value: PreviewReservation): ReservationCheckout {
  return {
    id: value.id,
    establishmentId: value.establishmentId,
    establishmentName: value.establishmentName,
    tenantSlug: value.tenantSlug,
    establishmentSlug: value.establishmentSlug,
    startsAt: value.startsAt,
    endsAt: value.endsAt,
    timezone: value.timeZone,
    status: value.status,
    spaces: value.spaces.map((space) => ({ ...space })),
  };
}
function fixturePayment(value: PreviewPayment): PaymentAttempt {
  return {
    id: value.reference,
    externalReference: value.reference,
    status: value.status,
    provider: 'MOCK_GATEWAY',
    amount: fixtureAmount(value.amountMinor, value.fractionDigits),
    currency: value.currency,
    paidAmount: fixtureAmount(value.paidMinor, value.fractionDigits),
    totalAmount: fixtureAmount(value.totalMinor, value.fractionDigits),
    expiresAt: value.expiresAt,
  };
}
export function projectCheckout(value: CheckoutPreview): PublicCheckout {
  const payment = fixturePayment(value.payment);
  return {
    reservation: fixtureReservation(value.reservation),
    available: true,
    unavailableReason: null,
    currency: payment.currency,
    amount: payment.amount,
    totalAmount: payment.totalAmount,
    paidAmount: payment.paidAmount,
    balanceAmount: fixtureAmount(
      value.payment.totalMinor - value.payment.paidMinor,
      value.payment.fractionDigits,
    ),
    payment,
    historicalMethod: null,
    methods: value.methods.map((method) => ({
      id: method.id,
      displayName: method.name,
      provider: method.provider,
      verification: method.verification,
      staticQrImage: method.staticQrImage,
      simulationPath: null,
    })),
  };
}
export function projectReceipt(value: PreviewReceipt): PaymentReceipt {
  return {
    token: value.token,
    reservation: fixtureReservation(value.reservation),
    payment: fixturePayment(value.payment),
    currency: value.payment.currency,
    paidAmount: fixtureAmount(value.payment.paidMinor, value.payment.fractionDigits),
    totalAmount: fixtureAmount(value.payment.totalMinor, value.payment.fractionDigits),
    balanceAmount: fixtureAmount(
      value.payment.totalMinor - value.payment.paidMinor,
      value.payment.fractionDigits,
    ),
    checkIn: value.checkIn,
    expiresAt: value.payment.expiresAt,
  };
}
