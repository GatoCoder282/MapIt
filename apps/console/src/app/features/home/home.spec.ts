import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { of, throwError } from 'rxjs';

import { Home } from './home';
import { TenantsService, EstablishmentsService } from '@mapit/api-client';
import type { Establishment, EstablishmentType, Tenant } from '@mapit/api-client';
import { AuthSession } from '@mapit/auth';
import { STRINGS } from '../../core/strings';
import { vi } from 'vitest';

const tenant = (status: 'ACTIVE' | 'SUSPENDED'): Partial<Tenant> => ({ status });

const establishment = (type: EstablishmentType): Partial<Establishment> => ({
  id: crypto.randomUUID(),
  name: 'Negocio',
  type,
  slug: 'negocio',
  timezone: 'America/La_Paz',
  createdAt: '',
  updatedAt: '',
});

describe('Home (dashboard de administrador)', () => {
  let fixture: ComponentFixture<Home>;

  const tenantsService = { listTenants: vi.fn() };
  const establishmentsService = { listEstablishments: vi.fn() };

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [Home],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        { provide: TenantsService, useValue: tenantsService },
        { provide: EstablishmentsService, useValue: establishmentsService },
        { provide: AuthSession, useValue: { user: vi.fn(() => null) } },
      ],
    });
    fixture = TestBed.createComponent(Home);
  });

  it('carga KPIs de tenants y distribución de establecimientos (CA-1, CA-2)', () => {
    tenantsService.listTenants.mockReturnValue(
      of({
        content: [tenant('ACTIVE'), tenant('ACTIVE'), tenant('SUSPENDED')],
        page: 0,
        size: 1,
        totalElements: 3,
        totalPages: 1,
      }),
    );
    establishmentsService.listEstablishments.mockReturnValue(
      of([establishment('RESTAURANT'), establishment('RESTAURANT'), establishment('HOTEL')]),
    );

    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('3'); // total tenants
    expect(compiled.textContent).toContain('2'); // active tenants + 2 restaurantes
    expect(compiled.textContent).toContain('1'); // suspendidos + 1 hotel
    expect(compiled.textContent).toContain(STRINGS.adminDashboardHome.byTypeTitle);
  });

  it('muestra error y permite reintentar cuando la API falla (CA-3)', () => {
    tenantsService.listTenants.mockReturnValue(throwError(() => new Error('caída')));

    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain(STRINGS.adminDashboardHome.loadError);
    const button = compiled.querySelector('button');
    expect(button).not.toBeNull();
    expect(button!.textContent).toContain('Reintentar');

    tenantsService.listTenants.mockReturnValue(
      of({ content: [], page: 0, size: 1, totalElements: 0, totalPages: 0 }),
    );
    establishmentsService.listEstablishments.mockReturnValue(of([]));
    button!.click();
    fixture.detectChanges();

    expect(compiled.textContent).not.toContain(STRINGS.adminDashboardHome.loadError);
  });
});
