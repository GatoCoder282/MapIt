import { ChangeDetectionStrategy, Component, computed, inject, type OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  LucideArrowRight,
  LucideBuilding2,
  LucideCalendarDays,
  LucideCalendarPlus,
  LucideChevronRight,
  LucideClock,
  LucideLayers,
  LucideLayoutTemplate,
  LucideShieldCheck,
  LucideTrendingDown,
  LucideTrendingUp,
  LucideZap,
} from '@lucide/angular';
import { AuthSession } from '@mapit/auth';
import { currentLocaleTag, I18nService, LocalizedNumberPipe } from '@mapit/i18n';

import { HomeStore } from '../model/home-store';
import { GrowthChart } from '../../../core/charts/growth-chart/growth-chart';
import { KpiCard } from '../ui/kpi-card/kpi-card';
import { OccupancyPanel } from '../ui/occupancy-panel/occupancy-panel';
import { ReservationsPanel } from '../ui/reservations-panel/reservations-panel';
import { STRINGS } from '../../../core/strings';

@Component({
  selector: 'mapit-home',
  imports: [
    RouterLink,
    LocalizedNumberPipe,
    GrowthChart,
    KpiCard,
    OccupancyPanel,
    ReservationsPanel,
    LucideArrowRight,
    LucideBuilding2,
    LucideCalendarDays,
    LucideLayers,
    LucideTrendingUp,
    LucideTrendingDown,
    LucideClock,
    LucideZap,
    LucideLayoutTemplate,
    LucideCalendarPlus,
    LucideShieldCheck,
    LucideChevronRight,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="layout">
      <main class="main">
        <header class="hero">
          <div class="hero-text">
            @if (session.user(); as user) {
              <p class="eyebrow">
                {{ strings.adminDashboardHome.heroEyebrow }} {{ user.fullName }}!
              </p>
            }
            <h1>{{ strings.adminDashboardHome.heroTitle }}</h1>
            <p class="sub">{{ strings.adminDashboardHome.heroSubtitle }}</p>
          </div>
          <div class="hero-actions">
            <div class="hero-decor" aria-hidden="true">
              <div class="hero-dots"></div>
              <span class="quarter"></span>
            </div>
          </div>
        </header>

        @if (store.loading()) {
          <section
            class="kpis"
            [class.kpis-3]="kpiCount() === 3"
            [class.kpis-4]="kpiCount() === 4"
            [attr.aria-label]="strings.adminDashboardHome.summaryTitle"
          >
            @for (item of kpiSkeletons(); track item) {
              <!-- El esqueleto no enseña etiqueta ni valor: la carga se anuncia sola. -->
              <mapit-kpi-card label="" value="" icon="building" [loading]="true" />
            }
          </section>
          <mapit-occupancy-panel data-testid="home-panel-ocupacion" [loading]="true" />
          <div class="split">
            <div
              class="card skeleton chart-skeleton"
              role="status"
              aria-busy="true"
              [attr.aria-label]="strings.adminDashboardHome.loading"
            ></div>
            <div
              class="card skeleton chart-skeleton"
              role="status"
              aria-busy="true"
              [attr.aria-label]="strings.adminDashboardHome.loading"
            ></div>
          </div>
          <div
            class="card skeleton table-skeleton"
            role="status"
            aria-busy="true"
            [attr.aria-label]="strings.adminDashboardHome.loading"
          ></div>
        } @else if (store.establishments() === null) {
          <div class="message error" role="alert">
            <p>{{ strings.adminDashboardHome.loadError }}</p>
            <button class="btn secondary" type="button" (click)="store.reload()">
              {{ strings.adminDashboardHome.retry }}
            </button>
          </div>
        } @else {
          <!-- KPIs -->
          <section
            class="kpis"
            [class.kpis-3]="kpiCount() === 3"
            [class.kpis-4]="kpiCount() === 4"
            [attr.aria-label]="strings.adminDashboardHome.summaryTitle"
          >
            <!-- KPI 1: Total de negocios + altas reales de la semana -->
            <mapit-kpi-card
              data-testid="home-kpi-negocios"
              [label]="strings.adminDashboardHome.kpiBusinesses"
              [value]="(store.totalEstablishments() | localNumber: locale()) ?? ''"
              icon="building"
              [delta]="store.weekGrowthPercent()"
              [deltaLabel]="strings.adminDashboardHome.kpiVsLastWeek"
              [context]="
                store.newThisWeek() +
                ' ' +
                (store.newThisWeek() === 1
                  ? strings.adminDashboardHome.kpiNewThisWeekOne
                  : strings.adminDashboardHome.kpiNewThisWeek)
              "
              [sparkline]="store.growthSeriesValues()"
            />

            <!-- KPI 2 (solo SUPER_ADMIN): Tenants registrados. Las plantillas y
                 el resto de métricas de configuración salen: no son métricas. -->
            @if (store.isSuperAdmin()) {
              <mapit-kpi-card
                data-testid="home-kpi-tenants"
                [label]="strings.adminDashboardHome.tenantsTotal"
                [value]="(store.tenantPage()?.totalElements ?? 0 | localNumber: locale()) ?? ''"
                icon="landmark"
                [context]="strings.adminDashboardHome.kpiInPlatform"
              />
            }

            <!-- KPI 3: Reservas del tenant. Si el rol no puede leerlas
                 (SUPER_ADMIN: 403), la fuente no se pide y no se inventa un 0:
                 se dice "Sin datos". -->
            <mapit-kpi-card
              data-testid="home-kpi-reservas"
              [label]="strings.adminDashboardHome.kpiReservations"
              [value]="
                store.reservations() === null
                  ? strings.adminDashboardHome.noValue
                  : ((store.totalReservations() | localNumber: locale()) ?? '')
              "
              icon="calendar"
              [delta]="store.reservationsWeekGrowthPercent()"
              [deltaLabel]="strings.adminDashboardHome.kpiReservationsVsLastWeek"
              [context]="
                store.reservations() === null
                  ? strings.adminDashboardHome.noData
                  : store.newReservationsThisWeek() +
                    ' ' +
                    (store.newReservationsThisWeek() === 1
                      ? strings.adminDashboardHome.kpiNewThisWeekOne
                      : strings.adminDashboardHome.kpiNewThisWeek)
              "
              [sparkline]="
                store.reservations() === null ? undefined : store.reservationsGrowthSeriesValues()
              "
            />

            <!-- KPI 4: % de ocupación. Sin serie real no hay sparkline: el
                 histórico de ocupación no existe todavía. -->
            <mapit-kpi-card
              data-testid="home-kpi-ocupacion"
              [label]="strings.adminDashboardHome.kpiOccupancy"
              [value]="occupancyValue()"
              icon="percent"
              [context]="
                store.porcentajeOcupacion() === null
                  ? strings.adminDashboardHome.noData
                  : (store.elementosOperativos() | localNumber: locale()) +
                    ' ' +
                    strings.adminDashboardHome.kpiOccupancyOperable
              "
            />
          </section>

          <!-- Ocupación en vivo: el presente de la sala. Va antes que los
               gráficos porque los gráficos son historia. -->
          <mapit-occupancy-panel
            data-testid="home-panel-ocupacion"
            [counts]="store.conteoPorEstado()"
            [total]="store.totalElementos()"
            [loading]="store.resumenCargando()"
            [failed]="store.resumenError()"
            [connection]="store.conexionRealtime()"
            (retry)="store.refrescarResumenEstados()"
          />

          <div class="split">
            <!-- Crecimiento: línea + área sobre ECharts -->
            <section class="panel growth" data-testid="home-panel-crecimiento">
              <header class="panel-header">
                <span class="panel-icon" aria-hidden="true"><svg lucideTrendingUp></svg></span>
                <div class="panel-title-group">
                  <h2>{{ strings.adminDashboardHome.growthTitle }}</h2>
                  <p class="muted">{{ strings.adminDashboardHome.growthSubtitle }}</p>
                </div>
                <p class="panel-total">
                  <strong>{{ store.growthPeriodTotal() }}</strong>
                  <span class="muted">{{ strings.adminDashboardHome.periodTotalAltas }}</span>
                </p>
                <select
                  #growthRange
                  class="range-select"
                  name="growthRange"
                  [attr.aria-label]="strings.adminDashboardHome.rangeLabelGrowth"
                  (change)="store.setRangeFromValue(growthRange.value)"
                >
                  @for (option of strings.adminDashboardHome.rangeOptions; track option.weeks) {
                    <option
                      [value]="'' + option.weeks"
                      [selected]="option.weeks === store.rangeWeeks()"
                    >
                      {{ option.label }}
                    </option>
                  }
                </select>
              </header>
              <mapit-growth-chart
                [series]="store.growthSeries()"
                [ariaLabel]="growthAria()"
                [periodLabel]="strings.adminDashboardHome.growthPeriod"
                [empty]="store.growthIsEmpty()"
                [rangeWeeks]="store.rangeWeeks()"
              />
              <footer class="panel-footer">
                @let growthComparison = store.growthPeriodDelta();
                @let growthChange = growthComparison.percent ?? growthComparison.absolute;
                @if (store.growthPeriodTotal() > 0) {
                  <span
                    class="footer-delta"
                    [class.positive]="growthChange > 0"
                    [class.negative]="growthChange < 0"
                  >
                    @if (growthChange >= 0) {
                      <svg class="footer-delta-icon" lucideTrendingUp aria-hidden="true"></svg>
                    } @else {
                      <svg class="footer-delta-icon" lucideTrendingDown aria-hidden="true"></svg>
                    }
                    @if (growthComparison.percent !== null) {
                      {{ growthChange > 0 ? '+' : '' }}{{ growthChange }}%
                    } @else {
                      {{ growthChange > 0 ? '+' : '' }}{{ growthChange }}
                      {{ strings.adminDashboardHome.periodTotalAltas }}
                    }
                    <span class="muted">{{ strings.adminDashboardHome.periodDeltaVsFirst }}</span>
                  </span>
                }
                <a
                  class="view-all-link"
                  routerLink="/establishments"
                  [attr.aria-label]="strings.adminDashboardHome.chartViewAllAria"
                >
                  {{ strings.adminDashboardHome.chartViewAll }}
                  <svg class="view-all-icon" lucideArrowRight aria-hidden="true"></svg>
                </a>
              </footer>
            </section>

            <!-- Crecimiento de reservas: el mismo gráfico con otra serie -->
            <section class="panel growth" data-testid="home-panel-crecimiento-reservas">
              <header class="panel-header">
                <span class="panel-icon" aria-hidden="true"><svg lucideCalendarDays></svg></span>
                <div class="panel-title-group">
                  <h2>{{ strings.adminDashboardHome.reservationsGrowthTitle }}</h2>
                  <p class="muted">{{ strings.adminDashboardHome.reservationsGrowthSubtitle }}</p>
                </div>
                <p class="panel-total">
                  <strong>{{ store.reservationsPeriodTotal() }}</strong>
                  <span class="muted">{{ strings.adminDashboardHome.periodTotalReservas }}</span>
                </p>
                <select
                  #reservationsRange
                  class="range-select"
                  name="reservationsRange"
                  [attr.aria-label]="strings.adminDashboardHome.rangeLabelReservations"
                  (change)="store.setRangeFromValue(reservationsRange.value)"
                >
                  @for (option of strings.adminDashboardHome.rangeOptions; track option.weeks) {
                    <option
                      [value]="'' + option.weeks"
                      [selected]="option.weeks === store.rangeWeeks()"
                    >
                      {{ option.label }}
                    </option>
                  }
                </select>
              </header>
              <mapit-growth-chart
                [series]="store.reservationsGrowthSeries()"
                [ariaLabel]="reservationsGrowthAria()"
                [periodLabel]="strings.adminDashboardHome.reservationsGrowthPeriod"
                [empty]="store.reservationsIsEmpty()"
                [rangeWeeks]="store.rangeWeeks()"
              />
              <footer class="panel-footer">
                @let reservationsComparison = store.reservationsPeriodDelta();
                @let reservationsChange =
                  reservationsComparison.percent ?? reservationsComparison.absolute;
                @if (store.reservationsPeriodTotal() > 0) {
                  <span
                    class="footer-delta"
                    [class.positive]="reservationsChange > 0"
                    [class.negative]="reservationsChange < 0"
                  >
                    @if (reservationsChange >= 0) {
                      <svg class="footer-delta-icon" lucideTrendingUp aria-hidden="true"></svg>
                    } @else {
                      <svg class="footer-delta-icon" lucideTrendingDown aria-hidden="true"></svg>
                    }
                    @if (reservationsComparison.percent !== null) {
                      {{ reservationsChange > 0 ? '+' : '' }}{{ reservationsChange }}%
                    } @else {
                      {{ reservationsChange > 0 ? '+' : '' }}{{ reservationsChange }}
                      {{ strings.adminDashboardHome.periodTotalReservas }}
                    }
                    <span class="muted">{{ strings.adminDashboardHome.periodDeltaVsFirst }}</span>
                  </span>
                }
                <a
                  class="view-all-link"
                  routerLink="/establishments"
                  [attr.aria-label]="strings.adminDashboardHome.chartViewAllAria"
                >
                  {{ strings.adminDashboardHome.chartViewAll }}
                  <svg class="view-all-icon" lucideArrowRight aria-hidden="true"></svg>
                </a>
              </footer>
            </section>
          </div>

          <!-- Reservas y pagos: personas con dato real; pagos sin fuente de datos -->
          <mapit-reservations-panel
            data-testid="home-panel-reservas-pagos"
            [peopleTotal]="
              store.people() === null
                ? strings.adminDashboardHome.noValue
                : ((store.totalPeople() | localNumber: locale()) ?? '')
            "
            [peopleDelta]="store.peopleWeekGrowthPercent()"
            [peopleNewThisWeek]="store.newPeopleThisWeek()"
            [peopleAvailable]="store.people() !== null"
            [peopleSparkline]="
              store.people() === null ? undefined : store.peopleGrowthSeriesValues()
            "
          />
        }
      </main>

      <aside class="aside">
        <section class="panel" data-testid="home-panel-accesos-rapidos">
          <header class="panel-header">
            <span class="panel-icon" aria-hidden="true"><svg lucideZap></svg></span>
            <h2>{{ strings.adminDashboardHome.quickTitle }}</h2>
          </header>
          <nav class="quick-list" [attr.aria-label]="strings.adminDashboardHome.quickTitle">
            <a
              class="quick"
              routerLink="/establishments"
              data-testid="home-quick-registrar-negocio"
            >
              <span class="quick-icon" aria-hidden="true"><svg lucideBuilding2></svg></span>
              <span class="quick-text">
                <strong>{{ strings.adminDashboardHome.quickRegister }}</strong>
                <span class="muted">{{ strings.adminDashboardHome.quickRegisterDesc }}</span>
              </span>
              <svg class="chevron" lucideChevronRight aria-hidden="true"></svg>
            </a>
            <a class="quick" routerLink="/spaces/setup" data-testid="home-quick-estructura">
              <span class="quick-icon" aria-hidden="true"><svg lucideLayers></svg></span>
              <span class="quick-text">
                <strong>{{ strings.adminDashboardHome.quickStructure }}</strong>
                <span class="muted">{{ strings.adminDashboardHome.quickStructureDesc }}</span>
              </span>
              <svg class="chevron" lucideChevronRight aria-hidden="true"></svg>
            </a>
            <a class="quick" routerLink="/spaces/templates" data-testid="home-quick-plantillas">
              <span class="quick-icon" aria-hidden="true"><svg lucideLayoutTemplate></svg></span>
              <span class="quick-text">
                <strong>{{ strings.adminDashboardHome.quickTemplates }}</strong>
                <span class="muted">{{ strings.adminDashboardHome.quickTemplatesDesc }}</span>
              </span>
              <svg class="chevron" lucideChevronRight aria-hidden="true"></svg>
            </a>
            <a class="quick" routerLink="/reservations/new" data-testid="home-quick-nueva-reserva">
              <span class="quick-icon" aria-hidden="true"><svg lucideCalendarPlus></svg></span>
              <span class="quick-text">
                <strong>{{ strings.adminDashboardHome.quickReservation }}</strong>
                <span class="muted">{{ strings.adminDashboardHome.quickReservationDesc }}</span>
              </span>
              <svg class="chevron" lucideChevronRight aria-hidden="true"></svg>
            </a>
            @if (store.isSuperAdmin()) {
              <a class="quick" routerLink="/admin/tenants" data-testid="home-quick-plataforma">
                <span class="quick-icon" aria-hidden="true"><svg lucideShieldCheck></svg></span>
                <span class="quick-text">
                  <strong>{{ strings.adminDashboardHome.quickPlatform }}</strong>
                  <span class="muted">{{ strings.adminDashboardHome.quickPlatformDesc }}</span>
                </span>
                <svg class="chevron" lucideChevronRight aria-hidden="true"></svg>
              </a>
            }
          </nav>
        </section>

        <section class="panel" data-testid="home-panel-actividad">
          <header class="panel-header">
            <span class="panel-icon" aria-hidden="true"><svg lucideClock></svg></span>
            <div class="panel-title-group">
              <h2>{{ strings.adminDashboardHome.activityTitle }}</h2>
            </div>
            <a class="view-all-link" routerLink="/establishments">
              {{ strings.adminDashboardHome.activityViewAll }}
            </a>
          </header>
          @if (store.activityItems().length === 0) {
            <p class="empty-state">{{ strings.adminDashboardHome.activityEmpty }}</p>
          } @else {
            <ul class="activity-list">
              @for (item of store.activityItems(); track item.id) {
                <li class="activity-item">
                  <span class="activity-dot" aria-hidden="true"></span>
                  <span class="activity-body">
                    <strong>{{ item.name }}</strong>
                    <span class="muted">
                      {{ strings.adminDashboardHome.activityRegistered }} ·
                      {{ item.relative }}
                    </span>
                  </span>
                </li>
              }
            </ul>
          }
        </section>

        <section class="cta" data-testid="home-panel-cta">
          <div class="cta-content">
            <h2>{{ strings.adminDashboardHome.ctaTitle }}</h2>
            <p>{{ strings.adminDashboardHome.ctaBody }}</p>
            <a class="btn cta-btn" routerLink="/establishments">
              {{ strings.adminDashboardHome.ctaButton }}
            </a>
          </div>
          <div class="cta-decor" aria-hidden="true">
            <span class="cta-dots"></span>
            <span class="cta-circle"></span>
          </div>
        </section>
      </aside>
    </div>
  `,
  styles: `
    /* ── Shimmer ─────────────────────────────────────────────── */
    @keyframes shimmer {
      from {
        background-position: 200% 0;
      }
      to {
        background-position: -200% 0;
      }
    }

    /* ── Layout ──────────────────────────────────────────────── */
    .layout {
      display: grid;
      grid-template-columns: minmax(0, 1fr) 22rem;
      gap: var(--mapit-space-6);
      max-width: 95rem;
      margin-inline: auto;
      padding: var(--mapit-space-6);
      background: var(--mapit-color-canvas);
      min-height: calc(100vh - var(--mapit-topbar-height));
    }
    @media (max-width: 1200px) {
      .layout {
        grid-template-columns: 1fr;
        max-width: 100%;
      }
      .aside {
        display: none;
      }
    }
    @media (max-width: 900px) {
      .layout {
        padding: var(--mapit-space-4);
        gap: var(--mapit-space-4);
      }
    }
    .main {
      display: grid;
      gap: var(--mapit-space-4);
      align-content: start;
      min-width: 0;
    }
    .aside {
      display: grid;
      gap: var(--mapit-space-4);
      align-content: start;
      min-width: 0;
    }

    /* ── Hero compacto ───────────────────────────────────────── */
    .hero {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: var(--mapit-space-4);
      padding: 0 0 var(--mapit-space-2);
      position: relative;
    }
    .hero-text {
      min-width: 0;
    }
    .hero-text .eyebrow {
      margin: 0;
      font: var(--mapit-text-caps);
      color: var(--mapit-color-primary);
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }
    .hero-text h1 {
      margin: var(--mapit-space-1) 0 0;
      font-family: var(--mapit-font-display);
      font-size: 1.75rem;
      font-weight: 700;
      line-height: 1.2;
      color: var(--mapit-color-text);
      max-width: 30ch;
      text-wrap: balance;
    }
    .hero-text .sub {
      margin: var(--mapit-space-1) 0 0;
      font: var(--mapit-text-body);
      color: var(--mapit-color-text-muted);
      max-width: 52ch;
    }
    .hero-actions {
      display: flex;
      align-items: center;
      gap: var(--mapit-space-4);
      flex: none;
    }
    .hero-decor {
      width: 13rem;
      height: 7rem;
      position: relative;
    }
    .hero-dots {
      position: absolute;
      left: 0;
      top: 0;
      width: 7rem;
      height: 7rem;
      z-index: 0;
      background-image: radial-gradient(
        circle,
        var(--mapit-color-primary) 1.5px,
        transparent 1.5px
      );
      background-size: 11px 11px;
      opacity: 0.22;
    }
    .hero-decor .quarter {
      position: absolute;
      right: 0;
      top: 0;
      width: 7rem;
      height: 7rem;
      z-index: 1;
      background: var(--mapit-color-primary);
      border-radius: 100% 0 0 0;
      opacity: 0.95;
    }
    @media (max-width: 640px) {
      .hero {
        flex-direction: column;
        align-items: flex-start;
      }
      .hero-decor {
        display: none;
      }
    }

    /* ── Fila de KPIs ──────────────────────────────────────────
       3 KPIs (4 con "Tenants registrados" del SUPER_ADMIN). La rejilla
       depende del número real de tarjetas: 4 → 2+2, 3 → en fila. Nunca queda
       una tarjeta suelta en una esquina. */
    .kpis {
      display: grid;
      gap: var(--mapit-space-4);
    }
    .kpis-4 {
      grid-template-columns: repeat(4, minmax(0, 1fr));
    }
    .kpis-3 {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }
    @media (max-width: 1399px) {
      /* Con 4 tarjetas, 2+2 fills la fila: 4 en línea serían demasiado
         estrechas en el ancho del main con el aside al lado. */
      .kpis-4 {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
    }
    @media (max-width: 1023px) {
      .kpis-3 {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
      /* Con 3 tarjetas en 2 columnas, la tercera ocupa la fila entera: mejor
         una tarjeta ancha que una suelta en una esquina. */
      .kpis-3 > mapit-kpi-card:last-child {
        grid-column: 1 / -1;
      }
    }
    @media (max-width: 639px) {
      .kpis-4,
      .kpis-3 {
        grid-template-columns: 1fr;
      }
    }

    .card {
      background: var(--mapit-color-surface);
      border: 1px solid var(--mapit-color-border);
      border-radius: var(--mapit-radius-lg);
      box-shadow: var(--mapit-shadow);
    }

    .chart-skeleton,
    .table-skeleton {
      background: linear-gradient(
        90deg,
        var(--mapit-color-border) 25%,
        var(--mapit-color-canvas) 50%,
        var(--mapit-color-border) 75%
      );
      background-size: 200%;
      animation: shimmer 1.5s ease-in-out infinite;
    }
    .chart-skeleton {
      min-height: 16rem;
    }
    .table-skeleton {
      min-height: 12rem;
    }
    @media (prefers-reduced-motion: reduce) {
      .chart-skeleton,
      .table-skeleton {
        animation: none;
        background: var(--mapit-color-border);
      }
      .quick,
      .btn.secondary,
      .cta-btn {
        transition: none;
      }
    }

    /* ── Paneles ─────────────────────────────────────────────── */
    .panel {
      background: var(--mapit-color-surface);
      border: 1px solid var(--mapit-color-border);
      border-radius: var(--mapit-radius-lg);
      box-shadow: var(--mapit-shadow);
      padding: var(--mapit-space-4);
      display: grid;
      gap: var(--mapit-space-4);
      min-width: 0;
    }
    .panel-header {
      display: flex;
      gap: var(--mapit-space-3);
      align-items: center;
      /* En pantallas estrechas el header baja de línea antes de apretar el título. */
      flex-wrap: wrap;
    }
    .panel-title-group {
      min-width: 8rem;
      /* El grupo cede espacio antes de dejar el título ilegible; si no cabe el
         control de la derecha, baja a la línea siguiente. */
      flex: 1 1 8rem;
    }
    .panel-header h2 {
      margin: 0;
      font: var(--mapit-text-section);
      font-size: 1.125rem;
      font-weight: 700;
      color: var(--mapit-color-text);
      text-wrap: balance;
    }
    .panel-icon,
    .quick-icon {
      flex: none;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 2.25rem;
      height: 2.25rem;
      background: var(--mapit-color-primary-container);
      color: var(--mapit-color-primary);
    }
    .panel-icon {
      border-radius: 50%;
    }
    .quick-icon {
      border-radius: var(--mapit-radius-lg);
    }
    .panel-icon svg,
    .quick-icon svg {
      width: 1.15rem;
      height: 1.15rem;
      stroke-width: 2;
    }
    /* Total del periodo en el header del panel: la cifra manda, la unidad
       acompaña. */
    .panel-total {
      display: inline-flex;
      align-items: baseline;
      gap: 0.25rem;
      margin: 0;
      white-space: nowrap;
    }
    .panel-total strong {
      font-family: var(--mapit-font-display);
      font-size: 1.25rem;
      font-weight: 700;
      line-height: 1.2;
      color: var(--mapit-color-text);
      font-variant-numeric: tabular-nums;
    }
    /* Selector de rango del periodo. Control nativo: el sistema lo dibuja con
       su flecha y su teclado, sin reimplementar el widget. */
    .range-select {
      flex: none;
      font: var(--mapit-text-metadata);
      font-weight: 600;
      color: var(--mapit-color-text);
      background-color: var(--mapit-color-surface);
      border: 1px solid var(--mapit-color-border-input);
      border-radius: var(--mapit-radius-input);
      padding: 0.3rem 0.5rem;
      cursor: pointer;
      white-space: nowrap;
    }
    .range-select:hover {
      border-color: var(--mapit-color-primary);
    }
    .range-select:focus-visible {
      outline: 2px solid var(--mapit-color-primary);
      outline-offset: 2px;
    }
    /* Pie del panel de gráfico: comparación del periodo a la izquierda, enlace
       al detalle a la derecha. */
    .panel-footer {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--mapit-space-3);
      flex-wrap: wrap;
      padding-top: var(--mapit-space-3);
      border-top: 1px solid var(--mapit-color-border);
    }
    .footer-delta {
      display: inline-flex;
      align-items: center;
      gap: var(--mapit-space-2);
      font-size: 0.75rem;
      font-weight: 600;
      line-height: 1.2;
      color: var(--mapit-color-text-variant);
    }
    .footer-delta.positive {
      color: var(--mapit-color-primary);
    }
    .footer-delta.negative {
      color: var(--mapit-color-error);
    }
    .footer-delta .muted {
      font-weight: 500;
    }
    .footer-delta-icon {
      flex: none;
      width: 0.85rem;
      height: 0.85rem;
    }
    .view-all-icon {
      width: 0.9rem;
      height: 0.9rem;
      margin-left: 0.15rem;
      vertical-align: -0.1rem;
    }
    .view-all-link {
      display: inline-flex;
      align-items: center;
      font-size: 0.8125rem;
      font-weight: 600;
      color: var(--mapit-color-primary);
      text-decoration: none;
      white-space: nowrap;
    }
    .view-all-link:hover {
      text-decoration: underline;
    }
    .view-all-link:focus-visible {
      outline: 2px solid var(--mapit-color-primary);
      outline-offset: 3px;
      border-radius: 2px;
    }
    .quick,
    .btn,
    .range-select,
    .view-all-link {
      touch-action: manipulation;
      -webkit-tap-highlight-color: var(--mapit-color-primary-container);
    }
    .muted {
      margin: 0;
      font: var(--mapit-text-metadata);
      color: var(--mapit-color-text-muted);
    }
    .empty-state {
      margin: 0;
      padding: var(--mapit-space-4);
      text-align: center;
      color: var(--mapit-color-text-muted);
      font: var(--mapit-text-body);
    }

    /* ── Split de dos gráficos ───────────────────────────────── */
    .split {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: var(--mapit-space-4);
      align-items: stretch;
    }
    .growth .panel-header {
      align-items: flex-start;
    }

    /* ── Actividad reciente ──────────────────────────────────── */
    .activity-list {
      list-style: none;
      margin: 0;
      padding: 0;
      display: grid;
      gap: var(--mapit-space-3);
    }
    .activity-item {
      display: flex;
      gap: var(--mapit-space-3);
      align-items: flex-start;
    }
    .activity-dot {
      flex: none;
      margin-top: 0.35rem;
      width: 0.5rem;
      height: 0.5rem;
      border-radius: 50%;
      background: var(--mapit-color-primary);
      box-shadow: 0 0 0 3px var(--mapit-color-primary-container);
    }
    .activity-body {
      display: grid;
      min-width: 0;
      gap: 0.1rem;
    }
    .activity-body strong {
      font: var(--mapit-text-body-bold);
      color: var(--mapit-color-text);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    /* ── Accesos rápidos ─────────────────────────────────────── */
    .quick-list {
      display: grid;
      gap: var(--mapit-space-2);
    }
    .quick {
      display: flex;
      gap: var(--mapit-space-3);
      align-items: center;
      padding: var(--mapit-space-3);
      background: var(--mapit-color-surface);
      border: 1px solid var(--mapit-color-border);
      border-radius: var(--mapit-radius-lg);
      text-decoration: none;
      color: var(--mapit-color-text);
      transition:
        background var(--mapit-duration-fast) var(--mapit-ease-out),
        border-color var(--mapit-duration-fast) var(--mapit-ease-out);
    }
    .quick:hover {
      background: var(--mapit-color-surface-low);
      border-color: var(--mapit-color-primary-container);
    }
    .quick:focus-visible {
      outline: 2px solid var(--mapit-color-primary);
      outline-offset: 2px;
    }
    .quick-icon {
      width: 2.25rem;
      height: 2.25rem;
    }
    .quick-text {
      display: grid;
      min-width: 0;
    }
    .quick-text strong {
      font: var(--mapit-text-body-bold);
      color: var(--mapit-color-text);
    }
    .chevron {
      flex: none;
      width: 1rem;
      height: 1rem;
      margin-left: auto;
      color: var(--mapit-color-text-muted);
    }

    /* ── CTA ─────────────────────────────────────────────────── */
    .cta {
      background: var(--mapit-color-primary);
      color: var(--mapit-color-on-primary);
      border-radius: var(--mapit-radius-xl);
      padding: var(--mapit-space-6);
      position: relative;
      overflow: hidden;
    }
    .cta-content {
      position: relative;
      z-index: 1;
      display: grid;
      gap: var(--mapit-space-3);
      justify-items: start;
    }
    .cta h2 {
      margin: 0;
      font: var(--mapit-text-section);
      font-size: 1.25rem;
      color: var(--mapit-color-on-primary);
    }
    .cta p {
      margin: 0;
      font: var(--mapit-text-body);
      opacity: 0.92;
      color: var(--mapit-color-on-primary);
    }
    .cta-decor {
      position: absolute;
      bottom: -2rem;
      right: -2rem;
      width: 14rem;
      height: 8rem;
      z-index: 0;
      pointer-events: none;
    }
    .cta-dots {
      position: absolute;
      left: 0;
      top: 1rem;
      width: 6rem;
      height: 6rem;
      background-image: radial-gradient(
        circle,
        var(--mapit-color-on-primary) 1.2px,
        transparent 1.2px
      );
      background-size: 10px 10px;
      opacity: 0.35;
    }
    .cta-circle {
      position: absolute;
      right: 0;
      bottom: 0;
      width: 8rem;
      height: 8rem;
      border-radius: 100% 0 0 0;
      background: var(--mapit-color-primary-hover);
    }

    /* ── Botones ─────────────────────────────────────────────── */
    .btn {
      display: inline-flex;
      align-items: center;
      gap: var(--mapit-space-2);
      padding: 0.55rem 1rem;
      border: 1px solid transparent;
      border-radius: var(--mapit-radius-lg);
      font: var(--mapit-text-body-bold);
      cursor: pointer;
      text-decoration: none;
    }
    .btn svg {
      width: 1rem;
      height: 1rem;
    }
    .btn:focus-visible {
      outline: 2px solid var(--mapit-color-primary);
      outline-offset: 2px;
    }
    .cta-btn {
      background: transparent;
      color: var(--mapit-color-on-primary);
      border-color: var(--mapit-color-on-primary);
    }
    .cta-btn:hover {
      background: var(--mapit-color-primary-hover);
    }
    .cta-btn:focus-visible {
      outline-color: var(--mapit-color-on-primary);
    }

    /* ── Error ───────────────────────────────────────────────── */
    .message.error {
      margin: 0;
      padding: var(--mapit-space-4);
      border-radius: var(--mapit-radius-lg);
      border: 1px solid var(--mapit-color-error);
      color: var(--mapit-color-error);
      background: var(--mapit-color-surface);
      display: grid;
      gap: var(--mapit-space-3);
      justify-items: start;
      font: var(--mapit-text-body);
    }
    .btn.secondary {
      background: var(--mapit-color-surface);
      border-color: var(--mapit-color-border);
      color: var(--mapit-color-text);
    }
    .btn.secondary:hover {
      background: var(--mapit-color-surface-low);
    }

    /* ── Responsive ──────────────────────────────────────────── */
    @media (max-width: 900px) {
      .split {
        grid-template-columns: 1fr;
      }
    }
    @media (max-width: 640px) {
      .panel {
        padding: var(--mapit-space-3);
      }
    }
  `,
})
export class Home implements OnInit {
  protected readonly session = inject(AuthSession);
  protected readonly locale = inject(I18nService).locale;
  protected readonly strings = STRINGS;
  protected readonly store = inject(HomeStore);

  /**
   * Porcentaje de ocupación con un decimal y coma decimal (español).
   *
   * <p>La app no registra los datos de locale `es`, así que el pipe `number`
   * resuelve en `en-US` ("62.5"). Aquí el separador importa: se formatea con
   * `Intl` explícito para que el KPI diga "62,5 %" y no "62.5 %".
   */
  /**
   * Número real de KPI de la fila: 3 para el resto de roles y 4 para el
   * SUPER_ADMIN (que además ve "Tenants registrados"). La rejilla se adapta
   * al número para que no quede ninguna tarjeta suelta.
   */
  protected readonly kpiCount = computed(() => (this.store.isSuperAdmin() ? 4 : 3));

  /** Índices de los esqueletos de carga: uno por KPI real. */
  protected readonly kpiSkeletons = computed(() =>
    Array.from({ length: this.kpiCount() }, (_, index) => index),
  );

  /**
   * Cifra del KPI de ocupación. `null` = no hay elementos operativos: se
   * muestra "—", nunca un 0 % que aparente una ocupación medida.
   */
  protected readonly occupancyValue = computed(() => {
    const percent = this.store.porcentajeOcupacion();
    return percent === null
      ? STRINGS.adminDashboardHome.noValue
      : `${new Intl.NumberFormat(currentLocaleTag(), {
          minimumFractionDigits: 1,
          maximumFractionDigits: 1,
        }).format(percent)} %`;
  });

  /** El nombre accesible del gráfico nombra el periodo que se está mirando. */
  protected readonly growthAria = computed(() =>
    STRINGS.adminDashboardHome.growthAria.replace('{weeks}', String(this.store.rangeWeeks())),
  );

  protected readonly reservationsGrowthAria = computed(() =>
    STRINGS.adminDashboardHome.reservationsGrowthAria.replace(
      '{weeks}',
      String(this.store.rangeWeeks()),
    ),
  );

  ngOnInit(): void {
    this.store.reload();
  }
}
