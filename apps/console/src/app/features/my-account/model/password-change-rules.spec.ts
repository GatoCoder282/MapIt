import { fitsBcrypt, newPasswordRules } from './password-change-rules';

describe('reglas preparadas de cambio de contraseña', () => {
  it.each(['Aa1!' + 'x'.repeat(68), 'Aa1!' + 'é'.repeat(34), 'Aa1!' + '😀'.repeat(17)])(
    'acepta exactamente 72 bytes UTF-8: %s',
    (value) => {
      expect(fitsBcrypt(value)).toBe(true);
      expect(Object.values(newPasswordRules(value)).every(Boolean)).toBe(true);
      expect(fitsBcrypt(value + 'x')).toBe(false);
    },
  );

  it.each(['', 'a'.repeat(73), 'Aa1!bad\ud800', '\udc00Aa1!bad'])(
    'rechaza entradas fuera del límite o UTF-8 inválido',
    (value) => {
      expect(fitsBcrypt(value)).toBe(false);
    },
  );

  it('refleja composición Unicode BMP del backend sin normalizar ni prohibir espacios', () => {
    expect(Object.values(newPasswordRules('ÁrbolUno١ ')).every(Boolean)).toBe(true);
    expect(newPasswordRules('sinmayuscula1!').casing).toBe(false);
    expect(newPasswordRules('SinNumero!').digit).toBe(false);
    expect(newPasswordRules('SinSimbolo1').symbol).toBe(false);
    expect(newPasswordRules('Aa1!abc').length).toBe(false);
  });
});
