import { TestBed } from '@angular/core/testing';

import { App } from './app';

/**
 * Test de humo del andamiaje.
 *
 * Sirve para verificar que el runner (Vitest, el default de Angular 22) y el
 * arranque zoneless funcionan. Los tests reales llegan con sus casos de uso.
 */
describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [App] }).compileComponents();
  });

  it('se crea', () => {
    const fixture = TestBed.createComponent(App);
    expect(fixture.componentInstance).toBeTruthy();
  });
});
