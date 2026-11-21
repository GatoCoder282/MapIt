import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import { FeatureFlagService } from '@mapit/feature-flags';
import { BusinessApplicationApi } from '../data/business-application-api';
import { BusinessApplicationPage } from './business-application-page';

describe('BusinessApplicationPage', () => {
  it('oculta el formulario con la flag apagada y lo presenta al activarla', () => {
    const enabled = signal(false);
    TestBed.configureTestingModule({
      imports: [BusinessApplicationPage],
      providers: [
        provideRouter([]),
        { provide: FeatureFlagService, useValue: { isEnabled: () => enabled } },
        { provide: BusinessApplicationApi, useValue: { submit: vi.fn() } },
      ],
    });
    const fixture = TestBed.createComponent(BusinessApplicationPage);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('form')).toBeNull();
    expect(root.querySelector('[role="status"]')?.textContent).toContain('no están disponibles');
    enabled.set(true);
    fixture.detectChanges();
    expect(root.querySelectorAll('form input')).toHaveLength(5);
    expect(root.querySelector('form select')).not.toBeNull();
    expect(root.querySelector('button[type="submit"]')).not.toBeNull();
  });
});
