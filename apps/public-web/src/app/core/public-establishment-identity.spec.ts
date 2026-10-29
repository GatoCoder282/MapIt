import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { BASE_PATH } from '@mapit/api-client';
import { PublicEstablishmentIdentity } from './public-establishment-identity';

describe('PublicEstablishmentIdentity', () => {
  beforeEach(() =>
    TestBed.configureTestingModule({
      imports: [PublicEstablishmentIdentity],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: BASE_PATH, useValue: '/api/v1' },
      ],
    }),
  );
  it('cancela el local anterior y solo presenta la información del local actual', () => {
    const fixture = TestBed.createComponent(PublicEstablishmentIdentity);
    const http = TestBed.inject(HttpTestingController);
    fixture.componentRef.setInput('tenantSlug', 'empresa');
    fixture.componentRef.setInput('establishmentSlug', 'centro');
    fixture.detectChanges();
    const old = http.expectOne('/api/v1/public/tenants/empresa/establishments/centro');
    fixture.componentRef.setInput('establishmentSlug', 'norte');
    fixture.detectChanges();
    expect(old.cancelled).toBe(true);
    http.expectOne('/api/v1/public/tenants/empresa/establishments/norte').flush({
      id: 'norte',
      tenantName: 'Empresa Real',
      name: 'Local Norte',
      address: 'Avenida Norte',
      establishmentSlug: 'norte',
      timezone: 'America/La_Paz',
    });
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Local Norte');
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Empresa Real');
    fixture.destroy();
    http.verify();
  });
  it('ofrece reintento ante error sin inventar información del establecimiento', () => {
    const fixture = TestBed.createComponent(PublicEstablishmentIdentity);
    const http = TestBed.inject(HttpTestingController);
    fixture.componentRef.setInput('tenantSlug', 'empresa');
    fixture.componentRef.setInput('establishmentSlug', 'norte');
    fixture.detectChanges();
    http
      .expectOne('/api/v1/public/tenants/empresa/establishments/norte')
      .flush({}, { status: 404, statusText: 'Not Found' });
    fixture.detectChanges();
    const button = (fixture.nativeElement as HTMLElement).querySelector('button')!;
    expect(button.textContent).toContain('Reintentar');
    button.click();
    fixture.detectChanges();
    http.expectOne('/api/v1/public/tenants/empresa/establishments/norte').flush({
      id: 'norte',
      tenantName: 'Empresa Real',
      name: 'Local Norte',
      address: null,
      establishmentSlug: 'norte',
      timezone: 'UTC',
    });
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'Sin dirección registrada',
    );
    fixture.destroy();
    http.verify();
  });
});
