import { ChangeDetectionStrategy, Component, type OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TenantsService } from '@mapit/api-client';
import { finalize, forkJoin } from 'rxjs';

import { STRINGS } from '../../../../core/strings';

/**
 * Dashboard inicial de la consola de plataforma. Solo muestra métricas reales
 * que la API ya soporta (conteo total/activos/suspendidos) y accesos rápidos.
 * Consume el cliente generado directamente: una feature no importa de otra feature.
 */
@Component({
  selector: 'mapit-admin-dashboard',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="page">
      <header class="page-header">
        <p class="eyebrow">{{ strings.adminDashboard.eyebrow }}</p>
        <h1>{{ strings.adminDashboard.greeting }}</h1>
        <p class="intro">{{ strings.adminDashboard.intro }}</p>
      </header>

      @if (loading()) {
        <p class="cards-hint" role="status">{{ strings.adminDashboard.loading }}</p>
      } @else if (failed()) {
        <div class="message error" role="alert">
          <p>{{ strings.adminDashboard.loadError }}</p>
          <button class="btn secondary" type="button" (click)="reload()">
            {{ strings.adminDashboard.retry }}
          </button>
        </div>
      } @else {
        <div class="cards">
          <article class="card">
            <span class="value">{{ total() }}</span>
            <span class="label">{{ strings.adminDashboard.tenantsWithData }}</span>
          </article>
          <article class="card">
            <span class="value">{{ pending() }}</span>
            <span class="label">{{ strings.adminDashboard.tenantsPending }}</span>
          </article>
          <article class="card">
            <span class="value">{{ active() }}</span>
            <span class="label">{{ strings.adminDashboard.tenantsActive }}</span>
          </article>
          <article class="card">
            <span class="value">{{ suspended() }}</span>
            <span class="label">{{ strings.adminDashboard.tenantsSuspended }}</span>
          </article>
        </div>
      }

      <section class="quick">
        <h2>{{ strings.adminDashboard.quickActionsTitle }}</h2>
        <a class="btn primary" routerLink="/admin/tenants">{{
          strings.adminDashboard.goToTenants
        }}</a>
      </section>
    </section>
  `,
  styles: `
    .page {
      display: grid;
      gap: var(--mapit-space-6);
    }
    .page-header .eyebrow {
      margin: 0 0 var(--mapit-space-1);
      font: var(--mapit-text-caps);
      color: var(--mapit-color-primary);
      letter-spacing: 0.05em;
      text-transform: uppercase;
    }
    .page-header h1 {
      margin: 0;
      font: var(--mapit-text-display);
    }
    .page-header .intro {
      margin: var(--mapit-space-2) 0 0;
      font: var(--mapit-text-body);
      color: var(--mapit-color-text-muted);
    }
    .cards {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr));
      gap: var(--mapit-space-4);
    }
    .card {
      background: var(--mapit-color-surface);
      border-radius: var(--mapit-radius-lg);
      box-shadow: var(--mapit-shadow);
      padding: var(--mapit-space-6);
      display: grid;
      gap: var(--mapit-space-1);
    }
    .value {
      font-family: var(--mapit-font-display);
      font-size: 2.25rem;
      font-weight: 700;
      line-height: 1;
    }
    .label {
      font: var(--mapit-text-metadata);
      color: var(--mapit-color-text-muted);
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .cards-hint {
      color: var(--mapit-color-text-muted);
      font: var(--mapit-text-body);
    }
    .message.error {
      margin: 0;
      padding: var(--mapit-space-4);
      border-radius: var(--mapit-radius);
      color: var(--mapit-color-error);
      background: #fee2e2;
      display: grid;
      gap: var(--mapit-space-3);
      justify-items: start;
      font: var(--mapit-text-body);
    }
    .quick h2 {
      margin: 0 0 var(--mapit-space-3);
      font: var(--mapit-text-section);
    }
    .btn {
      display: inline-flex;
      align-items: center;
      padding: 0.55rem 1rem;
      border: 1px solid transparent;
      border-radius: var(--mapit-radius-lg);
      font: var(--mapit-text-body-bold);
      cursor: pointer;
      text-decoration: none;
    }
    .btn.primary {
      background: var(--mapit-color-accent);
      color: var(--mapit-color-on-primary);
    }
    .btn.primary:hover {
      background: var(--mapit-color-primary);
    }
    .btn.secondary {
      background: var(--mapit-color-surface);
      border-color: var(--mapit-color-border);
      color: var(--mapit-color-text);
    }
  `,
})
export class AdminDashboard implements OnInit {
  protected readonly strings = STRINGS;
  private readonly api = inject(TenantsService);

  protected readonly loading = signal(true);
  protected readonly failed = signal(false);
  protected readonly total = signal(0);
  protected readonly pending = signal(0);
  protected readonly active = signal(0);
  protected readonly suspended = signal(0);

  ngOnInit(): void {
    this.reload();
  }

  protected reload(): void {
    this.loading.set(true);
    this.failed.set(false);
    forkJoin({
      all: this.api.listTenants({ size: 1 }),
      pending: this.api.listTenants({ size: 1, status: 'PENDING_APPROVAL' }),
      active: this.api.listTenants({ size: 1, status: 'ACTIVE' }),
      suspended: this.api.listTenants({ size: 1, status: 'SUSPENDED' }),
    })
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: ({ all, pending, active, suspended }) => {
          this.total.set(all.totalElements);
          this.pending.set(pending.totalElements);
          this.active.set(active.totalElements);
          this.suspended.set(suspended.totalElements);
        },
        error: () => this.failed.set(true),
      });
  }
}
