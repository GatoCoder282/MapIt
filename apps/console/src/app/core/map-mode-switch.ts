import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LucideActivity, LucidePencilRuler } from '@lucide/angular';
import { FeatureFlagService } from '@mapit/feature-flags';
import { STRINGS } from './strings';

@Component({
  selector: 'mapit-map-mode-switch',
  imports: [RouterLink, LucideActivity, LucidePencilRuler],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <nav [attr.aria-label]="strings.mode">
      @if (mode() === 'monitor') {
        <span aria-current="page"
          ><svg lucideActivity aria-hidden="true"></svg>{{ strings.monitorMode }}</span
        >
      } @else if (monitorEnabled()) {
        <a routerLink="/map" [queryParams]="{ floorId: floorId(), sectorId: sectorId() }">
          <svg lucideActivity aria-hidden="true"></svg>{{ strings.map }}
        </a>
      }
      @if (canEdit()) {
        @if (mode() === 'edit') {
          <span aria-current="page"
            ><svg lucidePencilRuler aria-hidden="true"></svg>{{ strings.editMode }}</span
          >
        } @else {
          <a
            [routerLink]="sectorId() ? ['/spaces/editor', sectorId()] : ['/spaces/editor']"
            [queryParams]="{ floorId: floorId() }"
          >
            <svg lucidePencilRuler aria-hidden="true"></svg>{{ strings.editMode }}
          </a>
        }
      }
    </nav>
  `,
  styles: `
    :host {
      display: inline-block;
      max-width: 100%;
    }
    nav {
      display: inline-flex;
      flex-wrap: wrap;
      gap: 0.2rem;
      padding: 0.2rem;
      border: 1px solid var(--mapit-color-border);
      border-radius: 0.65rem;
      background: var(--mapit-color-surface);
    }
    a,
    span {
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
      min-height: 2.35rem;
      padding: 0.35rem 0.7rem;
      border-radius: 0.45rem;
      color: var(--mapit-color-text-muted);
      font-size: 0.8125rem;
      font-weight: 650;
      text-decoration: none;
    }
    a:hover {
      background: var(--mapit-color-surface-low);
    }
    span[aria-current] {
      color: white;
      background: var(--mapit-editor-selection, #2563eb);
    }
    a:focus-visible {
      outline: 2px solid var(--mapit-editor-selection, #2563eb);
      outline-offset: 2px;
    }
    svg {
      width: 1rem;
      height: 1rem;
    }
  `,
})
export class MapModeSwitch {
  protected readonly strings = STRINGS.spaces.editor.workspace;
  protected readonly monitorEnabled = inject(FeatureFlagService).isEnabled(
    'operations.space-monitor',
  );
  readonly mode = input.required<'edit' | 'monitor'>();
  readonly canEdit = input.required<boolean>();
  readonly floorId = input<string | null>(null);
  readonly sectorId = input<string | null>(null);
}
