import { inject, Injectable } from '@angular/core';
import { NotificationsService } from '@mapit/api-client';

/** Solo transporte real generado; sin fallback de datos o mutaciones simuladas. */
@Injectable({ providedIn: 'root' })
export class NotificationsApi {
  private readonly client = inject(NotificationsService);

  list(cursor?: string) {
    return this.client.listMyNotifications(
      { limit: 20, ...(cursor ? { cursor } : {}) },
      'body',
      false,
      { transferCache: false },
    );
  }

  count() {
    return this.client.countMyUnreadNotifications({}, 'body', false, { transferCache: false });
  }

  markRead(notificationId: string) {
    return this.client.markMyNotificationRead({ notificationId }, 'body', false, {
      transferCache: false,
    });
  }

  markAllRead() {
    return this.client.markAllMyNotificationsRead({}, 'body', false, { transferCache: false });
  }
}
