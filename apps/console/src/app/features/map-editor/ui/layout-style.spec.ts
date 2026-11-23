import { TestBed } from '@angular/core/testing';
import { MAP_ENGINE, type SpaceElement } from '@mapit/map-engine';
import { LayoutStyleComponent } from './layout-style';
import type { LayoutStyle } from '../../../core/spatial-layout';

it('merges consecutive label changes before the parent input is rendered again', () => {
  TestBed.configureTestingModule({
    imports: [LayoutStyleComponent],
    providers: [{ provide: MAP_ENGINE, useValue: {} }],
  });
  const fixture = TestBed.createComponent(LayoutStyleComponent);
  const table: SpaceElement = {
    id: 'mesa',
    type: 'TABLE',
    label: 'Mesa',
    state: 'AVAILABLE',
    reservable: true,
    capacity: 4,
    position: { x: 20, y: 20 },
    size: { width: 80, height: 80 },
    rotation: 0,
    attributes: {},
  };
  let saved: LayoutStyle = { elements: { mesa: { preset: 'modern' } } };
  fixture.componentRef.setInput('appearance', saved);
  fixture.componentRef.setInput('element', table);
  fixture.componentRef.setInput('advanced', true);
  fixture.componentInstance.styleChange.subscribe((update) => {
    saved = update(saved);
  });
  fixture.detectChanges();

  const inputs = (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLInputElement>(
    'input[type=checkbox]',
  );
  for (const input of inputs) {
    input.checked = false;
    input.dispatchEvent(new Event('change'));
  }
  const select = (fixture.nativeElement as HTMLElement).querySelector<HTMLSelectElement>('select')!;
  select.value = 'outline';
  select.dispatchEvent(new Event('change'));

  expect(saved.elements['mesa']).toEqual({
    preset: 'modern',
    showName: false,
    showCapacity: false,
    labelStyle: 'outline',
  });
});

describe('LayoutStyleComponent application scopes', () => {
  function create() {
    TestBed.configureTestingModule({
      imports: [LayoutStyleComponent],
      providers: [
        {
          provide: MAP_ENGINE,
          useValue: {
            furniturePreview: (element: SpaceElement) =>
              'data:image/png;base64,' + btoa(JSON.stringify(element.attributes)),
          },
        },
      ],
    });
    const fixture = TestBed.createComponent(LayoutStyleComponent);
    const element = (id: string, type: SpaceElement['type'] = 'TABLE'): SpaceElement => ({
      id,
      type,
      label: id,
      state: 'OCCUPIED',
      reservable: type !== 'DECOR' && type !== 'SECTOR_ZONE',
      capacity: 4,
      position: { x: 20, y: 20 },
      size: { width: 80, height: 80 },
      rotation: 0,
      attributes: {},
    });
    let saved: LayoutStyle = {
      elements: {
        a: { preset: 'modern', showName: false },
        b: { showName: true, showCapacity: false, labelStyle: 'outline' },
      },
    };
    const updates = vi.fn();
    fixture.componentRef.setInput('element', element('a'));
    fixture.componentRef.setInput('elements', [element('a'), element('b'), element('bar', 'BAR')]);
    fixture.componentRef.setInput('appearance', saved);
    fixture.componentInstance.styleChange.subscribe((update) => {
      updates();
      saved = update(saved);
      fixture.componentRef.setInput('appearance', saved);
    });
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    const dialog = root.querySelector<HTMLDialogElement>('dialog')!;
    Object.defineProperty(dialog, 'showModal', { value: () => dialog.setAttribute('open', '') });
    Object.defineProperty(dialog, 'close', { value: () => dialog.removeAttribute('open') });
    const click = (selector: string) => {
      root.querySelector<HTMLButtonElement>(selector)!.click();
      fixture.detectChanges();
    };
    const scope = (value: string) => {
      const input = root.querySelector<HTMLSelectElement>('[data-testid="style-scope"]')!;
      input.value = value;
      input.dispatchEvent(new Event('change'));
      fixture.detectChanges();
    };
    return { fixture, root, dialog, updates, click, scope, saved: () => saved, element };
  }

  it('stages individual changes immediately and preserves label preferences', () => {
    const page = create();
    const before = page.root.querySelector<HTMLImageElement>('[data-testid="style-preview"]')!.src;
    page.click('.preset-grid button:nth-child(2)');
    expect(page.updates).toHaveBeenCalledOnce();
    expect(
      page.root.querySelector<HTMLImageElement>('[data-testid="style-preview"]')!.src,
    ).not.toBe(before);
    expect(page.root.querySelector('[data-testid="style-apply"]')).toBeNull();
    expect(page.dialog.open).toBe(false);
    expect(page.saved().elements['a']).toMatchObject({
      preset: 'classic',
      color: '#8a5637',
      showName: false,
    });
    expect(page.saved().elements['b']).toEqual({
      showName: true,
      showCapacity: false,
      labelStyle: 'outline',
    });
    expect(page.saved().elements['bar']).toBeUndefined();
  });

  it.each([
    ['BAR', 'barClassic', { variant: 'straight', seatColor: '#dfbd94' }],
    ['DECOR', 'plantNatural', { variant: 'foliage', visualScale: 'medium' }],
    ['SECTOR_ZONE', 'zoneDining', { fillOpacity: 65, zoneBorder: 'dashed' }],
  ] as const)('shows and stages the preset for %s', (type, preset, expected) => {
    const page = create();
    page.fixture.componentRef.setInput('element', page.element('b', type));
    page.fixture.detectChanges();
    page.click('.preset-grid button:first-child');
    expect(page.saved().elements['b']).toMatchObject({
      preset,
      ...expected,
      labelStyle: 'outline',
    });
    expect(page.root.querySelector('[data-testid="style-apply"]')).toBeNull();
    expect(page.root.querySelector('[data-testid="style-preview"]')).not.toBeNull();
  });

  it('requires confirmation for similar elements and preserves each element label settings', () => {
    const page = create();
    page.scope('similar');
    page.click('.preset-grid button:nth-child(3)');
    page.click('[data-testid="style-apply"]');
    expect(page.dialog.open).toBe(true);
    expect(page.updates).not.toHaveBeenCalled();
    const buttons = page.dialog.querySelectorAll<HTMLButtonElement>('button');
    buttons[0]!.click();
    page.fixture.detectChanges();
    expect(page.dialog.open).toBe(false);
    expect(page.updates).not.toHaveBeenCalled();
    page.click('[data-testid="style-apply"]');
    buttons[1]!.click();
    page.fixture.detectChanges();
    expect(page.saved().elements['a']).toMatchObject({ preset: 'industrial', showName: false });
    expect(page.saved().elements['b']).toMatchObject({
      preset: 'industrial',
      showName: true,
      showCapacity: false,
      labelStyle: 'outline',
    });
    expect(page.saved().elements['bar']).toBeUndefined();
  });

  it('allows choosing compatible elements and applies only the checked targets', () => {
    const page = create();
    page.scope('selected');
    page.click('.preset-grid button:nth-child(2)');
    expect(page.root.querySelector('[data-testid="style-target-bar"]')).toBeNull();
    page.click('[data-testid="style-target-a"]');
    expect(
      page.root.querySelector<HTMLButtonElement>('[data-testid="style-apply"]')!.disabled,
    ).toBe(true);
    page.click('[data-testid="style-target-b"]');
    page.click('[data-testid="style-apply"]');
    expect(page.saved().elements['a']).toEqual({ preset: 'modern', showName: false });
    expect(page.saved().elements['b']).toMatchObject({ preset: 'classic', labelStyle: 'outline' });
    expect(page.dialog.open).toBe(false);
  });

  it('discards the preview and pending confirmation when the active selection changes', () => {
    const page = create();
    page.scope('similar');
    page.click('.preset-grid button:nth-child(2)');
    page.click('[data-testid="style-apply"]');
    page.fixture.componentRef.setInput('element', page.element('b'));
    page.fixture.detectChanges();
    expect(page.dialog.open).toBe(false);
    page.dialog.querySelectorAll<HTMLButtonElement>('button')[1]!.click();
    expect(page.updates).not.toHaveBeenCalled();
  });

  it('does not apply a stale group request after a target is removed', () => {
    const page = create();
    page.scope('similar');
    page.click('.preset-grid button:nth-child(2)');
    page.click('[data-testid="style-apply"]');
    page.fixture.componentRef.setInput('elements', [page.element('a')]);
    page.fixture.detectChanges();
    page.dialog.querySelectorAll<HTMLButtonElement>('button')[1]!.click();
    expect(page.updates).not.toHaveBeenCalled();
  });
});

it('offers furnishing colors instead of plant controls for non-plant decoration', () => {
  TestBed.configureTestingModule({
    imports: [LayoutStyleComponent],
    providers: [{ provide: MAP_ENGINE, useValue: {} }],
  });
  const fixture = TestBed.createComponent(LayoutStyleComponent);
  fixture.componentRef.setInput('appearance', {
    elements: { sofa: { variant: 'sofa', color: '#704495' } },
  });
  fixture.componentRef.setInput('element', {
    id: 'sofa',
    type: 'DECOR',
    attributes: {},
    size: { width: 160, height: 70 },
    position: { x: 0, y: 0 },
    rotation: 0,
    state: 'AVAILABLE',
    label: 'Sof�',
    reservable: false,
    capacity: null,
  });
  const updates = vi.fn<(update: (current: LayoutStyle) => LayoutStyle) => void>();
  fixture.componentInstance.styleChange.subscribe(updates);
  fixture.detectChanges();
  const root = fixture.nativeElement as HTMLElement;
  expect(root.querySelector('.preset-grid')).toBeNull();
  const color = Array.from(root.querySelectorAll<HTMLInputElement>('input[type=color]')).find(
    (input) => input.value === '#704495',
  )!;
  expect(color.value).toBe('#704495');
  color.value = '#145dca';
  color.dispatchEvent(new Event('input'));
  expect(updates).toHaveBeenCalledOnce();
  expect(
    updates.mock.calls[0]![0]({ elements: { sofa: { variant: 'sofa' } } }).elements['sofa'],
  ).toMatchObject({ variant: 'sofa', color: '#145dca' });
});
