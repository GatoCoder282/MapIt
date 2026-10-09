import {
  Component,
  effect,
  inject,
  type OnDestroy,
  viewChild,
  type ElementRef,
} from '@angular/core';
import { input } from '@angular/core';
import { type MapEnginePort, MAP_ENGINE } from '@mapit/map-engine';

@Component({
  selector: 'mapit-map-editor-canvas',
  imports: [],
  changeDetection: 0,
  template: `
    <div
      #canvasHost
      class="canvas-host"
      [style.width.px]="width()"
      [style.height.px]="height()"
    ></div>
  `,
  styles: `
    .canvas-host {
      width: 100%;
      height: 100%;
      min-width: 100%;
      min-height: 100%;
    }
  `,
})
export class MapEditorCanvasComponent implements OnDestroy {
  protected readonly canvasHost = viewChild.required<ElementRef<HTMLDivElement>>('canvasHost');

  private readonly port = inject<MapEnginePort>(MAP_ENGINE);

  readonly width = input<number>(1200);
  readonly height = input<number>(800);
  readonly editable = input<boolean>(true);

  constructor() {
    effect(() => {
      if (this.canvasHost()?.nativeElement) {
        this.port.setEditable(this.editable());
      }
    });

    effect(() => {
      this.port.setEditable(this.editable());
    });
  }

  // eslint-disable-next-line @angular-eslint/no-empty-lifecycle-method
  ngOnDestroy(): void {
    // The port destroy is handled by the page component - intentionally empty
  }

  get portInstance(): MapEnginePort {
    return this.port;
  }
}
