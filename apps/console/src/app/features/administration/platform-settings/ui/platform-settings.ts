import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { I18nService, LocalizedDatePipe } from '@mapit/i18n';

import { STRINGS } from '../../../../core/strings';
import { PlatformSettingsStore } from '../model/platform-settings-store';

/** Configuración global del Super Admin (HU-7.07). Solo binding y eventos. */
@Component({
  selector: 'mapit-platform-settings',
  imports: [LocalizedDatePipe],
  providers: [PlatformSettingsStore],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './platform-settings.html',
  styleUrl: './platform-settings.scss',
})
export class PlatformSettings {
  protected readonly store = inject(PlatformSettingsStore);
  protected readonly copy = STRINGS.platformSettings;
  protected readonly i18n = inject(I18nService);

  constructor() {
    this.store.load();
  }

  protected label(key: string): string {
    const labels: Readonly<Record<string, string>> = this.copy.labels;
    return labels[key] ?? key;
  }

  protected value(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }
}
