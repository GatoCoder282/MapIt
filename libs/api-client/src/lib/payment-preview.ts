/**
 * Modelos de presentación y fixtures SINTÉTICOS de la demo frontend.
 * No son contrato HTTP ni evidencia de pago/autorización del backend.
 */
export type PreviewPaymentStatus =
  | 'PENDING'
  | 'PENDING_MANUAL_VERIFICATION'
  | 'CONFIRMED'
  | 'FAILED'
  | 'EXPIRED'
  | 'CANCELLED'
  | 'RECONCILIATION_REQUIRED';
export type PreviewReservationStatus =
  'CREATED' | 'CONFIRMED' | 'ACTIVE' | 'CANCELLED' | 'RELEASED';
export type PreviewCheckInState = 'NOT_CHECKED_IN' | 'CHECKED_IN';
export interface PreviewSpace {
  readonly id: string;
  readonly name: string;
  readonly floor: string;
  readonly sector: string;
  readonly state: 'RESERVED' | 'OCCUPIED';
}
export interface PreviewReservation {
  readonly id: string;
  readonly tenantId: string;
  readonly tenantSlug: string;
  readonly establishmentId: string;
  readonly establishmentSlug: string;
  readonly establishmentName: string;
  readonly startsAt: string;
  readonly endsAt: string;
  readonly timeZone: string;
  readonly vertical: 'RESTAURANT' | 'NIGHTCLUB' | 'EVENT_HALL' | 'HOTEL';
  readonly spaces: readonly PreviewSpace[];
  readonly status: PreviewReservationStatus;
}
export interface PreviewPayment {
  readonly reference: string;
  readonly status: PreviewPaymentStatus;
  readonly amountMinor: number;
  readonly totalMinor: number;
  readonly paidMinor: number;
  readonly currency: string;
  readonly fractionDigits: number;
  readonly expiresAt: string;
}
export interface PreviewMethod {
  readonly id: string;
  readonly name: string;
  readonly provider: 'MOCK_GATEWAY' | 'STATIC_BANK_QR';
  readonly verification: 'MANUAL' | 'AUTOMATIC';
  readonly staticQrImage: string | null;
}
export interface PreviewReceipt {
  readonly token: string;
  readonly reservation: PreviewReservation;
  readonly payment: PreviewPayment;
  readonly checkIn: PreviewCheckInState;
  readonly revoked: boolean;
}
export interface PaymentPreviewConfig {
  readonly paymentPreviewEnabled?: boolean;
  readonly environment: string;
}
export function paymentPreviewAllowed(
  config: PaymentPreviewConfig,
  developmentBuild: boolean,
): boolean {
  return (
    developmentBuild &&
    config.paymentPreviewEnabled === true &&
    ['development', 'test'].includes(config.environment)
  );
}
/** Token fijo de fixture pública; deliberadamente sin validez ni secreto en backend. */
export const PREVIEW_RECEIPT_TOKEN = 'rH4L8sQk2Vd9ZxA7pW5nF3cB6jM0uYtE1gKoRiSvN_c';
export const PREVIEW_RESERVATION_ID = '69000000-0000-0000-0000-000000000001';
export const PREVIEW_TENANT_ID = 'demo';
export const PREVIEW_ESTABLISHMENT_ID = '69000000-0000-0000-0000-000000000002';
export const PREVIEW_TENANT_SLUG = 'demo';
export const PREVIEW_ESTABLISHMENT_SLUG = 'la-bahia';
export const PREVIEW_CHECKOUT_PATH =
  '/pago/' + PREVIEW_TENANT_SLUG + '/' + PREVIEW_ESTABLISHMENT_SLUG + '/' + PREVIEW_RESERVATION_ID;
export const PREVIEW_RECEIPT_PATH = '/comprobante/' + PREVIEW_RECEIPT_TOKEN;
export function previewReservation(): PreviewReservation {
  return {
    id: PREVIEW_RESERVATION_ID,
    tenantId: PREVIEW_TENANT_ID,
    tenantSlug: PREVIEW_TENANT_SLUG,
    establishmentId: PREVIEW_ESTABLISHMENT_ID,
    establishmentSlug: PREVIEW_ESTABLISHMENT_SLUG,
    establishmentName: 'La Bahía · Demostración',
    startsAt: '2026-12-24T23:00:00Z',
    endsAt: '2026-12-25T01:00:00Z',
    timeZone: 'America/La_Paz',
    vertical: 'RESTAURANT',
    status: 'CONFIRMED',
    spaces: [
      {
        id: 'demo-table-12',
        name: 'Mesa 12',
        floor: 'Planta baja',
        sector: 'Terraza',
        state: 'RESERVED',
      },
      {
        id: 'demo-table-14',
        name: 'Mesa 14',
        floor: 'Planta baja',
        sector: 'Terraza',
        state: 'RESERVED',
      },
    ],
  };
}
export function previewPayment(status: PreviewPaymentStatus = 'PENDING'): PreviewPayment {
  return {
    reference: 'DEMO-PAY-0001',
    status,
    amountMinor: 12000,
    totalMinor: 40000,
    paidMinor: status === 'CONFIRMED' ? 12000 : 0,
    currency: 'BOB',
    fractionDigits: 2,
    expiresAt: '2026-12-24T22:30:00Z',
  };
}
export function previewReceipt(): PreviewReceipt {
  return {
    token: PREVIEW_RECEIPT_TOKEN,
    reservation: previewReservation(),
    payment: previewPayment('CONFIRMED'),
    checkIn: 'NOT_CHECKED_IN',
    revoked: false,
  };
}
/** Solo extrae; nunca navega a una URL escaneada. Origen/ruta exactos, sin query ni hash. */
export function parsePreviewReceiptToken(value: string, publicOrigin: string): string | null {
  const input = value.trim();
  if (/^[A-Za-z0-9_-]{43}$/.test(input)) return input;
  try {
    const url = new URL(input);
    const expected = new URL(publicOrigin);
    const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
    if (
      url.origin !== expected.origin ||
      (url.protocol !== 'https:' && !(local && url.protocol === 'http:')) ||
      url.username ||
      url.password ||
      url.hash
    )
      return null;
    if (url.search) {
      const keys = [...url.searchParams.keys()];
      const slug = /^[a-z0-9][a-z0-9-]{1,62}$/;
      if (
        keys.length !== 2 ||
        !keys.includes('tenantSlug') ||
        !keys.includes('establishmentSlug') ||
        !slug.test(url.searchParams.get('tenantSlug') ?? '') ||
        !slug.test(url.searchParams.get('establishmentSlug') ?? '')
      )
        return null;
    }
    const match = /^\/comprobante\/([A-Za-z0-9_-]{43})$/.exec(url.pathname);
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}
