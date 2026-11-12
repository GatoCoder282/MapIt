import { signal } from '@angular/core';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import type { AuditLogEntry, AuditLogPage } from '@mapit/api-client';
import { AuthSession } from '@mapit/auth';
import { of } from 'rxjs';

import { STRINGS } from '../../../core/strings';
import { AuditApi } from '../data/audit-api';
import { AuditPage } from './audit-page';

const ENTRY: AuditLogEntry = {
  id: '152efff5-b2b3-4774-9ba4-36d8a3101725',
  actorId: 'ee84dc82-7485-4672-9684-f31c769e1119',
  occurredAt: '2026-10-24T15:30:00Z',
  resourceType: 'SPACE_ELEMENT',
  resourceId: '34e8f789-ee31-44e1-a392-62be58e117d5',
  eventType: 'SPACE_ELEMENT_STATE_CHANGED',
  details: {
    newState: 'OCCUPIED',
    previousState: 'AVAILABLE',
    sectorId: '68075b8a-a46c-4706-9793-a7b41910de80',
  },
};
const PAGE: AuditLogPage = {
  content: [ENTRY],
  page: 0,
  size: 10,
  totalElements: 1,
  totalPages: 1,
};

describe('AuditPage', () => {
  let fixture: ComponentFixture<AuditPage>;
  let root: HTMLElement;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [AuditPage],
      providers: [
        { provide: AuditApi, useValue: { list: () => of(PAGE) } },
        {
          provide: AuthSession,
          useValue: { user: signal({ id: ENTRY.actorId, fullName: 'Lucía Ramos' }) },
        },
      ],
    });
    fixture = TestBed.createComponent(AuditPage);
    root = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();
  });

  it('muestra un resumen con estado y responsable y reserva los UUID completos para el detalle', () => {
    const table = root.querySelector('table')!;
    const rowButton = table.querySelector<HTMLButtonElement>('tbody button')!;
    expect(table.textContent).toContain('Disponible → Ocupado');
    expect(table.textContent).toContain('Lucía Ramos');
    expect(table.textContent).not.toContain(ENTRY.resourceId);

    rowButton.click();
    fixture.detectChanges();
    expect(rowButton.getAttribute('aria-expanded')).toBe('true');
    expect(root.querySelector('aside h2')?.textContent).toBe(STRINGS.audit.eventDetail);
    expect(root.querySelector('aside')?.textContent).toContain(
      STRINGS.audit.detailLabels.previousState,
    );
    const changeStates = Array.from(root.querySelectorAll('aside [data-state]'), (item) =>
      item.getAttribute('data-state'),
    );
    expect(changeStates).toEqual(['AVAILABLE', 'OCCUPIED']);
    const technical = root.querySelector<HTMLDetailsElement>('aside details')!;
    expect(technical.open).toBe(false);
    expect(technical.textContent).toContain(ENTRY.resourceId);
    expect(technical.textContent).toContain(ENTRY.details['sectorId']);

    root.querySelector('aside')?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    fixture.detectChanges();
    expect(root.querySelector('aside')).toBeNull();
    expect(rowButton.getAttribute('aria-expanded')).toBe('false');
    expect(root.ownerDocument.activeElement).toBe(rowButton);
  });

  it('identifica el campo de búsqueda exacta que causó un error de validación', () => {
    const resource = root.querySelector<HTMLInputElement>('input[name=resourceId]')!;
    resource.value = '34e8f789';
    resource.dispatchEvent(new Event('input'));
    root.querySelector('form')?.dispatchEvent(new Event('submit', { cancelable: true }));
    fixture.detectChanges();

    expect(resource.getAttribute('aria-invalid')).toBe('true');
    expect(root.querySelector('#audit-filter-error')?.textContent).toBe(
      STRINGS.audit.invalidResourceId,
    );
  });
});
