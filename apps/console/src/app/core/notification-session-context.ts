import { computed, DestroyRef, effect, inject, Injectable, linkedSignal } from '@angular/core';
import { AuthSession } from '@mapit/auth';
import { FeatureFlagService, type FeatureFlagContext } from '@mapit/feature-flags';

/** Conecta sesión real y flags; el nonce vive solo en memoria y nunca usa el JWT. */
@Injectable({ providedIn: 'root' })
export class NotificationSessionContext {
  private readonly session = inject(AuthSession);
  private readonly flags = inject(FeatureFlagService);
  readonly context = linkedSignal<FeatureFlagContext | null>(() => {
    const user = this.session.user();
    if (!user || typeof globalThis.crypto?.randomUUID !== 'function') return null;
    return { tenantId: user.tenantId, userId: user.id, sessionId: crypto.randomUUID() };
  });
  readonly enabled = computed(() =>
    this.flags.isEnabledForContext('mapit.s6.notification-center', this.context()),
  );

  constructor() {
    effect(() => this.flags.setContext(this.context()));
    inject(DestroyRef).onDestroy(() => this.flags.setContext(null));
  }
}
