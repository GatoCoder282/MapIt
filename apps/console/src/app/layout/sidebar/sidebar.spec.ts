import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Sidebar, type SidebarNavItem } from './sidebar';

describe('Sidebar jerárquico', () => {
  it('presenta Administración → Configuración → Métodos de pago y permite plegar con teclado', async () => {
    await TestBed.configureTestingModule({
      imports: [Sidebar],
      providers: [provideRouter([])],
    }).compileComponents();
    const fixture = TestBed.createComponent(Sidebar);
    const nav: SidebarNavItem[] = [
      {
        label: 'Administración',
        icon: 'settings',
        expandedByDefault: true,
        children: [
          {
            label: 'Configuración',
            icon: 'settings',
            expandedByDefault: true,
            children: [
              {
                label: 'Métodos de pago',
                icon: 'settings',
                route: '/administration/settings/payment-methods',
              },
            ],
          },
        ],
      },
    ];
    fixture.componentRef.setInput('nav', nav);
    fixture.componentRef.setInput('navLabel', 'Empresa');
    fixture.componentRef.setInput('navAriaLabel', 'Administración de empresa');
    fixture.componentRef.setInput('closeLabel', 'Cerrar');
    fixture.detectChanges();
    const rail = (fixture.nativeElement as HTMLElement).querySelector('nav')!;
    expect(rail.querySelector('a')?.getAttribute('href')).toBe(
      '/administration/settings/payment-methods',
    );
    const toggle = rail.querySelector('button')!;
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    toggle.click();
    fixture.detectChanges();
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(rail.querySelector('a')).toBeNull();
    toggle.click();
    fixture.detectChanges();
    expect(rail.querySelector('a')).not.toBeNull();
  });
});
