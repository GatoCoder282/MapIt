import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  linkedSignal,
  output,
  signal,
  untracked,
  viewChild,
  type ElementRef,
  type OnInit,
} from '@angular/core';
import { MAP_ENGINE, TYPE_DEFAULTS, type SpaceElement, type Size } from '@mapit/map-engine';
import { ElementTypeIconComponent } from '@mapit/ui-kit';
import { LucideCheck, LucideChevronRight, LucideMinus, LucidePlus } from '@lucide/angular';
import { STRINGS } from '../../../core/strings';
import { EstablishmentContext } from '../../../core/establishment-context';
import { SpacesStore } from '../../../core/establishment-structure/spaces-store';
import { withElementFinish } from '../../../core/spatial-layout';
import { MapEditorStore, type ElementInsertion } from '../model/map-editor-store';
import { mapDefinition, type ElementModel } from '../model/element-catalog';

@Component({
  selector: 'mapit-element-library',
  imports: [ElementTypeIconComponent, LucideCheck, LucideChevronRight, LucideMinus, LucidePlus],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './element-library.html',
  styleUrl: './element-library.scss',
})
export class ElementLibraryComponent implements OnInit {
  readonly inserted = output<void>();
  readonly dragStarted = output<void>();
  private dragging: {
    key: string;
    sectorId: string;
    model: ElementModel;
    options: ElementInsertion;
  } | null = null;
  protected readonly store = inject(MapEditorStore);
  private readonly structure = inject(SpacesStore);
  private readonly context = inject(EstablishmentContext);
  private readonly port = inject(MAP_ENGINE);
  protected readonly strings = STRINGS.spaces.editor.library;
  protected readonly editorStrings = STRINGS.spaces.editor;
  protected readonly paletteStrings = STRINGS.spaces.templates.palette;
  protected readonly typeStrings = STRINGS.spaces.elements.types;
  private readonly heading = viewChild<ElementRef<HTMLHeadingElement>>('heading');
  protected readonly query = signal('');
  protected readonly activeCategory = signal('tables');
  protected readonly modelKey = signal('');
  protected readonly name = signal('');
  protected readonly catalogStrings = STRINGS.spaces.editor.catalog;
  protected readonly definition = computed(() => mapDefinition(this.structure.establishmentType()));
  protected readonly categories = computed(() => this.definition().categories);
  protected readonly types = computed(() => [
    ...new Set(this.definition().models.map((model) => model.type)),
  ]);
  protected readonly category = computed(
    () =>
      this.categories().find((group) => group.key === this.activeCategory()) ??
      this.categories()[0],
  );
  protected readonly models = computed<ElementModel[]>(() => [
    ...this.definition().models,
    ...this.store
      .templates()
      .filter((template) => this.types().includes(template.type))
      .map((template) => ({
        key: 'tpl:' + template.id,
        type: template.type,
        label: template.name,
        size: TYPE_DEFAULTS[template.type].size,
        capacity: TYPE_DEFAULTS[template.type].capacity,
        category:
          this.definition().models.find((model) => model.type === template.type)!.category ?? '',
      })),
  ]);
  protected readonly visibleModels = computed(() => {
    const query = this.query().trim().toLocaleLowerCase();
    return this.models().filter((model) =>
      query
        ? model.label.toLocaleLowerCase().includes(query)
        : model.category === this.category()?.key,
    );
  });
  protected readonly selectedModel = computed(
    () =>
      this.visibleModels().find((model) => model.key === this.modelKey()) ??
      this.visibleModels()[0],
  );
  protected readonly reservable = computed(() => {
    const model = this.selectedModel();
    return model ? TYPE_DEFAULTS[model.type].reservable : false;
  });
  protected readonly capacity = linkedSignal(() => this.selectedModel()?.capacity ?? 1);
  protected readonly rows = linkedSignal(() => this.selectedModel()?.arrangement?.rows ?? 1);
  protected readonly columns = linkedSignal(() => this.selectedModel()?.arrangement?.columns ?? 1);
  protected readonly gap = linkedSignal(() => this.selectedModel()?.arrangement?.gap ?? 12);
  protected readonly arrangementFits = computed(() => {
    const model = this.selectedModel();
    if (!model?.arrangement) return true;
    const rows = this.rows(),
      columns = this.columns(),
      gap = this.gap();
    return (
      Number.isInteger(rows) &&
      Number.isInteger(columns) &&
      rows >= 1 &&
      columns >= 1 &&
      rows <= 10 &&
      columns <= 10 &&
      Number.isFinite(gap) &&
      gap >= 0 &&
      gap <= 200 &&
      columns * model.size.width + (columns - 1) * gap <= this.store.sectorSize().width &&
      rows * model.size.height + (rows - 1) * gap <= this.store.sectorSize().height
    );
  });
  protected readonly valid = computed(
    () =>
      !!this.selectedModel() &&
      this.arrangementFits() &&
      this.name().trim().length <= (this.selectedModel()?.arrangement ? 110 : 120) &&
      (!this.reservable() ||
        (Number.isSafeInteger(this.capacity()) &&
          this.capacity() >= 1 &&
          this.capacity() <= 2147483647)),
  );
  protected readonly previews = computed(() =>
    Object.fromEntries(
      this.visibleModels().map((model) => {
        const element: SpaceElement = {
          id: model.key,
          type: model.type,
          label: model.label,
          size: model.size,
          position: { x: 0, y: 0 },
          rotation: 0,
          state: 'AVAILABLE',
          capacity: model.capacity,
          reservable: TYPE_DEFAULTS[model.type].reservable,
          attributes: {},
        };
        return [model.key, this.port.furniturePreview?.(withElementFinish(element, model.finish))];
      }),
    ),
  );

