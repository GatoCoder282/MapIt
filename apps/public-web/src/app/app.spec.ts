import { TestBed } from '@angular/core/testing';

import { App } from './app';

/**
 * Test de humo del andamiaje de la vista pública.
 * Los tests reales llegan con sus casos de uso (CU-15…CU-18).
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
