import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { of, throwError } from 'rxjs';
import { FeatureFlagService } from '@mapit/feature-flags';
import { BusinessApplicationApi } from '../data/business-application-api';
import { BusinessApplicationStore } from './business-application-store';

describe('BusinessApplicationStore', () => {
  it('no envía con la flag apagada o con datos inválidos', () => {
    const enabled = signal(false);
    const submit = vi.fn(() => of(null));
    TestBed.configureTestingModule({
      providers: [
        BusinessApplicationStore,
        { provide: FeatureFlagService, useValue: { isEnabled: () => enabled } },
        { provide: BusinessApplicationApi, useValue: { submit } },
      ],
    });
    const store = TestBed.inject(BusinessApplicationStore);
    store.submit();
    expect(submit).not.toHaveBeenCalled();
    enabled.set(true);
    store.submit();
    expect(submit).not.toHaveBeenCalled();
  });

  it('envía datos válidos y muestra confirmación neutra', () => {
    const submit = vi.fn(() => of(null));
    TestBed.configureTestingModule({
      providers: [
        BusinessApplicationStore,
        { provide: FeatureFlagService, useValue: { isEnabled: () => signal(true) } },
        { provide: BusinessApplicationApi, useValue: { submit } },
      ],
    });
    const store = TestBed.inject(BusinessApplicationStore);
    store.businessName.set('Hotel Norte');
    store.vertical.set('HOTEL');
    store.location.set('Cochabamba');
    store.contactName.set('Ana Pérez');
    store.contactEmail.set('ana@example.com');
    store.submit();
    expect(submit).toHaveBeenCalledWith(
      expect.objectContaining({ contactEmail: 'ana@example.com' }),
    );
    expect(store.success()).toBe(true);
  });

  it('explica el límite de solicitudes sin mostrar datos internos', () => {
    TestBed.configureTestingModule({
      providers: [
        BusinessApplicationStore,
        { provide: FeatureFlagService, useValue: { isEnabled: () => signal(true) } },
        {
          provide: BusinessApplicationApi,
          useValue: { submit: () => throwError(() => ({ status: 429 })) },
        },
      ],
    });
    const store = TestBed.inject(BusinessApplicationStore);
    store.businessName.set('Hotel Norte');
    store.vertical.set('HOTEL');
    store.location.set('Cochabamba');
    store.contactName.set('Ana Pérez');
    store.contactEmail.set('ana@example.com');
    store.submit();
    expect(store.error()).toBeTruthy();
    expect(store.success()).toBe(false);
  });
});
