import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ElementTemplate } from '@mapit/api-client';
import { TemplatesService } from '@mapit/api-client';

import { TemplatesStore } from './templates-store';
import { STRINGS } from '../../../core/strings';

/**
 * Reglas del ViewModel de plantillas de elemento (HU-4.02 / MAP-205-206).
 * Sin renderizar componentes: el store queda probado con un mock del api-client generado.
 */
describe('TemplatesStore', () => {
  let api: {
    listElementTemplates: ReturnType<typeof vi.fn>;
    createElementTemplate: ReturnType<typeof vi.fn>;
    updateElementTemplate: ReturnType<typeof vi.fn>;
    deleteElementTemplate: ReturnType<typeof vi.fn>;
  };
  let store: TemplatesStore;

  const strings = STRINGS.spaces.templates;

  function template(id: string, name: string, type = 'TABLE'): ElementTemplate {
    return {
      id,
      name,
      type: type as ElementTemplate['type'],
      createdAt: '2026-10-04T00:00:00Z',
      updatedAt: '2026-10-04T00:00:00Z',
    };
  }

  beforeEach(() => {
    api = {
      listElementTemplates: vi.fn().mockReturnValue(of([])),
      createElementTemplate: vi.fn(),
      updateElementTemplate: vi.fn(),
      deleteElementTemplate: vi.fn(),
    };

    TestBed.configureTestingModule({
      providers: [TemplatesStore, { provide: TemplatesService, useValue: api }],
    });
    store = TestBed.inject(TemplatesStore);
  });

  it('carga las plantillas del tenant en el estado', () => {
    const stub = [template('t1', 'Barra', 'BAR')];
    api.listElementTemplates.mockReturnValue(of(stub));

    store.loadTemplates();

    expect(store.templates()).toEqual(stub);
    expect(store.loading()).toBe(false);
  });

  it('rechaza un nombre vacío sin llamar al API', () => {
    store.startNew();
    store.setDraftName('   ');

    const result = store.saveTemplate();

    expect(result).toBeNull();
    expect(api.createElementTemplate).not.toHaveBeenCalled();
    expect(store.error()).toBe(strings.form.nameRequired);
  });

  it('rechaza un nombre que excede el máximo sin llamar al API', () => {
    store.startNew();
    store.setDraftName('x'.repeat(strings.form.nameMaxLength + 1));

    const result = store.saveTemplate();

    expect(result).toBeNull();
    expect(api.createElementTemplate).not.toHaveBeenCalled();
    expect(store.error()).toBe(strings.form.nameTooLong);
  });

  it('crea la plantilla recortando el nombre y la inserta ordenada', () => {
    const creada = template('t1', 'Barra central', 'BAR');
    api.createElementTemplate.mockReturnValue(of(creada));

    store.startNew();
    store.setDraftName('  Barra central  ');
    store.setDraftType('BAR');

    const result = store.saveTemplate();
    expect(result).not.toBeNull();
    result!.subscribe();

    expect(api.createElementTemplate).toHaveBeenCalledWith({
      elementTemplateCreateRequest: { name: 'Barra central', type: 'BAR' },
    });
    expect(store.templates()).toEqual([creada]);
  });

  it('un 409 del API se traduce al mensaje de conflicto de nombre', () => {
    api.createElementTemplate.mockReturnValue(throwError(() => ({ status: 409 })));

    store.startNew();
    store.setDraftName('Duplicada');
    store.setDraftType('TABLE');

    store.saveTemplate()!.subscribe({ error: () => {} });

    expect(store.error()).toBe(strings.errors.nameConflict);
  });

  it('guardar desde un elemento existente solo envía tipo y nombre, nunca ids', () => {
    const creada = template('t9', 'Desde lienzo', 'SEAT');
    api.createElementTemplate.mockReturnValue(of(creada));

    store.saveFromElement('SEAT', 'Desde lienzo').subscribe();

    expect(api.createElementTemplate).toHaveBeenCalledWith({
      elementTemplateCreateRequest: { name: 'Desde lienzo', type: 'SEAT' },
    });
  });

  it('seleccionar una plantilla la resuelve para el flujo de reutilización', () => {
    const stub = [template('t1', 'Barra', 'BAR'), template('t2', 'Mesa', 'TABLE')];
    api.listElementTemplates.mockReturnValue(of(stub));
    store.loadTemplates();

    store.selectTemplate('t2');

    expect(store.selectedTemplate()?.type).toBe('TABLE');
    store.clearSelection();
    expect(store.selectedTemplate()).toBeNull();
  });

  it('elimina la plantilla del estado tras la baja', () => {
    const stub = [template('t1', 'Una'), template('t2', 'Otra')];
    api.listElementTemplates.mockReturnValue(of(stub));
    store.loadTemplates();
    api.deleteElementTemplate.mockReturnValue(of(void 0));

    store.deleteTemplate('t1').subscribe();

    expect(api.deleteElementTemplate).toHaveBeenCalledWith({ templateId: 't1' });
    expect(store.templates().map((t) => t.id)).toEqual(['t2']);
  });
});
