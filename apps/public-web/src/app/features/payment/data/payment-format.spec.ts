import { TestBed } from '@angular/core/testing';
import { previewReservation } from '@mapit/api-client';
import { I18nService, currentLocaleTag, provideI18n } from '@mapit/i18n';
import { afterEach, beforeEach } from 'vitest';

import {
  formatPaymentAmount,
  formatReservationDate,
  formatReservationTime,
} from './payment-format';

describe('payment presentation', () => {
  let i18n: I18nService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [provideI18n()] });
    i18n = TestBed.inject(I18nService);
    i18n.initialize();
  });

  afterEach(() => {
    localStorage.clear();
    TestBed.resetTestingModule();
  });

  it('usa la unidad menor declarada en JPY, BOB y KWD', () => {
    expect(formatPaymentAmount(120, { currency: 'JPY', fractionDigits: 0 })).toContain('120');
    expect(formatPaymentAmount(12000, { currency: 'BOB', fractionDigits: 2 })).toContain('120');
    const expected = new Intl.NumberFormat(currentLocaleTag(), {
      style: 'currency',
      currency: 'KWD',
      minimumFractionDigits: 3,
      maximumFractionDigits: 3,
    }).format(12.345);
    expect(formatPaymentAmount(12345, { currency: 'KWD', fractionDigits: 3 })).toBe(expected);
  });

  it('interpreta la fecha y horario en la zona del establecimiento', () => {
    expect(formatReservationDate(previewReservation())).toContain('24');
    expect(formatReservationTime(previewReservation())).toContain('19:00');
  });

  it('cambia los formatos de fecha y moneda con el idioma de interfaz', () => {
    const spanishAmount = formatPaymentAmount(12000, { currency: 'BOB', fractionDigits: 2 });
    const spanishDate = formatReservationDate(previewReservation());

    i18n.setLanguage('ja-JP');

    expect(formatPaymentAmount(12000, { currency: 'BOB', fractionDigits: 2 })).not.toBe(
      spanishAmount,
    );
    expect(formatReservationDate(previewReservation())).not.toBe(spanishDate);
  });
});
