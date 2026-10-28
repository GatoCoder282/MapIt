import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  type ElementRef,
  effect,
  inject,
  input,
  output,
  untracked,
  viewChild,
} from '@angular/core';
import { MAP_ENGINE, type MapLayout } from '@mapit/map-engine';
import { STRINGS } from '../../../core/strings';

@Component({
  selector: 'mp-public-map',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: ` <p id="public-map-help">{{ strings.mapHelp }}</p>
    <div
      class="map-scroll"
      tabindex="0"
      role="region"
      [attr.aria-label]="strings.mapTitle"
      aria-describedby="public-map-help"
    >
      <div
        #host
        class="map-host"
        role="img"
        [attr.aria-label]="strings.mapTitle + ': ' + layout().name"
        [style.width.px]="layout().size.width"
        [style.height.px]="layout().size.height"
      ></div>
    </div>`,
  styles: `
    :host {
      display: block;
      min-width: 0;
    }
    p {
      color: var(--mapit-color-text-variant);
      font-size: 0.875rem;
      line-height: 1.6;
    }
    .map-scroll {
      scroll-margin-top: 7rem;
      max-height: 28rem;
      max-width: 100%;
      overflow: auto;
      border: 1px solid var(--mapit-color-border);
      border-radius: 12px;
    }
    .map-scroll:focus-visible {
      outline: 2px solid var(--mapit-color-primary);
      outline-offset: 3px;
    }
    .map-host {
      position: relative;
    }
  `,
})
export class PublicMap {
  readonly layout = input.required<MapLayout>();
  readonly selectedId = input<string | null>(null);
  readonly selected = output<string | null>();
  private readonly port = inject(MAP_ENGINE);
  private readonly host = viewChild.required<ElementRef<HTMLElement>>('host');
  private mounted = false;
  private currentLayout: MapLayout | null = null;
  protected readonly strings = STRINGS.availability;
  constructor() {
    inject(DestroyRef).onDestroy(() => this.port.destroy());
    effect(() => {
      const layout = this.layout();
      const host = this.host().nativeElement;
      const selected = this.selectedId();
      untracked(() => {
        this.port.setEditable(false);
        if (!this.mounted) {
          this.port.mount(host, layout);
          this.port.onElementClick(({ id }) => {
            const element = this.layout().elements.find((item) => item.id === id);
            if (id === null || (element?.reservable && element.availability === 'AVAILABLE'))
              this.selected.emit(id);
            else this.port.setSelectedElement(this.selectedId());
          });
          this.mounted = true;
        } else if (this.currentLayout !== layout) this.port.load(layout);
        this.currentLayout = layout;
        this.port.setEditable(false);
        this.port.setSelectedElement(selected);
      });
    });
  }
}
