import { TestBed } from '@angular/core/testing';

import { TimezonePicker } from './timezone-picker';

describe('TimezonePicker', () => {
  function crear(): TimezonePicker {
    TestBed.configureTestingModule({ imports: [TimezonePicker] });
    const fixture = TestBed.createComponent(TimezonePicker);
    fixture.detectChanges();
    return fixture.componentInstance;
  }

  it('lista el catálogo IANA completo sin filtro', () => {
    const picker = crear();
    expect(picker['filtered']().length).toBeGreaterThan(300);
    expect(picker['filtered']()).toContain('America/La_Paz');
  });

  it('el buscador filtra por subcadena sin distinguir mayúsculas', () => {
    const picker = crear();
    picker['onInput']('la_paz');
    expect(picker['filtered']()).toEqual(['America/La_Paz']);
    expect(picker['activeIndex']()).toBe(0);
  });

  it('pick confirma el valor y cierra el listbox', () => {
    const picker = crear();
    picker['pick']('Europe/Madrid');
    expect(picker.timezone()).toBe('Europe/Madrid');
    expect(picker['query']()).toBe('Europe/Madrid');
    expect(picker['open']()).toBe(false);
  });

  it('un texto sin coincidencia exacta no confirma nada al salir', () => {
    const picker = crear();
    picker.timezone.set('America/La_Paz');
    picker['onFocus']();
    picker['onInput']('zonainventada');

    const event = {
      relatedTarget: null,
      currentTarget: document.createElement('div'),
    } as unknown as FocusEvent;
    picker['onFocusOut'](event);

    expect(picker.timezone()).toBe('America/La_Paz');
    expect(picker['query']()).toBe('America/La_Paz');
    expect(picker['open']()).toBe(false);
  });

  it('coincidencia exacta case-insensitive confirma al salir', () => {
    const picker = crear();
    picker['onFocus']();
    picker['onInput']('europe/madrid');

    const event = {
      relatedTarget: null,
      currentTarget: document.createElement('div'),
    } as unknown as FocusEvent;
    picker['onFocusOut'](event);

    expect(picker.timezone()).toBe('Europe/Madrid');
  });

  it('navegación con flechas envuelve los extremos de la lista', () => {
    const picker = crear();
    picker['onInput']('la_paz'); // un solo resultado

    picker['onKeydown'](new KeyboardEvent('keydown', { key: 'ArrowUp' }));
    expect(picker['activeIndex']()).toBe(0); // (-1 - 1 + 1) % 1

    picker['onKeydown'](new KeyboardEvent('keydown', { key: 'ArrowDown' }));
    expect(picker['activeIndex']()).toBe(0);
  });

  it('Enter elige la opción activa', () => {
    const picker = crear();
    picker['onFocus']();
    picker['onInput']('buenos_aires');

    const event = new KeyboardEvent('keydown', { key: 'Enter', cancelable: true });
    picker['onKeydown'](event);

    expect(picker.timezone()).toBe('America/Buenos_Aires');
    expect(picker['open']()).toBe(false);
  });
});
