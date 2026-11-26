import { computed, effect, inject, Injectable, signal, untracked } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { type CanActivateFn, Router } from '@angular/router';
import { AuthSession } from '@mapit/auth';
import { MyAccountService } from '@mapit/api-client';
import { FeatureFlagService } from '@mapit/feature-flags';
import { filter, map, take, timeout, type Subscription } from 'rxjs';

/** Gate de disponibilidad UX; el backend conserva autenticación y autorización. */
@Injectable({ providedIn: 'root' })
export class MyAccountAccess {
  private readonly session = inject(AuthSession);
  private readonly flags = inject(FeatureFlagService);
  private readonly api = inject(MyAccountService);
  private readonly confirmation = signal<{ scope: string; enabled: boolean } | null>(null);
  readonly scope = computed(() => {
    const user = this.session.user();
    return user
      ? JSON.stringify([this.session.revision(), user.id, user.tenantId, user.role])
      : null;
  });
  private readonly evaluation = signal<{
    scope: string;
    flag: ReturnType<FeatureFlagService['watchInContext']>;
  } | null>(null);
  readonly state = computed(() => {
    const scope = this.scope();
    const evaluation = this.evaluation();
    const current = scope && evaluation?.scope === scope ? evaluation.flag : null;
    const confirmation = this.confirmation();
    const confirmed = confirmation?.scope === scope;
    return {
      ready: !scope || (!!current?.ready() && (!current.enabled() || confirmed)),
      enabled: !!current?.enabled() && confirmed && confirmation?.enabled === true,
    };
  });
  readonly enabled = computed(() => this.state().enabled);

  constructor() {
    effect((onCleanup) => {
      const scope = this.scope();
      const user = untracked(() => this.session.user());
      if (!scope || !user) {
        this.evaluation.set(null);
        return;
      }
      const flag = this.flags.watchInContext('mapit.s6.my-account', { tenantId: user.tenantId });
      this.evaluation.set({ scope, flag });
      onCleanup(() => flag.destroy());
    });

    // El proxy puede seguir devolviendo ON desde caché cuando cae Unleash.
    // Esta confirmación solo controla disponibilidad UX; el endpoint sigue autorizando cada operación.
    effect((onCleanup) => {
      const evaluation = this.evaluation();
      const scope = this.scope();
      this.confirmation.set(null);
      if (!scope || evaluation?.scope !== scope || !evaluation.flag.enabled()) return;
      let disposed = false;
      let sequence = 0;
      let request: Subscription | undefined;
      const refresh = () => {
        request?.unsubscribe();
        const generation = ++sequence;
        const settle = (enabled: boolean) => {
          if (
            !disposed &&
            generation === sequence &&
            this.scope() === scope &&
            this.evaluation() === evaluation &&
            evaluation.flag.enabled()
          ) {
            this.confirmation.set({ scope, enabled });
          }
        };
        request = this.api
          .getMyProfile(undefined, 'response', false, { transferCache: false })
          .pipe(timeout(5000))
          .subscribe({
            next: (response) => settle(response.status === 200),
            error: () => settle(false),
          });
      };
      refresh();
      const interval = setInterval(refresh, 15_000);
      onCleanup(() => {
        disposed = true;
        sequence++;
        request?.unsubscribe();
        clearInterval(interval);
      });
    });
  }
}

export const myAccountGuard: CanActivateFn = () => {
  const access = inject(MyAccountAccess);
  const session = inject(AuthSession);
  const router = inject(Router);
  return toObservable(access.state).pipe(
    filter((state) => state.ready),
    take(1),
    map((state) =>
      !session.token()
        ? router.parseUrl(session.loginUrl())
        : state.enabled
          ? true
          : router.parseUrl(session.user()?.role === 'SUPER_ADMIN' ? '/admin/dashboard' : '/home'),
    ),
  );
};
