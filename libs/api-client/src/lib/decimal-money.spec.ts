import { formatDecimalMoney } from './decimal-money';
describe('formatDecimalMoney', () => {
  it('conserva enteros por encima de precisión Number y sus centavos', () => {
    const rendered = formatDecimalMoney('9007199254740993.01', 'BOB', 'en-US');
    expect(rendered).toContain('9,007,199,254,740,993.01');
  });
  it('respeta monedas de cero y tres decimales y el cero negativo', () => {
    expect(formatDecimalMoney('123', 'JPY', 'en-US')).toContain('123');
    expect(formatDecimalMoney('1.001', 'KWD', 'en-US')).toContain('1.001');
    expect(formatDecimalMoney('-0.01', 'USD', 'en-US')).toBe('-$0.01');
  });
  it('no redondea fracciones incompatibles con una moneda', () => {
    expect(formatDecimalMoney('1.234', 'USD')).toBe('USD 1.234');
  });
});
