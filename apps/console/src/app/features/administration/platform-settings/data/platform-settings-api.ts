import { Injectable, inject } from '@angular/core';
import { PlatformSettingsService } from '@mapit/api-client';
import type {
  PlatformSetting,
  PlatformSettingChange,
  PlatformSettingsOverview,
} from '@mapit/api-client';
import type { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class PlatformSettingsApi {
  private readonly client = inject(PlatformSettingsService);

  overview(): Observable<PlatformSettingsOverview> {
    return this.client.getPlatformSettings();
  }

  changes(): Observable<PlatformSettingChange[]> {
    return this.client.listPlatformSettingChanges();
  }

  change(
    key: string,
    value: number | null,
    expectedValue: number,
    reason: string,
  ): Observable<PlatformSetting> {
    return this.client.changePlatformSetting({
      key,
      platformSettingChangeRequest: { value, expectedValue, reason },
    });
  }
}
