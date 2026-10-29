import { describe, expect, it } from 'vitest';

import { LocalizedDatePipe } from './localized-date.pipe';
import { LocalizedNumberPipe } from './localized-number.pipe';

describe('localized formatters', () => {
  it('formats dates using the requested locale and returns null for invalid values', () => {
    const pipe = new LocalizedDatePipe();
    const date = new Date('2026-10-27T12:00:00.000Z');

    expect(pipe.transform(date, 'ja-JP', 'mediumDate')).toBe(
      new Intl.DateTimeFormat('ja-JP', { dateStyle: 'medium' }).format(date),
    );
    expect(pipe.transform('invalid-date', 'en-US')).toBeNull();
    expect(pipe.transform(null, 'es-BO')).toBeNull();
  });

  it('formats numbers using the requested locale and returns null for invalid values', () => {
    const pipe = new LocalizedNumberPipe();

    expect(pipe.transform(12345.6, 'ja-JP')).toBe(new Intl.NumberFormat('ja-JP').format(12345.6));
    expect(pipe.transform(Number.POSITIVE_INFINITY, 'en-US')).toBeNull();
    expect(pipe.transform(undefined, 'es-BO')).toBeNull();
  });
});
