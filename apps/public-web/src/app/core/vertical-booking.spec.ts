import { verticalProfileFixture } from './public-map.fixture';
import {
  fillVerticalText,
  nextDay,
  validVerticalInterval,
  verticalTerms,
} from './vertical-booking';

describe('vertical-booking (HU-7.01/7.02 · MAP-234)', () => {
  const restaurant = verticalProfileFixture('RESTAURANT');
  const nightclub = verticalProfileFixture('NIGHTCLUB');
  const hall = verticalProfileFixture('EVENT_HALL');
  const hotel = verticalProfileFixture('HOTEL');

  it('restaurante: turno del mismo día hasta 6 h', () => {
    expect(validVerticalInterval(restaurant, '2030-11-02', '19:00', '21:30')).toBe(true);
    expect(validVerticalInterval(restaurant, '2030-11-02', '10:00', '17:00')).toBe(false);
    expect(validVerticalInterval(restaurant, '2030-11-02', '22:00', '01:00')).toBe(false);
  });

  it('discoteca: la salida de madrugada es el día siguiente, hasta 12 h', () => {
    expect(validVerticalInterval(nightclub, '2030-11-06', '23:00', '04:00')).toBe(true);
    expect(validVerticalInterval(nightclub, '2030-11-06', '18:00', '07:00')).toBe(false);
  });

  it('salón: el evento puede cruzar la medianoche hasta 24 h', () => {
    expect(validVerticalInterval(hall, '2030-11-07', '18:00', '02:00')).toBe(true);
    expect(validVerticalInterval(hall, '2030-11-07', '18:00', '18:00')).toBe(true);
  });

  it('hotel: cuenta noches entre llegada y salida', () => {
    expect(validVerticalInterval(hotel, '2030-11-02', '15:00', '12:00', '2030-11-04')).toBe(true);
    expect(validVerticalInterval(hotel, '2030-11-02', '15:00', '12:00', '2030-11-02')).toBe(false);
    expect(validVerticalInterval(hotel, '2030-11-02', '15:00', '12:00')).toBe(false);
    expect(validVerticalInterval(hotel, '2030-11-01', '15:00', '12:00', '2030-12-02')).toBe(false);
  });

  it('sin perfil conserva la regla anterior del mismo día', () => {
    expect(validVerticalInterval(null, '2030-11-02', '19:00', '21:00')).toBe(true);
    expect(validVerticalInterval(null, '2030-11-02', '23:00', '01:00')).toBe(false);
    expect(validVerticalInterval(null, '2030-02-30', '19:00', '21:00')).toBe(false);
  });

  it('elige textos y rellena los límites reales del perfil', () => {
    expect(verticalTerms(hotel).dateLabel).toBe('Llegada');
    expect(verticalTerms(null).dateLabel).toBe('Día');
    expect(fillVerticalText(verticalTerms(hotel).hint, hotel)).toContain('15:00');
    expect(fillVerticalText(verticalTerms(nightclub).hint, nightclub)).toContain('12 h');
  });

  it('calcula el día siguiente sin depender de la zona del navegador', () => {
    expect(nextDay('2030-12-31')).toBe('2031-01-01');
    expect(nextDay('no-es-fecha')).toBe('');
  });
});
