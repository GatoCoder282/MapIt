import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';
import { expect, it, vi } from 'vitest';
import { I18nService } from '@mapit/i18n';
import type { NotificationPreferences } from '@mapit/api-client';
import { NotificationSessionContext } from '../../../core/notification-session-context';
import { NotificationsApi } from '../data/notifications-api';
import { NotificationPreferencesComponent } from './notification-preferences';
it('shows only optional accessible controls, saves through HTTP and clears on logout', () => {
  const context = signal<{ tenantId: string; userId: string; sessionId: string } | null>({
    tenantId: 'tenant-a',
    userId: 'a',
    sessionId: 'a',
  });
  const reply = new Subject<NotificationPreferences>();
  const ack = new Subject<NotificationPreferences>();
  const api = { preferences: vi.fn(() => reply), updatePreferences: vi.fn(() => ack) };
  TestBed.configureTestingModule({
    imports: [NotificationPreferencesComponent],
    providers: [
      { provide: NotificationsApi, useValue: api },
      { provide: NotificationSessionContext, useValue: { context, enabled: signal(true) } },
    ],
  });
  TestBed.inject(I18nService).setLanguage('es');
  const fixture = TestBed.createComponent(NotificationPreferencesComponent);
  fixture.detectChanges();
  const element = fixture.nativeElement as HTMLElement;
  const details = element.querySelector<HTMLDetailsElement>('details')!;
  details.open = true;
  details.dispatchEvent(new Event('toggle'));
  reply.next({ reservations: true, operations: true });
  fixture.detectChanges();
  const inputs = element.querySelectorAll<HTMLInputElement>('input');
  expect(inputs).toHaveLength(2);
  const reservationInput = inputs.item(0);
  expect(reservationInput.closest('label')).not.toBeNull();
  reservationInput.checked = false;
  reservationInput.dispatchEvent(new Event('change'));
  fixture.detectChanges();
  element.querySelector<HTMLButtonElement>('button')!.click();
  fixture.detectChanges();
  expect(api.updatePreferences).toHaveBeenCalledExactlyOnceWith({
    reservations: false,
    operations: true,
  });
  expect(element.querySelector<HTMLFieldSetElement>('fieldset')!.disabled).toBe(true);
  ack.next({ reservations: false, operations: true });
  fixture.detectChanges();
  expect(element.querySelector('[role=status]')!.textContent).toContain('guardadas');
  context.set(null);
  fixture.detectChanges();
  expect(element.querySelector('input')).toBeNull();
});
