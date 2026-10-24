import { Injectable, inject } from '@angular/core';
import { TenantsService } from '@mapit/api-client';
import type { Tenant, TenantPage, TenantStatus } from '@mapit/api-client';
import { catchError, forkJoin, map, of, switchMap } from 'rxjs';
import type { Observable } from 'rxjs';

/** Techo por petición del backend (`MAX_PAGE_SIZE`): el contrato pagina de 100 en 100. */
const TAMANO_PAGINA = 100;

/** Parámetros de una página de la tabla. */
export interface PaginaParams {
  readonly page: number;
  readonly size: number;
  readonly search?: string;
  readonly status?: TenantStatus;
}

/**
 * El resumen del panel: **todos** los tenants de la plataforma y el total que
 * declara el servidor. Las métricas (altas, verticales, atención) se calculan
 * sobre esta base, nunca sobre la página visible de la tabla.
 */
export interface ResumenTenants {
  readonly tenants: readonly Tenant[];
  readonly total: number;
}

/**
 * Llamadas del panel de plataforma (SUPER_ADMIN). Cada fuente aísla su error
 * con `catchError(() => of(null))`: un fallo no puede tumbar a la otra fuente.
 * `null` = fallo; el store conserva lo que ya tenía y marca `fallando`.
 */
@Injectable({ providedIn: 'root' })
export class DashboardApi {
  private readonly client = inject(TenantsService);

  /** GET /tenants — la página pedida de la tabla, con sus filtros. */
  pagina(params: PaginaParams): Observable<TenantPage | null> {
    return this.client.listTenants(params).pipe(catchError(() => of(null)));
  }

  /**
   * GET /tenants — todas las páginas, de 100 en 100: la base del resumen.
   *
   * El backend pagina a lo sumo de 100, así que una sola petición con
   * `size: 100` basta hasta 100 tenants; con más, se piden aquí las páginas
   * restantes en la misma carga para que los conteos sean exactos. El total
   * es el `totalElements` de la primera respuesta (el que declara el
   * servidor), nunca una suma de filas.
   */
  todos(): Observable<ResumenTenants | null> {
    return this.client.listTenants({ page: 0, size: TAMANO_PAGINA }).pipe(
      switchMap((primera): Observable<ResumenTenants> => {
        if (primera.totalPages <= 1) {
          return of({ tenants: primera.content, total: primera.totalElements });
        }
        const numeros = Array.from({ length: primera.totalPages - 1 }, (_, indice) => indice + 1);
        return forkJoin(
          numeros.map((page) => this.client.listTenants({ page, size: TAMANO_PAGINA })),
        ).pipe(
          map((resto) => ({
            tenants: [...primera.content, ...resto.flatMap((pagina) => pagina.content)],
            total: primera.totalElements,
          })),
        );
      }),
      catchError(() => of(null)),
    );
  }
}
