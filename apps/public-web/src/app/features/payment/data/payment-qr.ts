import { Injectable } from '@angular/core';
import { PREVIEW_CHECKOUT_PATH, PREVIEW_RECEIPT_PATH } from '@mapit/api-client';

const UUID_PATTERN = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
const UUID = new RegExp('^' + UUID_PATTERN + '$', 'i');
const SLUG_PATTERN = '[a-z0-9][a-z0-9-]{1,62}';
const SLUG = new RegExp('^' + SLUG_PATTERN + '$');
const CAPABILITY = /^[A-Za-z0-9_-]{43}$/;
const SIMULATION_PATH = new RegExp('^/simulacion/qr/' + UUID_PATTERN + '$', 'i');
const ATTEMPT_KEYS = ['establecimiento', 'pago', 'reserva', 'tenant'];

export interface AttemptLink {
  readonly tenantSlug: string;
  readonly establishmentSlug: string;
  readonly reservationId: string;
  readonly paymentId: string;
  readonly capability: string;
}

/**
 * URL exacta del QR de un intento: simulationPath, scope y pago en query;
 * la capability de reserva viaja solo en el fragmento, nunca como credencial
 * de query ni JWT. Devuelve null ante cualquier dato inválido.
 */
export function attemptUrl(
  origin: string,
  simulationPath: string,
  attempt: Omit<AttemptLink, 'capability'>,
  capability: string,
): string | null {
  if (!SIMULATION_PATH.test(simulationPath) || !UUID.test(attempt.paymentId)) return null;
  if (!UUID.test(attempt.reservationId) || !CAPABILITY.test(capability)) return null;
  if (![attempt.tenantSlug, attempt.establishmentSlug].every((slug) => SLUG.test(slug)))
    return null;
  try {
    const url = new URL(simulationPath, origin);
    if (url.username || url.password) return null;
    url.search = new URLSearchParams({
      tenant: attempt.tenantSlug,
      establecimiento: attempt.establishmentSlug,
      reserva: attempt.reservationId,
      pago: attempt.paymentId,
    }).toString();
    url.hash = 'access=' + capability;
    return url.href;
  } catch {
    return null;
  }
}

/** Valida localmente un enlace de intento entrante (QR escaneado). Sin llamadas. */
export function parseAttempt(
  token: string,
  query: URLSearchParams,
  fragment: string | null,
): AttemptLink | null {
  if (!UUID.test(token)) return null;
  if ([...query.keys()].sort().join() !== ATTEMPT_KEYS.join()) return null;
  const paymentId = query.get('pago');
  const reservationId = query.get('reserva');
  const tenantSlug = query.get('tenant');
  const establishmentSlug = query.get('establecimiento');
  if (!UUID.test(paymentId ?? '') || !UUID.test(reservationId ?? '')) return null;
  if (!SLUG.test(tenantSlug ?? '') || !SLUG.test(establishmentSlug ?? '')) return null;
  const values = new URLSearchParams(fragment?.replace(/^#/, '') ?? '');
  const capability = values.get('access');
  if (!capability || !CAPABILITY.test(capability) || [...values.keys()].length !== 1) return null;
  return {
    tenantSlug: tenantSlug!,
    establishmentSlug: establishmentSlug!,
    reservationId: reservationId!,
    paymentId: paymentId!,
    capability,
  };
}

/** Codifica solo checkout/comprobantes/intentos internos; nunca inventa un QR bancario. */
@Injectable({ providedIn: 'root' })
export class PaymentQr {
  async render(path: string, origin: string): Promise<string> {
    const base = new URL(origin);
    const local = ['localhost', '127.0.0.1', '[::1]'].includes(base.hostname);
    if (
      (base.protocol !== 'https:' && !(base.protocol === 'http:' && local)) ||
      base.username ||
      base.password ||
      base.search ||
      base.hash ||
      !path.startsWith('/') ||
      path.startsWith('//')
    ) {
      throw new Error('invalid-qr-target');
    }
    const url = new URL(path, base.origin);
    const checkout = new RegExp(
      '^/pago/' + SLUG_PATTERN + '/' + SLUG_PATTERN + '/[0-9a-fA-F-]{36}$',
    ).test(url.pathname);
    const receipt = /^\/comprobante\/[A-Za-z0-9_-]{43}$/.test(url.pathname);
    const fragment = new URLSearchParams(url.hash.slice(1));
    const keys = [...url.searchParams.keys()];
    const validReceipt =
      receipt &&
      !url.hash &&
      ((keys.length === 0 && path === PREVIEW_RECEIPT_PATH) ||
        (keys.length === 2 &&
          keys.includes('tenantSlug') &&
          keys.includes('establishmentSlug') &&
          SLUG.test(url.searchParams.get('tenantSlug') ?? '') &&
          SLUG.test(url.searchParams.get('establishmentSlug') ?? '')));
    const validCheckout =
      checkout &&
      !url.search &&
      (path === PREVIEW_CHECKOUT_PATH ||
        ([...fragment.keys()].length === 1 && CAPABILITY.test(fragment.get('access') ?? '')));
    if (
      url.origin !== base.origin ||
      url.username ||
      url.password ||
      (!validReceipt && !validCheckout)
    )
      throw new Error('invalid-qr-target');
    return this.encode(url.href);
  }

  /** QR del intento: destino exacto de parseAttempt, sin datos de cuenta ni query de credencial. */
  async renderAttempt(attempt: string): Promise<string> {
    const url = new URL(attempt);
    const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
    if (
      (url.protocol !== 'https:' && !(url.protocol === 'http:' && local)) ||
      url.username ||
      url.password ||
      !SIMULATION_PATH.test(url.pathname) ||
      !parseAttempt(url.pathname.slice('/simulacion/qr/'.length), url.searchParams, url.hash)
    )
      throw new Error('invalid-qr-target');
    return this.encode(url.href);
  }

  private async encode(href: string): Promise<string> {
    const imported = await import('qrcode');
    // Vite/esbuild exponen CommonJS en default; los tests también admiten exports nombrados.
    const qr = imported.default ?? imported;
    return qr.toDataURL(href, {
      width: 256,
      margin: 3,
      errorCorrectionLevel: 'M',
      color: { dark: '#0f172a', light: '#ffffff' },
    });
  }
}
