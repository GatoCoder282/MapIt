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
  template: `<div
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
    </div>
    <p id="public-map-help">{{ strings.mapHelp }}</p>`,
  styles: `
    :host {
      display: block;
      min-width: 0;
    }
    p {
      margin: 0.5rem 0 0;
      color: var(--mapit-color-text-variant);
      font-size: 0.75rem;
      line-height: 1.5;
    }
    .map-scroll {
      scroll-margin-top: 7rem;
      height: 20rem;
      max-width: 100%;
      overflow: auto;
      border: 1px solid #adc9ff;
      border-radius: 20px;
      background-color: #f5f7fb;
      background-image:
        linear-gradient(#e6ecf5 1px, transparent 1px),
        linear-gradient(90deg, #e6ecf5 1px, transparent 1px);
      background-size: 40px 40px;
      box-shadow: 0 2px 5px rgb(38 83 163 / 0.12);
    }
    .map-scroll:focus-visible {
      outline: 2px solid var(--mapit-color-primary);
      outline-offset: 3px;
    }
    .map-host {
      position: relative;
      margin-inline: auto;
      background: white;
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
