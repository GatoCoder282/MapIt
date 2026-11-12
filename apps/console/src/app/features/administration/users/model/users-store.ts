import { HttpErrorResponse } from '@angular/common/http';
import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  type MemberInvitationRole,
  type TenantUser,
  type TenantUserInvitation,
} from '@mapit/api-client';
import { finalize } from 'rxjs';

import { STRINGS } from '../../../../core/strings';
import { UsersApi } from '../data/users-api';

type Action = { kind: 'role' | 'deactivate'; user: TenantUser };

@Injectable()
export class UsersStore {
  private readonly api = inject(UsersApi);
  private readonly destroyRef = inject(DestroyRef);
  private version = 0;

  readonly status = signal<'loading' | 'ready' | 'error'>('loading');
  readonly users = signal<readonly TenantUser[]>([]);
  readonly page = signal(0);
  readonly size = 20;
  readonly totalPages = signal(0);
  readonly totalElements = signal(0);
  readonly selected = signal<TenantUser | null>(null);
  readonly invitations = signal<readonly TenantUserInvitation[]>([]);
  readonly invitationStatus = signal<'loading' | 'ready' | 'error'>('loading');
  readonly invitationError = signal('');
  readonly invitationPage = signal(0);
  readonly invitationTotalPages = signal(0);
  readonly invitationTotalElements = signal(0);
  readonly invitationNow = signal(Date.now());
  private invitationVersion = 0;
  private cooldownTimer: ReturnType<typeof setTimeout> | undefined;
  readonly pending = signal<Action | null>(null);
  readonly saving = signal(false);
  readonly error = signal('');
  readonly feedback = signal('');
  readonly canPrev = computed(() => this.page() > 0 && this.status() !== 'loading');
  readonly canNext = computed(
    () => this.page() + 1 < this.totalPages() && this.status() !== 'loading',
  );
  readonly canPrevInvitation = computed(
    () => this.invitationPage() > 0 && this.invitationStatus() !== 'loading',
  );
  readonly canNextInvitation = computed(
    () =>
      this.invitationPage() + 1 < this.invitationTotalPages() &&
      this.invitationStatus() !== 'loading',
  );

  constructor() {
    this.destroyRef.onDestroy(() => clearTimeout(this.cooldownTimer));
  }

