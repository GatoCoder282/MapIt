import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  linkedSignal,
  output,
  viewChild,
  type ElementRef,
} from '@angular/core';
import { MAP_ENGINE, type RoomAppearance, type SpaceElement } from '@mapit/map-engine';
import {
  LucideArmchair,
  LucideCheck,
  LucideCircle,
  LucideEye,
  LucideLayers,
  LucideRectangleHorizontal,
  LucideSlidersHorizontal,
  LucideSquare,
} from '@lucide/angular';
import { STRINGS } from '../../../core/strings';
import {
  withElementFinish,
  type ElementFinish,
  type LayoutStyle,
} from '../../../core/spatial-layout';

const presets = {
  modern: {
    variant: 'round',
    boardColor: '#edbd73',
    color: '#145dca',
    boardMaterial: 'natural',
    boardEdge: 'none',
    chairStyle: 'modern',
  },
  classic: {
    variant: 'rectangle',
    boardColor: '#e4be8c',
    color: '#8a5637',
    boardMaterial: 'natural',
    boardEdge: 'natural',
    chairStyle: 'classic',
  },
  industrial: {
    variant: 'square',
    boardColor: '#afb6bc',
    color: '#505963',
    boardMaterial: 'stone',
    boardEdge: 'dark',
    chairStyle: 'modern',
  },
  barClassic: {
    variant: 'straight',
    color: '#b27743',
    boardColor: '#edbd73',
    boardMaterial: 'natural',
    boardEdge: 'natural',
    chairStyle: 'round',
    seatColor: '#dfbd94',
  },
  barModern: {
    variant: 'straight',
    color: '#b9935a',
    boardColor: '#ebe8e2',
    boardMaterial: 'stone',
    boardEdge: 'gold',
    chairStyle: 'round',
    seatColor: '#f0dcb9',
  },
  barLounge: {
    variant: 'island',
    color: '#513420',
    boardColor: '#78513c',
    boardMaterial: 'natural',
    boardEdge: 'dark',
    chairStyle: 'backed',
    seatColor: '#9b7356',
  },
  plantNatural: {
    variant: 'foliage',
    color: '#cab49c',
    boardColor: '#88ad38',
    boardMaterial: 'ceramic',
    visualScale: 'medium',
  },
  plantMinimal: {
    variant: 'planter',
    color: '#d6d3cf',
    boardColor: '#557943',
    boardMaterial: 'cement',
    visualScale: 'small',
  },
  plantTropical: {
    variant: 'palm',
    color: '#a25b3d',
    boardColor: '#429148',
    boardMaterial: 'clay',
    visualScale: 'large',
  },
  zoneDining: {
    variant: 'rectangle',
    color: '#93c5fd',
    zoneBorderColor: '#2563eb',
    zoneBorder: 'dashed',
    fillOpacity: 65,
    cornerRadius: 4,
  },
  zoneTerrace: {
    variant: 'rounded',
    color: '#a7e1b9',
    zoneBorderColor: '#388556',
    zoneBorder: 'solid',
    fillOpacity: 52,
    cornerRadius: 20,
  },
  zoneWaiting: {
    variant: 'rounded',
    color: '#cec0fb',
    zoneBorderColor: '#6d56aa',
    zoneBorder: 'dashed',
    fillOpacity: 55,
    cornerRadius: 14,
  },
} satisfies Record<string, ElementFinish>;

const presetGroups = {
  TABLE: ['modern', 'classic', 'industrial'],
  BAR: ['barClassic', 'barModern', 'barLounge'],
  DECOR: ['plantNatural', 'plantMinimal', 'plantTropical'],
  SECTOR_ZONE: ['zoneDining', 'zoneTerrace', 'zoneWaiting'],
} as const satisfies Partial<Record<SpaceElement['type'], readonly (keyof typeof presets)[]>>;

type Preset = keyof typeof presets | 'custom';

function labelPreferences({
  showName,
  showCapacity,
  labelStyle,
  labelPosition,
}: ElementFinish = {}): ElementFinish {
  return {
    ...(showName !== undefined ? { showName } : {}),
    ...(showCapacity !== undefined ? { showCapacity } : {}),
    ...(labelStyle ? { labelStyle } : {}),
    ...(labelPosition ? { labelPosition } : {}),
  };
}

const DEFAULT_ROOM: RoomAppearance = {
  floorColor: '#f1dfcd',
  wallColor: '#202d34',
  floorPattern: 'plain',
};

const variants = {
  TABLE: ['round', 'square', 'rectangle', 'oval'],
  DECOR: ['foliage', 'planter', 'palm'],
  BAR: ['straight', 'lShape', 'island'],
  SECTOR_ZONE: ['rectangle', 'rounded'],
} as const;

