/** Formatea importes decimales del contrato sin convertirlos a Number ni redondearlos. */
export function formatDecimalMoney(value: string, currency: string, locale = 'es-BO'): string {
  const match = /^(-?)(\d+)(?:\.(\d+))?$/.exec(value);
  if (!match) return currency + ' ' + value;
  const integer = match[2]!;
  const fraction = match[3] ?? '';
  try {
    const formatter = new Intl.NumberFormat(locale, { style: 'currency', currency });
    const digits = formatter.resolvedOptions().maximumFractionDigits ?? 0;
    if (fraction.length > digits) return currency + ' ' + value;
    const grouped = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(
      BigInt(integer),
    );
    return formatter
      .formatToParts(match[1] === '-' ? -1n : 1n)
      .map((part) =>
        part.type === 'integer'
          ? grouped
          : part.type === 'fraction'
            ? fraction.padEnd(digits, '0')
            : part.value,
      )
      .join('');
  } catch {
    return currency + ' ' + value;
  }
}