  loadInvitations(page = this.invitationPage(), keepError = false): void {
    const version = ++this.invitationVersion;
    this.invitationStatus.set('loading');
    if (!keepError) this.invitationError.set('');
    this.api
      .listInvitations(page, this.size)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result) => {
          if (version !== this.invitationVersion) return;
          this.invitations.set(result.content);
          this.invitationPage.set(result.page);
          this.invitationTotalPages.set(result.totalPages);
          this.invitationTotalElements.set(result.totalElements);
          this.invitationStatus.set('ready');
          this.scheduleCooldown();
        },
        error: (error: unknown) => {
          if (version !== this.invitationVersion) return;
          this.invitationError.set(this.message(error));
          this.invitationStatus.set('error');
        },
      });
  }

  private scheduleCooldown(): void {
    clearTimeout(this.cooldownTimer);
    const now = Date.now();
    this.invitationNow.set(now);
    const next = this.invitations()
      .filter((item) => item.dispatchStatus !== 'SMTP_FAILED' && item.dispatchAttemptedAt)
      .map((item) => Date.parse(item.dispatchAttemptedAt ?? '') + 30_000)
      .filter((value) => Number.isFinite(value) && value > now)
      .sort((a, b) => a - b)[0];
    if (next !== undefined)
      this.cooldownTimer = setTimeout(() => this.scheduleCooldown(), next - now + 1);
  }

  load(page = this.page()): void {
    const version = ++this.version;
    this.status.set('loading');
    this.error.set('');
    this.api
      .list(page, this.size)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result) => {
          if (version !== this.version) return;
          this.users.set(result.content);
          this.page.set(result.page);
          this.totalPages.set(result.totalPages);
          this.totalElements.set(result.totalElements);
          this.status.set('ready');
        },
        error: (error: unknown) => {
          if (version !== this.version) return;
          this.error.set(this.message(error));
          this.status.set('error');
        },
      });
  }

  detail(user: TenantUser): void {
    this.error.set('');
    this.api
      .detail(user.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result) => this.selected.set(result),
        error: (error: unknown) => this.error.set(this.message(error)),
      });
  }

  invite(email: string, role: MemberInvitationRole): void {
    if (this.saving() || !['MANAGER', 'STAFF'].includes(role)) return;
    this.saving.set(true);
    this.error.set('');
    this.feedback.set('');
    this.api
      .invite({ email: email.trim(), role })
      .pipe(
        finalize(() => this.saving.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => {
          this.feedback.set(STRINGS.users.invitation);
          this.load();
          this.loadInvitations(0);
        },
        error: (error: unknown) => {
          this.error.set(this.message(error, true));
          if (error instanceof HttpErrorResponse && error.status === 409) this.loadInvitations(0);
        },
      });
  }

  resend(invitation: TenantUserInvitation): void {
    if (
      !this.invitations().some((item) => item.id === invitation.id) ||
      !this.canResend(invitation) ||
      this.saving()
    )
      return;
    this.saving.set(true);
    this.invitationError.set('');
    this.api
      .resend(invitation.id)
      .pipe(
        finalize(() => this.saving.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => {
          this.feedback.set(STRINGS.users.resent);
          this.loadInvitations();
        },
        error: (error: unknown) => {
          this.invitationError.set(this.message(error));
          if (error instanceof HttpErrorResponse && [404, 409].includes(error.status)) {
            this.loadInvitations(this.invitationPage(), true);
          }
        },
      });
  }

  canResend(invitation: TenantUserInvitation): boolean {
    return (
      !!invitation.id &&
      (invitation.status === 'PENDING' || invitation.status === 'EXPIRED') &&
      (invitation.dispatchStatus === 'SMTP_FAILED' ||
        !invitation.dispatchAttemptedAt ||
        Date.parse(invitation.dispatchAttemptedAt) + 30_000 <= this.invitationNow())
    );
  }

  canManage(user: TenantUser): boolean {
    return user.active && (user.role === 'MANAGER' || user.role === 'STAFF');
  }

  ask(user: TenantUser, kind: Action['kind']): void {
    if (this.saving() || !this.canManage(user)) return;
    this.pending.set({ user, kind });
  }

  confirm(): void {
    const action = this.pending();
    if (!action || !this.canManage(action.user) || this.saving()) return;
    this.saving.set(true);
    this.error.set('');
    this.feedback.set('');
    const request =
      action.kind === 'role'
        ? this.api.changeRole(action.user.id, {
            expectedRole: action.user.role as MemberInvitationRole,
            role: action.user.role === 'MANAGER' ? 'STAFF' : 'MANAGER',
          })
        : this.api.deactivate(action.user.id);
    request
      .pipe(
        finalize(() => this.saving.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => {
          this.pending.set(null);
          this.selected.set(null);
          this.feedback.set(
            action.kind === 'role' ? STRINGS.users.roleChanged : STRINGS.users.deactivated,
          );
          this.load();
        },
        error: (error: unknown) => {
          this.pending.set(null);
          this.error.set(this.message(error));
          if (error instanceof HttpErrorResponse && error.status === 409) {
            this.selected.set(null);
            this.load();
            this.error.set(STRINGS.users.errors.conflict);
          }
        },
      });
  }

  private message(error: unknown, inviting = false): string {
    if (error instanceof HttpErrorResponse) {
      if (error.status === 400) return STRINGS.users.errors.invalid;
      if (error.status === 401) return STRINGS.users.errors.unauthorized;
      if (error.status === 403) return STRINGS.users.errors.forbidden;
      if (error.status === 404) return STRINGS.users.errors.notFound;
      if (error.status === 409)
        return inviting ? STRINGS.users.errors.duplicate : STRINGS.users.errors.conflict;
    }
    return STRINGS.users.errors.generic;
  }
}