  constructor() {
    effect(() => {
      const venue = this.context.active();
      untracked(() => {
        this.activeCategory.set('');
        this.modelKey.set('');
        this.name.set('');
        this.dragging = null;
        if (venue) this.structure.loadEstablishmentType(venue.id);
      });
    });
  }

  ngOnInit(): void {
    this.store.loadTemplates();
  }

  focus(): void {
    this.heading()?.nativeElement.focus();
  }

  protected choose(model: ElementModel): void {
    this.modelKey.set(model.key);
  }

  protected beginDrag(event: DragEvent, model: ElementModel): void {
    this.choose(model);
    const sectorId = this.store.sectorId();
    if (
      !event.dataTransfer ||
      !sectorId ||
      !this.valid() ||
      !this.store.canEdit() ||
      this.store.busy()
    ) {
      event.preventDefault();
      return;
    }
    const key = 'catalog:' + model.key;
    this.dragging = { key, sectorId, model, options: this.insertion(model) };
    event.dataTransfer.effectAllowed = 'copy';
    event.dataTransfer.setData('text/plain', key);
    this.dragStarted.emit();
  }

  protected endDrag(): void {
    this.dragging = null;
  }

  dropModel(key: string, x: number, y: number): void {
    const dragged = this.dragging;
    if (
      !dragged ||
      dragged.key !== key ||
      dragged.sectorId !== this.store.sectorId() ||
      !this.store.canEdit() ||
      this.store.busy()
    )
      return;
    this.dragging = null;
    const footprint = this.footprint(dragged.model);
    this.place(dragged.model, x - footprint.width / 2, y - footprint.height / 2, dragged.options);
  }

  private footprint(model: ElementModel): Size {
    return model.arrangement
      ? {
          width: this.columns() * model.size.width + (this.columns() - 1) * this.gap(),
          height: this.rows() * model.size.height + (this.rows() - 1) * this.gap(),
        }
      : model.size;
  }

  private insertion(model: ElementModel): ElementInsertion {
    return {
      size: model.size,
      capacity: TYPE_DEFAULTS[model.type].reservable ? this.capacity() : null,
      label: this.name().trim() || null,
      finish: model.finish,
    };
  }

  protected previewItems(model: ElementModel): number[] {
    return Array.from(
      { length: Math.min(12, (model.arrangement?.rows ?? 1) * (model.arrangement?.columns ?? 1)) },
      (_, index) => index,
    );
  }

  private place(model: ElementModel, x: number, y: number, options: ElementInsertion): void {
    if (model.arrangement) {
      this.store.createArrangement(
        model.type,
        x,
        y,
        this.rows(),
        this.columns(),
        this.gap(),
        options,
      );
    } else {
      this.store.createElementFromDrop(
        model.key.startsWith('tpl:') ? model.key : 'base:' + model.type,
        x,
        y,
        options,
      );
    }
    this.name.set('');
    this.inserted.emit();
  }

  protected insert(event: Event): void {
    event.preventDefault();
    const model = this.selectedModel();
    if (!model || !this.valid() || !this.store.canEdit() || this.store.busy()) return;
    const size = this.store.sectorSize();
    const footprint = this.footprint(model);
    this.place(
      model,
      (size.width - footprint.width) / 2,
      (size.height - footprint.height) / 2,
      this.insertion(model),
    );
  }
}
