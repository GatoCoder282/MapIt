import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { I18N_STRINGS } from './i18n-strings';
import { I18nService } from './language';

@Component({
  selector: 'mapit-language-selector',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './language-selector.html',
  styleUrl: './language-selector.scss',
})
export class LanguageSelector {
  protected readonly i18n = inject(I18nService);
  protected readonly strings = I18N_STRINGS;
  protected readonly languages = this.i18n.languages;

  protected changeLanguage(event: Event): void {
    const select = event.target as HTMLSelectElement;
    this.i18n.setLanguage(select.value);
  }
}
