import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import type { PlatformSetting, PlatformSettingsOverview } from '@mapit/api-client';
import { of, throwError } from 'rxjs';

import { PlatformSettingsApi } from '../data/platform-settings-api';
import { PlatformSettingsStore } from './platform-settings-store';

const LINK: PlatformSetting = {
  key: 'customer-history.link-ttl-minutes',
  value: 15,
  defaultValue: 15,
  overridden: false,
  min: 5,
  max: 60,
};
const OVERVIEW: PlatformSettingsOverview = {
  environment: 'development',
  services: { databaseAvailable: true, flagProvider: 'AVAILABLE' },
  settings: [LINK],
  readOnly: [],
  flags: [],
};

describe('PlatformSettingsStore (HU-7.07)', () => {
  let store: PlatformSettingsStore;
  const api = {
    overview: vi.fn(() => of(OVERVIEW)),
    changes: vi.fn(() => of([])),
    change: vi.fn(() => of(LINK)),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    api.overview.mockReturnValue(of(OVERVIEW));
    api.change.mockReturnValue(of(LINK));
    TestBed.configureTestingModule({
      providers: [PlatformSettingsStore, { provide: PlatformSettingsApi, useValue: api }],
    });
    store = TestBed.inject(PlatformSettingsStore);
    store.load();
  });

  const prepare = (value: string, reason = 'Motivo suficientemente largo') => {
    store.edit(LINK);
    store.draft.set(value);
    store.reason.set(reason);
  };

  it('distingue la sección apagada (404) de un fallo', () => {
    api.overview.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 404 })));
    store.load();
    expect(store.status()).toBe('disabled');

    api.overview.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 500 })));
    store.load();
    expect(store.status()).toBe('error');
  });

  it('solo deja revisar un entero en rango, distinto del actual y con motivo', () => {
    prepare('61');
    expect(store.canReview()).toBe(false);
    prepare('15');
    expect(store.canReview()).toBe(false);
    prepare('20', 'corto');
    expect(store.canReview()).toBe(false);
    prepare('20.5');
    expect(store.canReview()).toBe(false);
    prepare('20');
    expect(store.canReview()).toBe(true);
  });

  it('no envía nada sin confirmar y manda el valor que tenía en pantalla', () => {
    prepare('20');
    store.review();
    expect(api.change).not.toHaveBeenCalled();
    expect(store.pending()?.value).toBe(20);

    store.confirm();

    expect(api.change).toHaveBeenCalledWith(LINK.key, 20, 15, 'Motivo suficientemente largo');
    expect(store.notice()).toBe('saved');
    expect(store.editingKey()).toBeNull();
    expect(api.overview).toHaveBeenCalledTimes(2);
  });

  it('ante un conflicto avisa y recarga el valor vigente', () => {
    api.change.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 409 })));
    prepare('20');
    store.review();
    store.confirm();

    expect(store.notice()).toBe('conflict');
    expect(api.overview).toHaveBeenCalledTimes(2);
  });

  it('conserva lo escrito si el guardado falla', () => {
    api.change.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 500 })));
    prepare('20');
    store.review();
    store.confirm();

    expect(store.notice()).toBe('failed');
    expect(store.draft()).toBe('20');
    expect(store.editingKey()).toBe(LINK.key);
  });

  it('restaura el valor del despliegue enviando nulo, solo si estaba modificado', () => {
    prepare('15');
    expect(store.canRestore()).toBe(false);

    const changed = { ...LINK, value: 45, overridden: true };
    api.overview.mockReturnValue(of({ ...OVERVIEW, settings: [changed] }));
    store.load();
    store.edit(changed);
    store.reason.set('Volver a la política original');
    store.reviewRestore();
    store.confirm();

    expect(api.change).toHaveBeenCalledWith(LINK.key, null, 45, 'Volver a la política original');
  });
});
