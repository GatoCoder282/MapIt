import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal, type OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';

import { EstablishmentsService, TenantsService } from '@mapit/api-client';
import type { EstablishmentType } from '@mapit/api-client';
import { AuthSession } from '@mapit/auth';
import { STRINGS } from '../../core/strings';

const TYPE_ORDER: EstablishmentType[] = ['RESTAURANT', 'NIGHTCLUB', 'EVENT_HALL', 'HOTEL'];

const EMPTY_COUNTS: Record<EstablishmentType, number> = {
  RESTAURANT: 0,
  NIGHTCLUB: 0,
  EVENT_HALL: 0,
  HOTEL: 0,
};

@Component({
  selector: 'mapit-home',
  imports: [RouterLink, DecimalPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="page">
      <header class="page-header">
        @if (session.user(); as user) {
          <p class="eyebrow">{{ strings.adminDashboardHome.welcome }} {{ user.fullName }}</p>
        }
        <h1>{{ strings.adminDashboardHome.title }}</h1>
        <p class="intro">{{ strings.adminDashboardHome.intro }}</p>
      </header>

      @if (loading()) {
        <p class="hint" role="status">{{ strings.adminDashboardHome.loading }}</p>
      } @else if (failed()) {
        <div class="message error" role="alert">
          <p>{{ strings.adminDashboardHome.loadError }}</p>
          <button class="btn secondary" type="button" (click)="reload()">
            {{ strings.adminDashboardHome.retry }}
          </button>
        </div>
      } @else {
        <div class="kpis">
          <article class="card">
            <span class="value">{{ totalTenants() | number }}</span>
            <span class="label">{{ strings.adminDashboardHome.tenantsTotal }}</span>
          </article>
          <article class="card">
            <span class="value">{{ activeTenants() | number }}</span>
            <span class="label">{{ strings.adminDashboardHome.tenantsActive }}</span>
          </article>
          <article class="card">
            <span class="value">{{ suspendedTenants() | number }}</span>
            <span class="label">{{ strings.adminDashboardHome.tenantsSuspended }}</span>
          </article>
          <article class="card">
            <span class="value">{{ totalEstablishments() | number }}</span>
            <span class="label">{{ strings.adminDashboardHome.establishmentsTotal }}</span>
          </article>
        </div>

        <section class="by-type">
          <h2>{{ strings.adminDashboardHome.byTypeTitle }}</h2>
          <div class="list">
            @for (type of typeOrder; track type) {
              <article class="item">
                <span class="label">{{ typeLabels[type] }}</span>
                <span class="value">{{ countsByType()[type] | number }}</span>
              </article>
            } @empty {
              <p class="empty">{{ strings.adminDashboardHome.noEstablishments }}</p>
            }
          </div>
        </section>

        <section class="quick">
          <h2>{{ strings.adminDashboardHome.quickActionsTitle }}</h2>
          <div class="actions">
            <a class="btn primary" routerLink="/admin/tenants">{{
              strings.adminDashboardHome.goToTenants
            }}</a>
            <a class="btn secondary" routerLink="/admin/settings">{{
              strings.adminDashboardHome.goToSettings
            }}</a>
          </div>
        </section>
      }
    </section>
  `,
  styles: `
    .page {
      display: grid;
      gap: var(--mapit-space-6);
      max-width: 72rem;
      margin-inline: auto;
      padding: var(--mapit-space-4);
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
    .kpis {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr));
      gap: var(--mapit-space-4);
    }
    .card {
      background: var(--mapit-color-surface);
      border: 1px solid var(--mapit-color-border);
      border-radius: var(--mapit-radius-lg);
      box-shadow: var(--mapit-shadow);
      padding: var(--mapit-space-6);
      display: grid;
      gap: var(--mapit-space-1);
    }
    .value {
      font-family: var(--mapit-font-display);
      font-size: 2rem;
      font-weight: 700;
      line-height: 1;
    }
    .label {
      font: var(--mapit-text-metadata);
      color: var(--mapit-color-text-muted);
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .by-type h2,
    .quick h2 {
      margin: var(--mapit-space-8) 0 var(--mapit-space-3);
      font: var(--mapit-text-section);
    }
    .list {
      display: grid;
      gap: var(--mapit-space-2);
    }
    .item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: var(--mapit-space-2) var(--mapit-space-3);
      background: var(--mapit-color-surface);
      border: 1px solid var(--mapit-color-border);
      border-radius: var(--mapit-radius);
    }
    .quick {
      display: grid;
      gap: var(--mapit-space-3);
    }
    .actions {
      display: flex;
      gap: var(--mapit-space-2);
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
      touch-action: manipulation;
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
    .btn.secondary:hover {
      background: var(--mapit-color-surface-low);
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
    .hint,
    .empty {
      color: var(--mapit-color-text-muted);
      font: var(--mapit-text-body);
    }
  `,
})
export class Home implements OnInit {
  protected readonly session = inject(AuthSession);
  protected readonly strings = STRINGS;
  protected readonly typeOrder = TYPE_ORDER;
  protected readonly typeLabels = {
    RESTAURANT: STRINGS.verticals.RESTAURANT,
    NIGHTCLUB: STRINGS.verticals.NIGHTCLUB,
    EVENT_HALL: STRINGS.verticals.EVENT_HALL,
    HOTEL: STRINGS.verticals.HOTEL,
  };

  private readonly tenantsService = inject(TenantsService);
  private readonly establishmentsService = inject(EstablishmentsService);

  protected readonly loading = signal(true);
  protected readonly failed = signal(false);
  protected readonly totalTenants = signal(0);
  protected readonly activeTenants = signal(0);
  protected readonly suspendedTenants = signal(0);
  protected readonly totalEstablishments = signal(0);
  protected readonly countsByType = signal<Record<EstablishmentType, number>>({ ...EMPTY_COUNTS });

  ngOnInit(): void {
    this.reload();
  }

  protected reload(): void {
    this.loading.set(true);
    this.failed.set(false);
    forkJoin({
      tenants: this.tenantsService.listTenants({ size: 1 }),
      establishments: this.establishmentsService.listEstablishments(),
    }).subscribe({
      next: ({ tenants, establishments }) => {
        this.totalTenants.set(tenants.totalElements);
        this.activeTenants.set(tenants.content.filter((t) => t.status === 'ACTIVE').length);
        this.suspendedTenants.set(tenants.content.filter((t) => t.status === 'SUSPENDED').length);
        this.totalEstablishments.set(establishments.length);
        const counts = { ...EMPTY_COUNTS };
        for (const establishment of establishments) {
          counts[establishment.type] = (counts[establishment.type] ?? 0) + 1;
        }
        this.countsByType.set(counts);
      },
      error: () => {
        this.loading.set(false);
        this.failed.set(true);
      },
      complete: () => this.loading.set(false),
    });
  }
}
