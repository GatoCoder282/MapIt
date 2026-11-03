import { Pipe, type PipeTransform } from '@angular/core';

@Pipe({ name: 'localNumber', standalone: true, pure: true })
export class LocalizedNumberPipe implements PipeTransform {
  transform(value: number | null | undefined, locale: string): string | null {
    if (value === null || value === undefined || !Number.isFinite(value)) return null;
    return new Intl.NumberFormat(locale).format(value);
  }
}
