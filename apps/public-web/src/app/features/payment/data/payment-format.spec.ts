import { previewReservation } from '@mapit/api-client';

import {
  formatPaymentAmount,
  formatReservationDate,
  formatReservationTime,
} from './payment-format';

describe('payment presentation', () => {
  it('usa la unidad menor declarada en JPY, BOB y KWD', () => {
    expect(formatPaymentAmount(120, { currency: 'JPY', fractionDigits: 0 })).toContain('120');
    expect(formatPaymentAmount(12000, { currency: 'BOB', fractionDigits: 2 })).toContain('120');
    const expected = new Intl.NumberFormat('es-BO', {
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
});
