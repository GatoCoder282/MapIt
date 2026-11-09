import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { App } from './app';
import { routes } from './app.routes';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '<main>Contenido de la ruta</main>',
})
class RoutedPage {}

describe('App', () => {
  it('opens checkout for a created reservation and preserves its access fragment', async () => {
    const booking = routes.find(
      (route) => route.path === 'reservar/:tenantSlug/:establishmentSlug/:elementId',
    )!;
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: booking.path!, canActivate: booking.canActivate!, component: RoutedPage },
          { path: 'pago/:tenantSlug/:establishmentSlug/:reservationId', component: RoutedPage },
        ]),
      ],
    });
    const router = TestBed.inject(Router);
    await router.navigateByUrl(
      '/reservar/company/venue/space?reservationId=reservation#access=capability',
    );
    expect(router.url).toBe('/pago/company/venue/reservation#access=capability');
    await router.navigateByUrl('/reservar/company/venue/space?date=2030-12-24');
    expect(router.url).toBe('/reservar/company/venue/space?date=2030-12-24');
  });
  it('mantiene un único navbar compacto al cambiar entre páginas públicas', async () => {
    TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideRouter([
          { path: '', component: RoutedPage },
          { path: 'negocios', component: RoutedPage },
          { path: 'reservas', component: RoutedPage },
          { path: 'como-funciona', component: RoutedPage },
          { path: 'acerca-de-mapit', component: RoutedPage },
        ]),
      ],
    });
    const fixture = TestBed.createComponent(App);
    const router = TestBed.inject(Router);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    const nav = root.querySelector('mapit-ui-site-nav');
    for (const path of ['/', '/negocios', '/reservas', '/como-funciona', '/acerca-de-mapit']) {
      await router.navigateByUrl(path);
      fixture.detectChanges();
      expect(root.querySelectorAll('mapit-ui-site-nav')).toHaveLength(1);
      expect(root.querySelector('mapit-ui-site-nav')).toBe(nav);
      expect(nav?.querySelector('.nav-wordmark')?.textContent).toBe('MapIt');
      expect(nav?.querySelector('.nav-actions')).toBeNull();
      expect(root.querySelector('main')).not.toBeNull();
    }
    expect(nav?.querySelector('.nav-links a')?.textContent).toContain('Acerca de MapIt');
    await router.navigateByUrl('/como-funciona');
    fixture.detectChanges();
    expect(nav?.querySelector('.nav-actions')).toBeNull();
    expect(nav?.querySelector('[aria-current="page"]')?.textContent).toContain('Cómo funciona');
    fixture.destroy();
  });
});