interface PendingApplication {
  sourceId: string;
  type: SpaceElement['type'];
  ids: readonly string[];
  finish: ElementFinish;
}
@Component({
  selector: 'mapit-layout-style',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    LucideArmchair,
    LucideCheck,
    LucideCircle,
    LucideEye,
    LucideLayers,
    LucideRectangleHorizontal,
    LucideSlidersHorizontal,
    LucideSquare,
  ],
  template: `
    @if (advanced()) {
      @if (element(); as selected) {
        <section class="surface advanced">
          <h3>{{ strings.mapLabel }}</h3>
          <label
            >{{ strings.showName }}
            <input
              class="toggle"
              type="checkbox"
              #showName
              [checked]="finish().showName !== false"
              (change)="updateElement({ showName: showName.checked }, false)"
            />
          </label>
          @if (selected.reservable) {
            <label
              >{{ strings.showCapacity }}
              <input
                class="toggle"
                type="checkbox"
                #capacity
                [checked]="finish().showCapacity !== false"
                (change)="updateElement({ showCapacity: capacity.checked }, false)"
              />
            </label>
          }
          <label class="field"
            >{{ strings.labelStyle }}
            <select
              #label
              [value]="finish().labelStyle ?? 'filled'"
              (change)="updateElement({ labelStyle: label.value }, false)"
            >
              <option value="filled">{{ strings.filled }}</option>
              <option value="outline">{{ strings.outline }}</option>
              <option value="text">{{ strings.text }}</option>
            </select>
          </label>
          @if (selected.type === 'SECTOR_ZONE') {
            <div class="field">
              <span id="zone-label-position">{{ strings.zoneLabelPosition }}</span>
              <div class="variants" role="group" aria-labelledby="zone-label-position">
                @for (position of labelPositions; track position) {
                  <button
                    type="button"
                    [attr.aria-pressed]="(finish().labelPosition ?? 'center') === position"
                    (click)="updateElement({ labelPosition: position }, false)"
                  >
                    {{ strings[position] }}
                  </button>
                }
              </div>
            </div>
          }
        </section>
      } @else {
        <p>{{ strings.select }}</p>
      }
    } @else {
      @if (element(); as selected) {
        <div class="style-overview style-overview-table">
          <section class="preview">
            <h3><svg lucideEye aria-hidden="true"></svg>{{ strings.preview }}</h3>
            @if (previewImage(); as image) {
              <!-- eslint-disable-next-line @angular-eslint/template/prefer-ngsrc -- vista previa del lienzo como Data URL -->
              <img data-testid="style-preview" [src]="image" [alt]="selected.label" />
            }
          </section>
          @if (presetOptions().length) {
            <section class="presets">
              <h3>{{ strings.presets }}</h3>
              <p>{{ strings.presetHelp }}</p>
              <div class="preset-grid" role="group" [attr.aria-label]="strings.presets">
                @for (preset of presetOptions(); track preset) {
                  <button
                    type="button"
                    [attr.aria-pressed]="(finish().preset ?? 'custom') === preset"
                    (click)="choosePreset(preset)"
                  >
                    @if (presetImages()[preset]; as image) {
                      <!-- eslint-disable-next-line @angular-eslint/template/prefer-ngsrc -- vista previa del lienzo como Data URL -->
                      <img [src]="image" alt="" />
                    } @else {
                      <svg lucideSlidersHorizontal aria-hidden="true"></svg>
                    }
                    <span>{{ strings[preset] }}</span>
                    @if ((finish().preset ?? 'custom') === preset) {
                      <span class="preset-check"><svg lucideCheck aria-hidden="true"></svg></span>
                    }
                  </button>
                }
              </div>
            </section>
          }
        </div>
        <section class="style-section">
          <h3><svg lucideLayers aria-hidden="true"></svg>{{ appearanceHeading() }}</h3>
          @if (choices().length > 1) {
            <div class="style-row">
              <span id="style-shape-label">{{
                selected.type === 'DECOR' ? strings.plantType : strings.shape
              }}</span>
              <div class="variants shape-options" role="group" aria-labelledby="style-shape-label">
                @for (choice of choices(); track $index) {
                  <button
                    type="button"
                    [attr.aria-pressed]="activeVariant() === choice"
                    (click)="updateElement({ variant: choice })"
                  >
                    @switch (choice) {
                      @case ('round') {
                        <svg lucideCircle aria-hidden="true"></svg>
                      }
                      @case ('square') {
                        <svg lucideSquare aria-hidden="true"></svg>
                      }
                      @case ('rectangle') {
                        <svg lucideRectangleHorizontal aria-hidden="true"></svg>
                      }
                    }
                    {{ strings[choice] }}
                  </button>
                }
              </div>
            </div>
          }
          @if (selected.type === 'TABLE') {
            <label class="style-row"
              >{{ strings.material }}
              <select
                #material
                [value]="finish().boardMaterial || 'natural'"
                (change)="setMaterial(material.value)"
              >
                <option value="natural">{{ strings.natural }}</option>
                <option value="stone">{{ strings.stone }}</option>
                <option value="solid">{{ strings.solid }}</option>
              </select>
            </label>
            <label class="style-row"
              >{{ strings.edgeFinish }}
              <select
                #edge
                [value]="finish().boardEdge || 'natural'"
                (change)="updateElement({ boardEdge: edge.value })"
              >
                <option value="none">{{ strings.none }}</option>
                <option value="natural">{{ strings.naturalEdge }}</option>
                <option value="dark">{{ strings.darkEdge }}</option>
              </select>
            </label>
            <div class="style-row">
              <p id="board-color-label">{{ strings.boardColor }}</p>
              <div class="swatches" role="group" aria-labelledby="board-color-label">
                @for (color of boardColors; track color) {
                  <button
                    type="button"
                    [style.background]="color"
                    [attr.aria-label]="strings.boardColor + ' ' + color"
                    [attr.aria-pressed]="finish().boardColor === color"
                    (click)="updateElement({ boardColor: color })"
                  ></button>
                }
                <input
                  type="color"
                  class="custom-swatch"
                  #board
                  [attr.aria-label]="strings.customColor"
                  [value]="finish().boardColor || '#edbd73'"
                  (input)="updateElement({ boardColor: board.value })"
                />
              </div>
            </div>
          } @else {
            @if (selected.type === 'BAR') {
              <label class="style-row"
                >{{ strings.material }}
                <select
                  #barMaterial
                  [value]="finish().boardMaterial || 'natural'"
                  (change)="setMaterial(barMaterial.value)"
                >
                  <option value="natural">{{ strings.natural }}</option>
                  <option value="stone">{{ strings.stone }}</option>
                  <option value="solid">{{ strings.solid }}</option>
                </select>
              </label>
              <label class="style-row"
                >{{ strings.barAccent }}
                <select
                  #accent
                  [value]="finish().boardEdge || 'natural'"
                  (change)="updateElement({ boardEdge: accent.value })"
                >
                  <option value="natural">{{ strings.naturalEdge }}</option>
                  <option value="gold">{{ strings.gold }}</option>
                  <option value="dark">{{ strings.darkEdge }}</option>
                  <option value="none">{{ strings.none }}</option>
                </select>
              </label>
              <label class="style-row"
                >{{ strings.stoolStyle }}
                <select
                  #stool
                  [value]="
                    finish().chairStyle ?? (finish().variant === 'counter' ? 'none' : 'round')
                  "
                  (change)="updateElement({ chairStyle: stool.value })"
                >
                  <option value="round">{{ strings.roundStool }}</option>
                  <option value="square">{{ strings.squareStool }}</option>
                  <option value="backed">{{ strings.backedStool }}</option>
                  <option value="none">{{ strings.noStools }}</option>
                </select>
              </label>
            } @else if (plant()) {
              <div class="style-row">
                <span id="plant-scale-label">{{ strings.visualSize }}</span>
                <div class="variants" role="group" aria-labelledby="plant-scale-label">
                  @for (size of visualSizes; track size) {
                    <button
                      type="button"
                      [attr.aria-pressed]="(finish().visualScale ?? 'medium') === size"
                      (click)="updateElement({ visualScale: size })"
                    >
                      {{ strings[size] }}
                    </button>
                  }
                </div>
              </div>
              <label class="style-row"
                >{{ strings.potMaterial }}
                <select
                  #pot
                  [value]="finish().boardMaterial || 'ceramic'"
                  (change)="updateElement({ boardMaterial: pot.value })"
                >
                  <option value="ceramic">{{ strings.ceramic }}</option>
                  <option value="cement">{{ strings.cement }}</option>
                  <option value="clay">{{ strings.clay }}</option>
                </select>
              </label>
            } @else if (selected.type === 'SECTOR_ZONE') {
              <label class="style-row"
                >{{ strings.opacity }}
                <span class="range-control">
                  <input
                    #opacity
                    type="range"
                    [attr.aria-label]="strings.opacity"
                    min="0"
                    max="100"
                    [value]="finish().fillOpacity ?? 65"
                    (input)="updateElement({ fillOpacity: opacity.valueAsNumber })"
                  />
                  <output>{{ finish().fillOpacity ?? 65 }}%</output>
                </span>
              </label>
              <label class="style-row"
                >{{ strings.edge }}
                <select
                  #border
                  [value]="finish().zoneBorder ?? 'dashed'"
                  (change)="setZoneBorder(border.value)"
                >
                  <option value="solid">{{ strings.zoneSolid }}</option>
                  <option value="dashed">{{ strings.dashed }}</option>
                  <option value="none">{{ strings.none }}</option>
                </select>
              </label>
              @if (activeVariant() === 'rounded') {
                <label class="style-row"
                  >{{ strings.cornerRadius }}
                  <span class="range-control">
                    <input
                      #radius
                      type="range"
                      [attr.aria-label]="strings.cornerRadius"
                      min="0"
                      max="40"
                      [value]="finish().cornerRadius ?? 16"
                      (input)="updateElement({ cornerRadius: radius.valueAsNumber })"
                    />
                    <output>{{ finish().cornerRadius ?? 16 }} px</output>
                  </span>
                </label>
              }
            }
            @for (palette of palettes(); track palette.key) {
              <div class="style-row">
                <span [id]="'style-palette-' + palette.key">{{ palette.label }}</span>
                <div
                  class="swatches"
                  role="group"
                  [attr.aria-labelledby]="'style-palette-' + palette.key"
                >
                  @for (color of palette.colors; track color) {
                    <button
                      type="button"
                      [style.background]="color"
                      [attr.aria-label]="palette.label + ' ' + color"
                      [attr.aria-pressed]="(finish()[palette.key] ?? palette.initial) === color"
                      (click)="setColor(palette.key, color)"
                    ></button>
                  }
                  <input
                    type="color"
                    class="custom-swatch"
                    #customColor
                    [attr.aria-label]="palette.label"
                    [value]="(finish()[palette.key] ?? palette.initial).slice(0, 7)"
                    (input)="setColor(palette.key, customColor.value)"
                  />
                </div>
              </div>
            }
          }
        </section>
        @if (selected.type === 'TABLE') {
          <section class="style-section">
            <h3><svg lucideArmchair aria-hidden="true"></svg>{{ strings.chairs }}</h3>
            <div class="seat-fields">
              <label class="style-row"
                >{{ strings.chairStyle }}
                <select
                  #chair
                  [value]="finish().chairStyle || 'modern'"
                  (change)="updateElement({ chairStyle: chair.value })"
                >
                  <option value="modern">{{ strings.modern }}</option>
                  <option value="classic">{{ strings.classic }}</option>
                </select>
              </label>
              <div class="style-row">
                <p id="chair-color-label">{{ strings.chairColor }}</p>
                <div class="swatches" role="group" aria-labelledby="chair-color-label">
                  @for (color of chairColors; track color) {
                    <button
                      type="button"
                      [style.background]="color"
                      [attr.aria-label]="strings.chairColor + ' ' + color"
                      [attr.aria-pressed]="finish().color === color"
                      (click)="updateElement({ color })"
                    ></button>
                  }
                  <input
                    type="color"
                    class="custom-swatch"
                    #chairColor
                    [attr.aria-label]="strings.customChairColor"
                    [value]="finish().color ?? defaultColor()"
                    (input)="updateElement({ color: chairColor.value })"
                  />
                </div>
              </div>
            </div>
          </section>
        }
        <section class="application">
          <label class="style-row scope-row">
            <span><svg lucideLayers aria-hidden="true"></svg>{{ strings.applyScope }}</span>
            <select
              data-testid="style-scope"
              #scope
              [value]="applicationScope()"
              (change)="setScope(scope.value)"
            >
              <option value="element">
                {{ scopeLabel() }}
              </option>
              <option value="similar">{{ strings.scopeSimilar }}</option>
              <option value="selected">{{ strings.scopeSelected }}</option>
            </select>
          </label>
          @if (applicationScope() !== 'element') {
            <p>{{ strings.similarHelp }}</p>
          }
          @if (applicationScope() === 'selected') {
            <fieldset class="target-list">
              <legend>{{ strings.selectTargets }}</legend>
              @for (target of compatibleElements(); track target.id) {
                <label>
                  <input
                    type="checkbox"
                    [attr.data-testid]="'style-target-' + target.id"
                    [checked]="selectedTargets().includes(target.id)"
                    (change)="toggleTarget(target.id)"
                  />
                  {{ target.label }}
                </label>
              }
            </fieldset>
          }
          @if (applicationScope() !== 'element') {
            <button
              class="apply"
              data-testid="style-apply"
              type="button"
              [disabled]="!targetIds().length"
              (click)="requestApply()"
            >
              <svg lucideCheck aria-hidden="true"></svg>
              {{ applyLabel() }}
            </button>
          }
          <button type="button" (click)="resetElement()">{{ strings.reset }}</button>
        </section>
      } @else {
        <p>{{ strings.select }}</p>
      }
      <details class="surface environment" [open]="!element()">
        <summary>{{ strings.environment }}</summary>
        <section>
          <label
            >{{ strings.wall }}
            <input
              type="color"
              #wall
              [value]="room().wallColor"
              (input)="updateRoom({ wallColor: wall.value })"
          /></label>
          <label
            >{{ strings.floor }}
            <input
              type="color"
              #floor
              [value]="room().floorColor"
              (input)="updateRoom({ floorColor: floor.value })"
          /></label>
          <label
            >{{ strings.pattern }}
            <select #pattern [value]="room().floorPattern" (change)="setPattern(pattern.value)">
              <option value="plain">{{ strings.plain }}</option>
              <option value="tile">{{ strings.tile }}</option>
              <option value="wood">{{ strings.wood }}</option>
            </select>
          </label>
          <button type="button" (click)="resetRoom()">{{ strings.reset }}</button>
        </section>
      </details>
    }
    <dialog
      #confirmation
      class="style-confirmation"
      aria-labelledby="style-confirm-title"
      (cancel)="cancelApply()"
    >
      <h3 id="style-confirm-title">{{ strings.confirmTitle }}</h3>
      <p>{{ strings.confirmHelp.replace('{count}', pendingCount().toString()) }}</p>
      <ul>
        @for (target of pendingLabels(); track $index) {
          <li>{{ target }}</li>
        }
      </ul>
      <div class="confirmation-actions">
        <button type="button" (click)="cancelApply()">{{ strings.cancel }}</button>
        <button class="apply" type="button" (click)="confirmApply()">
          {{ strings.applyCount.replace('{count}', pendingCount().toString()) }}
        </button>
      </div>
    </dialog>
  `,
  styles: `
    :host {
      display: grid;
      gap: 0.55rem;
      font-size: 0.8125rem;
      min-width: 0;
      container-type: inline-size;
    }
    section {
      display: grid;
      gap: 0.65rem;
    }
    h3,
    p {
      margin: 0;
    }
    h3 {
      font: var(--mapit-text-body-bold);
      font-size: 0.9rem;
    }
    .surface {
      min-width: 0;
      border: 1px solid var(--mapit-color-border);
      border-radius: 0.75rem;
      padding: 0.65rem;
      background: color-mix(
        in srgb,
        var(--mapit-editor-selection-soft) 26%,
        var(--mapit-color-surface)
      );
    }
    .style-overview,
    .preset-grid,
    .seat-fields {
      display: grid;
      gap: 0.4rem;
      min-width: 0;
    }
    .style-overview-table {
      grid-template-columns: minmax(0, 0.62fr) minmax(0, 1fr);
      gap: 0.65rem;
    }
    .presets {
      align-content: start;
      gap: 0.35rem;
    }
    .presets > p {
      line-height: 1.3;
    }
    .preset-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
    @container (min-width: 31rem) {
      .preset-grid {
        grid-template-columns: repeat(4, minmax(0, 1fr));
      }
    }
    @container (max-width: 19rem) {
      .style-overview-table {
        grid-template-columns: minmax(0, 1fr);
      }
      .preset-grid {
        grid-template-columns: repeat(4, minmax(0, 1fr));
      }
    }
    .preset-grid button {
      position: relative;
      display: grid;
      justify-items: center;
      align-content: center;
      gap: 0.15rem;
      min-height: 3.65rem;
      padding: 0.3rem 0.15rem;
      font-size: 0.72rem;
      overflow-wrap: anywhere;
      background: color-mix(
        in srgb,
        var(--mapit-editor-selection-soft) 12%,
        var(--mapit-color-surface)
      );
      box-shadow: 0 2px 4px rgb(36 72 124 / 9%);
    }
    .preset-grid img,
    .preset-grid svg {
      width: 2.25rem;
      height: 2.25rem;
    }
    .preset-check {
      position: absolute;
      inset-block-start: 0.2rem;
      inset-inline-end: 0.2rem;
      display: grid;
      place-items: center;
      width: 1rem;
      height: 1rem;
      background: var(--mapit-editor-selection);
      color: var(--mapit-color-on-primary);
      border-radius: 50%;
    }
    .preset-check svg,
    .style-row svg,
    h3 svg,
    .apply svg {
      flex: none;
      width: 1rem;
      height: 1rem;
    }
    .preview {
      align-content: space-between;
      min-height: 9rem;
      border-radius: 0.8rem;
      padding: 0.55rem;
      background: linear-gradient(145deg, #e3edff, #cdddf7);
    }
    .preview h3 {
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
      width: fit-content;
      border-radius: 1rem;
      background: var(--mapit-color-surface);
      padding: 0.3rem 0.55rem;
      font-size: 0.7rem;
    }
    .preview img {
      display: block;
      width: 100%;
      max-width: 10.5rem;
      aspect-ratio: 1;
      object-fit: contain;
      justify-self: center;
    }
    .style-section,
    .application {
      border-top: 1px solid var(--mapit-color-border);
      padding-block-start: 0.55rem;
      gap: 0.32rem;
    }
    .style-section h3,
    .scope-row span {
      display: flex;
      align-items: center;
      gap: 0.45rem;
    }
    .style-section h3 svg,
    .scope-row svg {
      color: var(--mapit-editor-selection);
    }
    .style-row {
      display: grid;
      grid-template-columns: minmax(5.3rem, 0.85fr) minmax(0, 2.15fr);
      align-items: center;
      gap: 0.45rem;
      min-width: 0;
    }
    .style-row > select {
      width: 100%;
    }
    .scope-row {
      padding: 0.5rem;
      border-radius: 0.62rem;
      background: var(--mapit-editor-selection-soft);
    }
    .shape-options button {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 0.22rem;
      flex: 1 1 auto;
      font-size: 0.68rem;
      padding-inline: 0.28rem;
    }
    .shape-options button svg {
      width: 0.72rem;
      height: 0.72rem;
    }
    .shape-options button[aria-pressed='true'] {
      background: var(--mapit-editor-selection);
      color: var(--mapit-color-on-primary);
    }
    .range-control {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 0.35rem;
      align-items: center;
    }
    .range-control input {
      width: 100%;
      margin: 0;
      padding: 0;
      accent-color: var(--mapit-editor-selection);
    }
    .range-control output {
      min-width: 2.8rem;
      text-align: end;
      font-variant-numeric: tabular-nums;
    }
    .field {
      display: grid;
      gap: 0.2rem;
      align-content: start;
      min-width: 0;
    }
    .field select {
      width: 100%;
    }
    .swatches {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 0.25rem;
    }
    .swatches button,
    .swatches input[type='color'] {
      min-height: 1.75rem;
      width: 1.75rem;
      padding: 0;
      border-radius: 50%;
    }
    .swatches input[type='color'] {
      padding: 0.18rem;
    }
    .swatches .custom-swatch {
      background: conic-gradient(from 20deg, #ffd64b, #f55672, #795df4, #34bafa, #66ce7b, #ffd64b);
      cursor: pointer;
    }
    .custom-swatch::-webkit-color-swatch {
      opacity: 0;
    }
    .custom-swatch::-moz-color-swatch {
      opacity: 0;
    }
    .swatches button[aria-pressed='true'] {
      outline: 2px solid var(--mapit-editor-selection);
      outline-offset: 1px;
    }
    .environment summary {
      font-weight: 700;
      cursor: pointer;
      padding-block: 0.15rem;
    }
    .environment[open] section {
      margin-block-start: 0.6rem;
    }
    .toggle {
      appearance: none;
      flex: none;
      display: inline-grid;
      align-items: center;
      min-height: 0;
      width: 2.15rem;
      height: 1.2rem;
      padding: 0.13rem;
      border-radius: 1rem;
      background: var(--mapit-color-border-input);
      cursor: pointer;
    }
    .toggle::before {
      content: '';
      width: 0.83rem;
      height: 0.83rem;
      border-radius: 50%;
      background: var(--mapit-color-surface);
    }
    .toggle:checked {
      border-color: var(--mapit-editor-selection);
      background: var(--mapit-editor-selection);
    }
    .toggle:checked::before {
      justify-self: end;
    }
    @media (forced-colors: active) {
      .toggle {
        appearance: auto;
      }
      .toggle::before {
        content: none;
      }
    }
    .apply {
      border-color: var(--mapit-editor-selection);
      background: var(--mapit-editor-selection);
      color: var(--mapit-color-on-primary);
      font-weight: 700;
    }
    .application > .apply {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.55rem;
      min-height: 2.5rem;
      background: linear-gradient(110deg, #0868ee, #004bdc);
    }
    .target-list {
      display: grid;
      gap: 0.4rem;
      margin: 0;
      padding: 0.5rem;
      max-height: 12rem;
      overflow: auto;
      border: 1px solid var(--mapit-color-border);
      border-radius: 0.5rem;
    }
    .target-list label {
      justify-content: start;
      overflow-wrap: anywhere;
    }
    .target-list input {
      flex: none;
      min-height: 0;
      accent-color: var(--mapit-editor-selection);
    }
    .style-confirmation {
      box-sizing: border-box;
      width: min(28rem, calc(100vw - 2rem));
      max-height: calc(100dvh - 2rem);
      padding: 1.25rem;
      border: 1px solid var(--mapit-color-border);
      border-radius: 0.875rem;
      background: var(--mapit-color-surface);
      color: var(--mapit-color-text);
      box-shadow: 0 20px 60px rgb(15 23 42 / 0.22);
    }
    .style-confirmation::backdrop {
      background: rgb(11 19 43 / 0.5);
    }
    .style-confirmation h3 {
      margin-bottom: 0.75rem;
      font-size: 1.125rem;
    }
    .style-confirmation ul {
      max-height: 10rem;
      overflow: auto;
      padding-inline-start: 1.25rem;
      overflow-wrap: anywhere;
    }
    .confirmation-actions {
      display: flex;
      flex-wrap: wrap;
      justify-content: end;
      gap: 0.5rem;
      margin-top: 1rem;
    }
    :is(button, input, select, summary):focus-visible {
      outline: 2px solid var(--mapit-editor-selection);
      outline-offset: 2px;
    }
    button:disabled {
      opacity: 0.55;
    }
    label {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.5rem;
    }
    .variants {
      display: flex;
      flex-wrap: wrap;
      gap: 0.35rem;
    }
    button,
    select,
    input {
      min-height: 2rem;
      min-width: 0;
      border: 1px solid var(--mapit-color-border-input);
      border-radius: 0.5rem;
      background: var(--mapit-color-surface);
      color: var(--mapit-color-text);
      font: inherit;
      padding: 0.3rem 0.6rem;
    }
    input[type='color'] {
      width: 3rem;
      padding: 0.2rem;
    }
    button[aria-pressed='true'] {
      background: var(--mapit-editor-selection-soft);
      border-color: var(--mapit-editor-selection);
      color: var(--mapit-color-primary-hover);
    }
    p {
      color: var(--mapit-color-text-variant);
      font: var(--mapit-text-metadata);
    }
  `,
})
export class LayoutStyleComponent {
  readonly appearance = input.required<LayoutStyle>();
  readonly element = input<SpaceElement | null>(null);
  readonly elements = input<readonly SpaceElement[]>([]);
  readonly advanced = input(false);
  readonly styleChange = output<(current: LayoutStyle) => LayoutStyle>();
  protected readonly strings = STRINGS.spaces.editor.style;
  private readonly port = inject(MAP_ENGINE);
  protected readonly plant = computed(
    () =>
      this.element()?.type === 'DECOR' &&
      ['', 'foliage', 'planter', 'palm'].includes(this.finish().variant ?? ''),
  );
  protected readonly presetOptions = computed<readonly Preset[]>(() => {
    const type = this.element()?.type;
    if (type === 'DECOR' && !this.plant()) return [];
    return type && type in presetGroups
      ? [...presetGroups[type as keyof typeof presetGroups], 'custom']
      : [];
  });
  protected readonly boardColors = ['#edbd73', '#b6814c', '#80553a', '#f3eee7', '#a8b0ba'];
  protected readonly chairColors = ['#145dca', '#60944d', '#cf9857', '#c4cbd1', '#353a40'];
  protected readonly visualSizes = ['small', 'medium', 'large'] as const;
  protected readonly labelPositions = ['top', 'center', 'bottom'] as const;
  protected readonly appearanceHeading = computed(() => {
    switch (this.element()?.type) {
      case 'TABLE':
        return this.strings.tableAppearance;
      case 'BAR':
        return this.strings.barAppearance;
      case 'DECOR':
        return this.plant() ? this.strings.plantAppearance : this.strings.appearance;
      case 'SECTOR_ZONE':
        return this.strings.zoneAppearance;
      default:
        return this.strings.appearance;
    }
  });
  protected readonly scopeLabel = computed(() => {
    switch (this.element()?.type) {
      case 'TABLE':
        return this.strings.scopeTable;
      case 'BAR':
        return this.strings.scopeBar;
      case 'DECOR':
        return this.plant() ? this.strings.scopePlant : this.strings.scopeElement;
      case 'SECTOR_ZONE':
        return this.strings.scopeZone;
      default:
        return this.strings.scopeElement;
    }
  });
  protected readonly room = computed(() => this.appearance().room ?? DEFAULT_ROOM);
  private readonly draft = linkedSignal<string | undefined, ElementFinish>({
    source: () => this.element()?.id,
    computation: () => ({}),
  });
  protected readonly applicationScope = linkedSignal({
    source: () => this.element()?.id,
    computation: (): 'element' | 'similar' | 'selected' => 'element',
  });
  protected readonly selectedTargets = linkedSignal({
    source: () => this.element()?.id,
    computation: (id): readonly string[] => (id ? [id] : []),
  });
  private readonly pending = linkedSignal<string | undefined, PendingApplication | null>({
    source: () => this.element()?.id,
    computation: () => null,
  });
  private readonly confirmation = viewChild<ElementRef<HTMLDialogElement>>('confirmation');
  protected readonly pendingCount = computed(() => this.pending()?.ids.length ?? 0);
  protected readonly pendingLabels = computed(() => {
    const ids = this.pending()?.ids ?? [];
    return this.compatibleElements()
      .filter((element) => ids.includes(element.id))
      .map(({ label }) => label);
  });
  protected readonly choices = computed(() => {
    const type = this.element()?.type;
    if (type === 'DECOR' && !this.plant()) return [];
    return type && type in variants ? variants[type as keyof typeof variants] : [];
  });
  protected readonly finish = computed(() => ({
    ...this.appearance().elements[this.element()?.id ?? ''],
    ...this.draft(),
  }));
  protected readonly activeVariant = computed(() => {
    const variant = this.finish().variant;
    if (this.choices().some((choice) => choice === variant)) return variant;
    const item = this.element();
    if (item?.type === 'TABLE') {
      const { width, height } = item.size;
      return Math.max(width, height) / Math.min(width, height) < 1.15 ? 'round' : 'rectangle';
    }
    return this.choices()[0];
  });
  protected readonly palettes = computed(() => {
    switch (this.element()?.type) {
      case 'BAR':
        return [
          {
            key: 'color',
            label: this.strings.barBodyColor,
            colors: this.boardColors,
            initial: '#b27743',
          },
          {
            key: 'boardColor',
            label: this.strings.barTopColor,
            colors: ['#ebe8e2', '#edbd73', '#a8b0ba', '#353a40'],
            initial: '#edbd73',
          },
          {
            key: 'seatColor',
            label: this.strings.stoolColor,
            colors: ['#f0dcb9', '#ad805c', '#60944d', '#49628f'],
            initial: '#dfbd94',
          },
        ] as const;
      case 'DECOR':
        if (!this.plant())
          return [
            {
              key: 'color',
              label: this.strings.color,
              colors: this.chairColors,
              initial: '#64748b',
            },
          ] as const;
        return [
          {
            key: 'color',
            label: this.strings.potColor,
            colors: ['#cab49c', '#d6d3cf', '#454545', '#a25b3d'],
            initial: '#655342',
          },
          {
            key: 'boardColor',
            label: this.strings.foliageColor,
            colors: ['#88ad38', '#557943', '#31622d', '#b5c751'],
            initial: '#90b82e',
          },
        ] as const;
      case 'SECTOR_ZONE':
        return [
          {
            key: 'color',
            label: this.strings.zoneFill,
            colors: ['#93c5fd', '#a7e1b9', '#f8dc84', '#fbc6a0', '#cec0fb'],
            initial: '#93c5fd',
          },
          {
            key: 'zoneBorderColor',
            label: this.strings.zoneStrokeColor,
            colors: ['#2563eb', '#526179', '#388556', '#ae7840', '#6d56aa'],
            initial: '#2563eb',
          },
        ] as const;
      default:
        return [
          { key: 'color', label: this.strings.color, colors: this.chairColors, initial: '#64748b' },
        ] as const;
    }
  });
  protected readonly previewImage = computed(() => {
    const selected = this.element();
    return selected
      ? this.port.furniturePreview?.(withElementFinish(selected, this.finish()))
      : null;
  });
  protected readonly presetImages = computed(() => {
    const selected = this.element();
    return Object.fromEntries(
      this.presetOptions().map((preset) => [
        preset,
        selected && preset !== 'custom'
          ? this.port.furniturePreview?.(withElementFinish(selected, presets[preset]))
          : null,
      ]),
    );
  });
  protected readonly compatibleElements = computed(() => {
    const element = this.element();
    if (!element) return [];
    const variant = this.appearance().elements[element.id]?.variant;
    return this.elements().filter(
      (other) =>
        other.type === element.type &&
        (!['ROOM', 'STAGE', 'DECOR'].includes(element.type) ||
          this.appearance().elements[other.id]?.variant === variant),
    );
  });
  protected readonly targetIds = computed(() => {
    const element = this.element();
    if (!element) return [];
    if (this.applicationScope() === 'element') return [element.id];
    return this.compatibleElements()
      .filter(
        (other) =>
          this.applicationScope() === 'similar' || this.selectedTargets().includes(other.id),
      )
      .map(({ id }) => id);
  });
  protected readonly applyLabel = computed(() => {
    const template =
      this.applicationScope() === 'similar'
        ? this.strings.applySimilarCount
        : this.strings.applyCount;
    return template.replace('{count}', this.targetIds().length.toString());
  });
  protected readonly defaultColor = computed(() => {
    switch (this.element()?.type) {
      case 'BAR':
        return '#d7a473';
      case 'DECOR':
        return '#655342';
      default:
        return '#56676a';
    }
  });

