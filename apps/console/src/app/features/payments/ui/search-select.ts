import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';

export interface SearchSelectOption {
  readonly value: string;
  readonly label: string;
  readonly description?: string;
}

/** Selección de catálogo: el texto busca, únicamente una opción confirma el valor. */
@Component({
  selector: 'mapit-payment-search-select',
  templateUrl: './search-select.html',
  styleUrl: './search-select.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SearchSelect {
  readonly inputId = input.required<string>();
  readonly label = input.required<string>();
  readonly placeholder = input.required<string>();
  readonly emptyMessage = input.required<string>();
  readonly options = input.required<readonly SearchSelectOption[]>();
  readonly value = input('');
  readonly disabled = input(false);
  readonly valueChanged = output<string>();

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  protected readonly open = signal(false);
  protected readonly query = signal<string | null>(null);
  protected readonly activeIndex = signal(-1);
  protected readonly display = computed(
    () =>
      this.query() ?? this.options().find((option) => option.value === this.value())?.label ?? '',
  );
  protected readonly filtered = computed(() => {
    const query = normalize(this.query() ?? '');
    return this.options().filter((option) =>
      normalize(`${option.label} ${option.description ?? ''}`).includes(query),
    );
  });
  protected readonly activeId = computed(() =>
    this.open() && this.filtered()[this.activeIndex()]
      ? `${this.inputId()}-option-${this.activeIndex()}`
      : null,
  );

  protected search(value: string): void {
    this.query.set(value);
    this.valueChanged.emit('');
    this.open.set(true);
    this.activeIndex.set(this.filtered().length ? 0 : -1);
  }

  protected choose(option: SearchSelectOption): void {
    this.valueChanged.emit(option.value);
    this.close();
  }

  protected close(): void {
    this.open.set(false);
    this.query.set(null);
    this.activeIndex.set(-1);
  }

  protected leave(event: FocusEvent): void {
    if (!this.host.nativeElement.contains(event.relatedTarget as Node | null)) this.close();
  }

  protected keydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      if (this.open()) event.preventDefault();
      this.close();
      return;
    }
    if (event.key === 'Enter' && this.open()) {
      event.preventDefault();
      const option = this.filtered()[Math.max(0, this.activeIndex())];
      if (option) this.choose(option);
      return;
    }
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    event.preventDefault();
    this.open.set(true);
    const count = this.filtered().length;
    if (!count) return;
    const delta = event.key === 'ArrowDown' ? 1 : -1;
    const current = this.activeIndex();
    this.activeIndex.set(
      current < 0 ? (delta > 0 ? 0 : count - 1) : (current + delta + count) % count,
    );
    this.host.nativeElement
      .querySelector<HTMLElement>(`[id="${this.activeId()}"]`)
      ?.scrollIntoView?.({ block: 'nearest' });
  }
}

function normalize(value: string): string {
  return value
    .trim()
    .toLocaleLowerCase('es')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}
