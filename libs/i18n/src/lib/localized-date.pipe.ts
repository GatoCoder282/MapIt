import { Pipe, type PipeTransform } from '@angular/core';

export type LocalizedDatePreset = 'short' | 'medium' | 'long' | 'full' | 'mediumDate';

@Pipe({ name: 'localDate', standalone: true, pure: true })
export class LocalizedDatePipe implements PipeTransform {
  transform(
    value: Date | string | number | null | undefined,
    locale: string,
    preset: LocalizedDatePreset = 'medium',
  ): string | null {
    if (value === null || value === undefined || value === '') return null;
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return null;

    const options: Intl.DateTimeFormatOptions =
      preset === 'mediumDate' ? { dateStyle: 'medium' } : { dateStyle: preset, timeStyle: preset };

    return new Intl.DateTimeFormat(locale, options).format(date);
  }
}
