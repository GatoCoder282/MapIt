import { TestBed } from '@angular/core/testing';
import { EstablishmentsService } from '@mapit/api-client';
import { of } from 'rxjs';

import { StaffAccessApi } from './staff-access-api';

describe('StaffAccessApi', () => {
  it('usa las operaciones generadas sin pasar un tenant del navegador', () => {
    const client = {
      listAccessibleEstablishments: vi.fn(() => of([])),
      listEstablishmentStaffAccess: vi.fn(() => of([])),
      saveEstablishmentStaffAccess: vi.fn(() => of(null)),
    };
    TestBed.configureTestingModule({
      providers: [{ provide: EstablishmentsService, useValue: client }],
    });
    const api = TestBed.inject(StaffAccessApi);
    api.establishments().subscribe();
    api.staff('venue-a').subscribe();
    api.save('venue-a', 'staff-a', true).subscribe();

    expect(client.listAccessibleEstablishments).toHaveBeenCalledWith();
    expect(client.listEstablishmentStaffAccess).toHaveBeenCalledWith({
      establishmentId: 'venue-a',
    });
    expect(client.saveEstablishmentStaffAccess).toHaveBeenCalledWith({
      establishmentId: 'venue-a',
      userId: 'staff-a',
      establishmentStaffAccessWrite: { canCheckIn: true },
    });
  });
});