  constructor() {
    effect(() => {
      const request = this.pending();
      const dialog = this.confirmation()?.nativeElement;
      if (!request && dialog?.open) dialog.close();
    });
  }

  protected updateRoom(change: Partial<RoomAppearance>): void {
    this.styleChange.emit((current) => ({
      ...current,
      room: { ...(current.room ?? DEFAULT_ROOM), ...change },
    }));
  }

  protected setPattern(value: string): void {
    if (value === 'plain' || value === 'tile' || value === 'wood')
      this.updateRoom({ floorPattern: value });
  }

  protected resetRoom(): void {
    this.styleChange.emit((current) => ({ elements: current.elements }));
  }

  protected choosePreset(preset: Preset): void {
    this.updateElement(preset === 'custom' ? { preset } : { ...presets[preset], preset });
  }

  protected setMaterial(material: string): void {
    this.updateElement({
      boardMaterial: material,
      boardColor: material === 'stone' ? '#d4d9df' : material === 'solid' ? '#f1f3f7' : '#edbd73',
    });
  }

  protected setZoneBorder(zoneBorder: string): void {
    if (zoneBorder === 'solid' || zoneBorder === 'dashed' || zoneBorder === 'none') {
      this.updateElement({ zoneBorder });
    }
  }

  protected setColor(
    key: 'color' | 'boardColor' | 'seatColor' | 'zoneBorderColor',
    color: string,
  ): void {
    this.updateElement({ [key]: color });
  }

