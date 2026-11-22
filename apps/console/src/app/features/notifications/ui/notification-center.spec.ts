import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { I18nService } from '@mapit/i18n';
import { Subject } from 'rxjs';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type {
  NotificationItem,
  NotificationPage,
  NotificationUnreadCount,
} from '@mapit/api-client';
import { NotificationSessionContext } from '../../../core/notification-session-context';
import { NotificationsApi } from '../data/notifications-api';
import { NotificationCenter } from './notification-center';

const A = { tenantId: 'tenant-a', userId: 'user-a', sessionId: 'session-a' };
const row: NotificationItem = {
  id: 'one',
  category: 'RESERVATIONS',
  type: 'RESERVATION_CREATED',
  establishmentId: 'venue-a',
  reservationId: 'reservation-a',
  occurredAt: '2026-11-01T12:00:00Z',
  createdAt: '2026-11-01T12:00:01Z',
  readAt: null,
};
let list: Subject<NotificationPage>;
let count: Subject<NotificationUnreadCount>;
const access = { context: signal<typeof A | null>(A), enabled: signal(false) };
const api = { list: vi.fn(), count: vi.fn(), markRead: vi.fn(), markAllRead: vi.fn() };

beforeEach(async () => {
  vi.clearAllMocks();
  access.context.set(A);
  access.enabled.set(false);
  list = new Subject();
  count = new Subject();
  api.list.mockReturnValue(list);
  api.count.mockReturnValue(count);
  api.markRead.mockReturnValue(new Subject());
  api.markAllRead.mockReturnValue(new Subject());
  await TestBed.configureTestingModule({
    imports: [NotificationCenter],
    providers: [
      { provide: NotificationSessionContext, useValue: access },
      { provide: NotificationsApi, useValue: api },
    ],
  }).compileComponents();
  TestBed.inject(I18nService).setLanguage('es');
});
afterEach(() => TestBed.inject(I18nService).setLanguage('es'));

function mount(enabled = true) {
  access.enabled.set(enabled);
  const fixture = TestBed.createComponent(NotificationCenter);
  fixture.detectChanges();
  const root = fixture.nativeElement as HTMLElement;
  const click = (selector: string) => {
    const button = root.querySelector<HTMLButtonElement>(selector)!;
    button.click();
    fixture.detectChanges();
  };
  return { fixture, root, click };
}

it('OFF renders no entry or HTTP request; ON exposes an accessible bell with actual count', () => {
  const { fixture, root } = mount(false);
  expect(root.querySelector('button')).toBeNull();
  expect(api.count).not.toHaveBeenCalled();
  access.enabled.set(true);
  fixture.detectChanges();
  count.next({ unreadCount: 3 });
  fixture.detectChanges();
  expect(root.querySelector('.badge')?.textContent?.trim()).toBe('3');
  expect(root.querySelector('.bell')?.getAttribute('aria-label')).toContain('3 sin leer');
  expect(api.list).not.toHaveBeenCalled();
});

it('loads on open, renders empty separately from error, and offers retry', () => {
  const { fixture, root, click } = mount();
  click('.bell');
  expect(root.querySelector('[role=dialog]')).not.toBeNull();
  expect(root.textContent).toContain('Cargando notificaciones');
  list.error(new Error('404'));
  count.error(new Error('404'));
  fixture.detectChanges();
  expect(root.textContent).toContain('No se pudieron cargar');
  expect(root.textContent).toContain('Contador no disponible');
  expect(root.textContent).not.toContain('No tienes notificaciones');
  list = new Subject();
  api.list.mockReturnValue(list);
  click('.state button');
  list.next({ content: [], hasMore: false });
  fixture.detectChanges();
  expect(root.textContent).toContain('No tienes notificaciones');
});

it('renders minimal details and waits for mutation confirmation', () => {
  const { fixture, root, click } = mount();
  click('.bell');
  count.next({ unreadCount: 1 });
  list.next({ content: [row], hasMore: true, nextCursor: 'next' });
  fixture.detectChanges();
  expect(root.textContent).toContain('Nueva reserva');
  expect(root.querySelector('details')?.textContent).toContain('reservation-a');
  expect(root.querySelector('time')?.getAttribute('datetime')).toBe(row.occurredAt);
  click('li button');
  expect(api.markRead).toHaveBeenCalledWith('one');
  expect(root.querySelector('li')?.classList.contains('unread')).toBe(true);
  expect(root.querySelector<HTMLButtonElement>('li button')?.disabled).toBe(true);
  expect(root.textContent).not.toContain('Notificación marcada como leída.');
});

it('loads the next page and sends mark-all only once without showing premature success', () => {
  const { fixture, root, click } = mount();
  click('.bell');
  count.next({ unreadCount: 2 });
  list.next({ content: [row], hasMore: true, nextCursor: 'next' });
  fixture.detectChanges();
  const next = new Subject<NotificationPage>();
  api.list.mockReturnValue(next);
  click('.more');
  expect(api.list).toHaveBeenLastCalledWith('next');
  expect(root.querySelector<HTMLButtonElement>('.more')?.disabled).toBe(true);
  next.next({ content: [{ ...row, id: 'two' }], hasMore: false });
  fixture.detectChanges();
  expect(root.querySelectorAll('li')).toHaveLength(2);
  click('.toolbar button:last-child');
  click('.toolbar button:last-child');
  expect(api.markAllRead).toHaveBeenCalledOnce();
  expect(root.textContent).not.toContain('Solicitud confirmada');
  expect(root.querySelectorAll('li.unread')).toHaveLength(2);
});

it('closes and hides all old rows on identity changes and rollback', () => {
  const { fixture, root, click } = mount();
  click('.bell');
  list.next({ content: [row], hasMore: false });
  fixture.detectChanges();
  access.context.set({ ...A, tenantId: 'tenant-b' });
  fixture.detectChanges();
  expect(root.querySelector('[role=dialog]')).toBeNull();
  expect(root.textContent).not.toContain('reservation-a');
  access.enabled.set(false);
  fixture.detectChanges();
  expect(root.querySelector('button')).toBeNull();
});

it('supports keyboard close and localized labels in English and Japanese', () => {
  const { fixture, root, click } = mount();
  click('.bell');
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  fixture.detectChanges();
  expect(root.querySelector('[role=dialog]')).toBeNull();
  TestBed.inject(I18nService).setLanguage('en');
  fixture.detectChanges();
  expect(root.querySelector('.bell')?.getAttribute('aria-label')).toBe('Notifications');
  TestBed.inject(I18nService).setLanguage('ja-JP');
  fixture.detectChanges();
  expect(root.querySelector('.bell')?.getAttribute('aria-label')).toBe('通知');
});
