import { computed, effect, inject, Injectable, signal, untracked } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { type CanActivateFn, Router } from '@angular/router';
import { AuthSession } from '@mapit/auth';
import { FeatureFlagService } from '@mapit/feature-flags';
import { filter, map, take } from 'rxjs';

/** Gate de disponibilidad UX; el backend conserva autenticación y autorización. */
@Injectable({ providedIn: 'root' })
export class MyAccountAccess {
  private readonly session = inject(AuthSession);
  private readonly flags = inject(FeatureFlagService);
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
    return { ready: !scope || (current?.ready() ?? false), enabled: current?.enabled() ?? false };
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
