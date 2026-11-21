/** Validación orientativa: el backend sigue verificando política, hash y permisos. */
export function fitsBcrypt(value: string): boolean {
  if (value.length === 0 || value.length > 72) return false;
  for (let i = 0; i < value.length; i++) {
    const unit = value.charCodeAt(i);
    if (unit >= 0xd800 && unit <= 0xdbff) {
      const next = value.charCodeAt(++i);
      if (!(next >= 0xdc00 && next <= 0xdfff)) return false;
    } else if (unit >= 0xdc00 && unit <= 0xdfff) return false;
  }
  return new TextEncoder().encode(value).length <= 72;
}

export function newPasswordRules(value: string) {
  // PasswordPolicy utiliza Character sobre unidades UTF-16; no inventar una
  // política ASCII ni rechazar espacios/símbolos permitidos por el backend.
  const units = value.split('');
  return {
    length: [...value].length >= 8,
    casing:
      units.some((unit) => /\p{Uppercase}/u.test(unit)) &&
      units.some((unit) => /\p{Lowercase}/u.test(unit)),
    digit: units.some((unit) => /\p{Decimal_Number}/u.test(unit)),
    symbol: units.some((unit) => !/[\p{Letter}\p{Decimal_Number}]/u.test(unit)),
    bytes: fitsBcrypt(value),
  };
}
