import { Injectable, inject } from '@angular/core';
import {
  EstablishmentsService,
  OperationsService,
  PeopleService,
  ReservationsService,
  TenantsService,
} from '@mapit/api-client';
import type {
  ElementStateSummary,
  Establishment,
  Person,
  Reservation,
  TenantPage,
} from '@mapit/api-client';
import { catchError, of } from 'rxjs';
import type { Observable } from 'rxjs';

/**
 * Llamadas del dashboard de inicio (CU-10). Cada fuente aísla su error con
 * `catchError(() => of(null))`: un 403 de una fuente no puede tumbar el resto
 * del panel. null = fallo; el reparto de estados lo hace el store.
 */
@Injectable({ providedIn: 'root' })
export class HomeData {
  private readonly establishmentsService = inject(EstablishmentsService);
  private readonly tenantsService = inject(TenantsService);
  private readonly operationsService = inject(OperationsService);
  private readonly reservationsService = inject(ReservationsService);
  private readonly peopleService = inject(PeopleService);

  /** GET /establishments — negocios del tenant. */
  listEstablishments(): Observable<Establishment[] | null> {
    return this.establishmentsService.listEstablishments().pipe(catchError(() => of(null)));
  }

  /** GET /tenants?size=1 — solo para el KPI de plataforma del SUPER_ADMIN. */
  listTenants(): Observable<TenantPage | null> {
    return this.tenantsService.listTenants({ size: 1 }).pipe(catchError(() => of(null)));
  }

  /** GET /element-states/summary — foto de la ocupación del tenant. */
  summarizeElementStates(): Observable<ElementStateSummary | null> {
    return this.operationsService.summarizeSpaceElementStates().pipe(catchError(() => of(null)));
  }

  /**
   * GET /reservations — reservas del tenant. Array plano sin paginación: es
   * un techo documentado del contrato, pensado para métricas agregadas.
   */
  listReservations(): Observable<Reservation[] | null> {
    return this.reservationsService.listReservations().pipe(catchError(() => of(null)));
  }

  /** GET /people — personas activas del tenant. */
  searchPeople(): Observable<Person[] | null> {
    return this.peopleService.searchPeople().pipe(catchError(() => of(null)));
  }
}
