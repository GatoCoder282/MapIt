import { describe, expect, it } from 'vitest';
import {
  PREVIEW_RECEIPT_TOKEN,
  paymentPreviewAllowed,
  parsePreviewReceiptToken,
  previewReceipt,
  previewPayment,
} from './payment-preview';
import { projectCheckout } from './payment-presentation';

describe('Payment preview boundaries', () => {
  it('preserves CANCELLED distinctly without presenting paid money', () => {
    const receipt = previewReceipt();
    const payment = previewPayment('CANCELLED');
    const checkout = projectCheckout({ reservation: receipt.reservation, payment, methods: [] });
    expect(checkout.payment?.status).toBe('CANCELLED');
    expect(checkout.paidAmount).toBe('0.00');
    expect(previewPayment('EXPIRED').status).toBe('EXPIRED');
  });
  it('requires explicit opt-in, development build and development/test environment', () => {
    expect(paymentPreviewAllowed({ environment: 'development' }, true)).toBe(false);
    expect(
      paymentPreviewAllowed({ environment: 'development', paymentPreviewEnabled: true }, false),
    ).toBe(false);
    expect(
      paymentPreviewAllowed({ environment: 'production', paymentPreviewEnabled: true }, true),
    ).toBe(false);
    expect(
      paymentPreviewAllowed({ environment: 'development', paymentPreviewEnabled: true }, true),
    ).toBe(true);
    expect(paymentPreviewAllowed({ environment: 'test', paymentPreviewEnabled: true }, true)).toBe(
      true,
    );
  });
  it('only extracts exact receipt URLs from the configured origin or opaque codes', () => {
    const origin = 'https://reservas.mapit.test';
    expect(PREVIEW_RECEIPT_TOKEN).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(parsePreviewReceiptToken(PREVIEW_RECEIPT_TOKEN, origin)).toBe(PREVIEW_RECEIPT_TOKEN);
    expect(parsePreviewReceiptToken(origin + '/comprobante/' + PREVIEW_RECEIPT_TOKEN, origin)).toBe(
      PREVIEW_RECEIPT_TOKEN,
    );
    for (const value of [
      'https://evil.test/comprobante/' + PREVIEW_RECEIPT_TOKEN,
      'https://evil.test@reservas.mapit.test/comprobante/' + PREVIEW_RECEIPT_TOKEN,
      origin + '/comprobante/' + PREVIEW_RECEIPT_TOKEN + '?redirect=https://evil.test',
      origin + '/comprobante/' + PREVIEW_RECEIPT_TOKEN + '#token',
      origin + '/comprobante/%2F' + PREVIEW_RECEIPT_TOKEN,
      'javascript:alert(1)',
      '123456',
    ])
      expect(parsePreviewReceiptToken(value, origin)).toBeNull();
    expect(
      parsePreviewReceiptToken(
        'http://reservas.mapit.test/comprobante/' + PREVIEW_RECEIPT_TOKEN,
        'http://reservas.mapit.test',
      ),
    ).toBeNull();
    expect(
      parsePreviewReceiptToken(
        'http://localhost:4300/comprobante/' + PREVIEW_RECEIPT_TOKEN,
        'http://localhost:4300',
      ),
    ).toBe(PREVIEW_RECEIPT_TOKEN);
  });
  it('returns independent synthetic snapshots rather than shared mutable state', () => {
    const first = previewReceipt();
    const second = previewReceipt();
    expect(first).not.toBe(second);
    expect(first.reservation.spaces).not.toBe(second.reservation.spaces);
    expect(first.payment.status).toBe('CONFIRMED');
    expect(first.payment.paidMinor).toBeLessThan(first.payment.totalMinor);
    expect(first.checkIn).toBe('NOT_CHECKED_IN');
  });
});
