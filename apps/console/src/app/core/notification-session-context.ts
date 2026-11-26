import {
  computed,
  DestroyRef,
  effect,
  inject,
  Injectable,
  linkedSignal,
  signal,
} from '@angular/core';
import { NotificationsService } from '@mapit/api-client';
import { AuthSession } from '@mapit/auth';
import { FeatureFlagService, type FeatureFlagContext } from '@mapit/feature-flags';
import { type Subscription, timeout } from 'rxjs';

/** Conecta sesión real y flags; el nonce vive solo en memoria y nunca usa el JWT. */
@Injectable({ providedIn: 'root' })
export class NotificationSessionContext {
  private readonly session = inject(AuthSession);
  private readonly flags = inject(FeatureFlagService);
  private readonly api = inject(NotificationsService);
  private readonly verified = signal<FeatureFlagContext | null>(null);
  readonly context = linkedSignal<FeatureFlagContext | null>(() => {
    const user = this.session.user();
    if (!user || typeof globalThis.crypto?.randomUUID !== 'function') return null;
    return { tenantId: user.tenantId, userId: user.id, sessionId: crypto.randomUUID() };
  });
  readonly enabled = computed(() => this.verified() === this.context() && this.proxyEnabled());
  private readonly proxyEnabled = computed(() =>
    this.flags.isEnabledForContext('mapit.s6.notification-center', this.context()),
  );

  constructor() {
    effect(() => this.flags.setContext(this.context()));
    // El proxy puede servir ON cacheado con Unleash caído. Exigir también una
    // lectura autenticada del gate backend existente; nunca habilitar por el proxy solo.
    effect((onCleanup) => {
      const context = this.context();
      const candidate = this.proxyEnabled();
      this.verified.set(null);
      if (!context || !candidate) return;
      let active = true;
      let pending: Subscription | undefined;
      const probe = () => {
        pending?.unsubscribe();
        pending = this.api
          .countMyUnreadNotifications({}, 'body', false, { transferCache: false })
          .pipe(timeout(5000))
          .subscribe({
            next: (result) => {
              if (active && this.context() === context)
                this.verified.set(
                  result && Number.isSafeInteger(result.unreadCount) && result.unreadCount >= 0
                    ? context
                    : null,
                );
            },
            error: () => {
              if (active && this.context() === context) this.verified.set(null);
            },
          });
      };
      probe();
      const timer = setInterval(probe, 10_000);
      onCleanup(() => {
        active = false;
        clearInterval(timer);
        pending?.unsubscribe();
        this.verified.set(null);
      });
    });
    inject(DestroyRef).onDestroy(() => this.flags.setContext(null));
  }
}
