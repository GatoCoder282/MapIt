import { inject, Injectable } from '@angular/core';
import type { FeatureFlagContext } from '@mapit/feature-flags';
import { RealtimeClient } from '@mapit/realtime';

/** Conector al transporte compartido; no habilita ni autoriza el canal privado. */
@Injectable({ providedIn: 'root' })
export class NotificationsRealtime {
  private readonly client = inject(RealtimeClient);
  readonly connectionState = this.client.connectionState;

  available(context: FeatureFlagContext): boolean {
    return this.client.canSubscribeNotifications(context);
  }

  observe(context: FeatureFlagContext) {
    return this.client.subscribeNotificationInvalidations(context);
  }
}
