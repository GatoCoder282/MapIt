import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  PREVIEW_ESTABLISHMENT_SLUG,
  PREVIEW_RECEIPT_TOKEN,
  PREVIEW_RESERVATION_ID,
  PREVIEW_TENANT_SLUG,
} from '@mapit/api-client';
import { firstValueFrom } from 'rxjs';

import { PublicRuntimeConfig } from '../../../core/runtime-config';
import { PaymentPreviewApi } from './payment-preview-api';

describe('PaymentPreviewApi', () => {
  const scope = {
    tenantSlug: PREVIEW_TENANT_SLUG,
    establishmentSlug: PREVIEW_ESTABLISHMENT_SLUG,
    reservationId: PREVIEW_RESERVATION_ID,
  };
  const config = signal({ environment: 'development', paymentPreviewEnabled: true });
  let api: PaymentPreviewApi;
  beforeEach(() => {
    vi.useFakeTimers();
    config.set({ environment: 'development', paymentPreviewEnabled: true });
    TestBed.configureTestingModule({
      providers: [{ provide: PublicRuntimeConfig, useValue: { config } }],
    });
    api = TestBed.inject(PaymentPreviewApi);
  });
  afterEach(() => {
    TestBed.resetTestingModule();
    vi.useRealTimers();
  });

  it('habilita solo scope sintético exacto y nunca entrega QR bancario inventado', async () => {
    const pending = firstValueFrom(api.checkout(scope, 'PENDING'));
    await vi.advanceTimersByTimeAsync(240);
    const result = await pending;
    expect(result.reservation.id).toBe(PREVIEW_RESERVATION_ID);
    expect(result.reservation.status).toBe('CREATED');
    expect(result.payment.paidMinor).toBe(0);
    expect(result.methods.find((m) => m.provider === 'STATIC_BANK_QR')?.staticQrImage).toBeNull();
    for (const invalid of [
      { ...scope, tenantSlug: 'other' },
      { ...scope, establishmentSlug: 'other' },
      { ...scope, reservationId: 'other' },
    ]) {
      await expect(firstValueFrom(api.checkout(invalid, 'CONFIRMED'))).rejects.toMatchObject({
        kind: 'not-found',
      });
    }
    await expect(firstValueFrom(api.receipt(PREVIEW_RECEIPT_TOKEN + 'x'))).rejects.toMatchObject({
      kind: 'not-found',
    });
  });

  it('no usa fixtures en producción ni cuando el opt-in está deshabilitado', async () => {
    for (const disabled of [
      { environment: 'production', paymentPreviewEnabled: true },
      { environment: 'development', paymentPreviewEnabled: false },
      { environment: 'staging', paymentPreviewEnabled: true },
    ]) {
      config.set(disabled);
      expect(api.allowed()).toBe(false);
      await expect(firstValueFrom(api.checkout(scope, 'CONFIRMED'))).rejects.toMatchObject({
        kind: 'unavailable',
      });
      await expect(firstValueFrom(api.receipt(PREVIEW_RECEIPT_TOKEN))).rejects.toMatchObject({
        kind: 'unavailable',
      });
    }
  });
});
