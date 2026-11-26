import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AuthSession } from '@mapit/auth';
import { provideFeatureFlags } from '@mapit/feature-flags';
import { expect, it, vi } from 'vitest';
import { AdminShell } from './admin-shell';

it('keeps the notification entry hidden for SUPER_ADMIN when OFF without establishment context or notification HTTP', async () => {
  await TestBed.configureTestingModule({
    imports: [AdminShell],
    providers: [
      provideRouter([]),
      provideHttpClient(),
      provideHttpClientTesting(),
      provideFeatureFlags({ proxyUrl: '' }),
      {
        provide: AuthSession,
        useValue: {
          revision: signal(1),
          user: signal({
            id: '00000000-0000-0000-0000-000000000001',
            tenantId: 'platform',
            fullName: 'Admin',
            role: 'SUPER_ADMIN',
          }),
          logout: vi.fn(),
        },
      },
    ],
  }).compileComponents();
  const fixture = TestBed.createComponent(AdminShell);
  fixture.detectChanges();
  const root = fixture.nativeElement as HTMLElement;
  expect(root.querySelector('mapit-notification-center')).not.toBeNull();
  expect(root.querySelector('mapit-notification-center button')).toBeNull();
  expect(root.querySelector('.user-name')?.textContent).toBe('Admin');
  TestBed.inject(HttpTestingController).verify();
});
