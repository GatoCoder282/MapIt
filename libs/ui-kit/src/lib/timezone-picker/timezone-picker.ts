import { ChangeDetectionStrategy, Component, computed, input, model, signal } from '@angular/core';

import { PICKER_STRINGS } from '../picker-strings';

const ZONAS_POR_DEFECTO = ['America/La_Paz'];

/**
 * Selector de zona horaria con buscador (combobox accesible).
 *
 * Puramente presentacional: recibe el id IANA por `[(timezone)]` y filtra el
 * catálogo completo de `Intl.supportedValuesOf('timeZone')`. El valor solo se
 * confirma al elegir una opción (click, Enter o blur con coincidencia exacta);
 * teclear libremente sin elegir revierte al valor previo, nunca guarda basura.
 */
@Component({
  selector: 'mapit-ui-timezone-picker',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './timezone-picker.html',
  styleUrl: './timezone-picker.scss',
})
export class TimezonePicker {
  /** Id IANA seleccionado (p. ej. 'America/La_Paz'). Binding bidireccional. */
  readonly timezone = model('');

  /** Id del input interno, para asociar un <label for> externo. */
  readonly inputId = input('');

  /** Placeholder del input; por defecto el del catálogo de strings de la lib. */
  readonly placeholder = input('');

  readonly disabled = input(false);

  protected readonly strings = PICKER_STRINGS;

  /** Catálogo IANA completo del navegador. */
  private readonly zones: string[] =
    (Intl as { supportedValuesOf?(key: string): string[] }).supportedValuesOf?.('timeZone') ??
    ZONAS_POR_DEFECTO;

  protected readonly query = signal('');
  protected readonly open = signal(false);
  protected readonly activeIndex = signal(-1);

  protected readonly filtered = computed(() => {
    const text = this.query().trim().toLowerCase();
    if (!text) return this.zones;
    return this.zones.filter((zone) => zone.toLowerCase().includes(text));
  });

  protected activeOptionId(): string | null {
    const index = this.activeIndex();
    return this.open() && index >= 0 && index < this.filtered().length
      ? `tz-option-${index}`
      : null;
  }

  protected onFocus(): void {
    this.query.set(this.timezone());
    this.activeIndex.set(-1);
    this.open.set(true);
  }

  protected onInput(value: string): void {
    this.query.set(value);
    this.activeIndex.set(this.filtered().length > 0 ? 0 : -1);
    this.open.set(true);
  }

  protected pick(zone: string): void {
    this.timezone.set(zone);
    this.query.set(zone);
    this.open.set(false);
    this.activeIndex.set(-1);
  }

  protected onKeydown(event: KeyboardEvent): void {
    const total = this.filtered().length;

    switch (event.key) {
      case 'ArrowDown':
      case 'ArrowUp': {
        event.preventDefault();
        if (!this.open()) {
          this.open.set(true);
          this.activeIndex.set(0);
          return;
        }
        if (total === 0) return;
        const delta = event.key === 'ArrowDown' ? 1 : -1;
        const next = (this.activeIndex() + delta + total) % total;
        this.activeIndex.set(next);
        this.scrollOptionIntoView(next);
        return;
      }
      case 'Enter': {
        const index = this.activeIndex();
        const candidate = this.filtered()[Math.max(index, 0)];
        if (this.open() && candidate) {
          event.preventDefault();
          this.pick(candidate);
        }
        return;
      }
      case 'Escape': {
        this.open.set(false);
        this.revert();
        return;
      }
      case 'Tab': {
        // El blur se encarga de confirmar o revertir.
        return;
      }
    }
  }

  /** Al salir del control: coincidencia exacta confirma; si no, se revierte. */
  protected onFocusOut(event: FocusEvent): void {
    const next = event.relatedTarget as Node | null;
    if (next && (event.currentTarget as HTMLElement).contains(next)) return;
    if (!this.open()) return;

    const text = this.query().trim();
    const exact = this.zones.find((zone) => zone.toLowerCase() === text.toLowerCase());
    if (exact) this.pick(exact);
    else this.revert();
    this.open.set(false);
  }

  private revert(): void {
    this.query.set(this.timezone());
    this.activeIndex.set(-1);
  }

  private scrollOptionIntoView(index: number): void {
    document.getElementById(`tz-option-${index}`)?.scrollIntoView({ block: 'nearest' });
  }
}