  protected updateElement(change: ElementFinish, visual = true): void {
    const element = this.element();
    if (!element) return;
    if (visual && this.applicationScope() !== 'element') {
      this.draft.update((draft) => ({ ...draft, preset: 'custom', ...change }));
      return;
    }
    this.styleChange.emit((current) => ({
      ...current,
      elements: {
        ...current.elements,
        [element.id]: {
          ...current.elements[element.id],
          ...(visual ? { preset: 'custom' as const } : {}),
          ...change,
        },
      },
    }));
  }

  protected setScope(scope: string): void {
    if (scope === 'element' || scope === 'similar' || scope === 'selected') {
      this.applicationScope.set(scope);
      if (scope === 'element') this.draft.set({});
    }
  }

  protected toggleTarget(id: string): void {
    if (!this.compatibleElements().some((element) => element.id === id)) return;
    this.selectedTargets.update((ids) =>
      ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id],
    );
  }

  protected requestApply(): void {
    const selected = this.element();
    const ids = this.targetIds();
    if (!selected || !ids.length) return;
    const {
      showName: _name,
      showCapacity: _capacity,
      labelStyle: _label,
      labelPosition: _position,
      ...finish
    } = this.finish();
    const request: PendingApplication = { sourceId: selected.id, type: selected.type, ids, finish };
    if (ids.length === 1) {
      this.apply(request);
      return;
    }
    this.pending.set(request);
    this.confirmation()?.nativeElement.showModal();
  }

  protected confirmApply(): void {
    const request = this.pending();
    if (request) this.apply(request);
    this.cancelApply();
  }

  protected cancelApply(): void {
    this.confirmation()?.nativeElement.close();
    this.pending.set(null);
  }

  private apply(request: PendingApplication): void {
    const selected = this.element();
    if (!selected || selected.id !== request.sourceId || selected.type !== request.type) return;
    const compatible = new Set(this.compatibleElements().map(({ id }) => id));
    compatible.add(selected.id);
    if (request.ids.some((id) => !compatible.has(id))) return;
    this.styleChange.emit((current) => {
      const elements = { ...current.elements };
      for (const id of request.ids) {
        elements[id] = { ...labelPreferences(elements[id]), ...request.finish };
      }
      return { ...current, elements };
    });
  }

  protected resetElement(): void {
    const element = this.element();
    if (!element) return;
    const preset = this.presetOptions()[0];
    const finish: ElementFinish =
      preset && preset !== 'custom'
        ? { ...presets[preset], preset }
        : { variant: this.appearance().elements[element.id]?.variant ?? 'default' };
    if (this.applicationScope() === 'element') {
      this.apply({ sourceId: element.id, type: element.type, ids: [element.id], finish });
    } else {
      this.draft.set(finish);
    }
  }
}
