import { ChangeDetectionStrategy, Component } from '@angular/core';
import { LucideArrowLeft } from '@lucide/angular';
import { STRINGS } from '../../../core/strings';

@Component({
  selector: 'mapit-floor-setup-guide',
  imports: [LucideArrowLeft],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="guide" role="status">
      <header>
        <span class="direction" aria-hidden="true"><svg lucideArrowLeft></svg></span>
        <h2>{{ strings.floorSetupTitle }}</h2>
      </header>
      <p>{{ strings.floorSetupHint }}</p>
      <ol role="list">
        <li>{{ strings.floorSetupCreate }}</li>
        <li>{{ strings.floorSetupSelect }}</li>
      </ol>
    </section>
  `,
  styles: `
    :host {
      position: absolute;
      inset: 1rem;
      display: grid;
      place-items: center;
    }
    .guide {
      box-sizing: border-box;
      width: 100%;
      max-width: 36rem;
      padding: 1.5rem;
      border: 1px solid var(--mapit-color-border);
      border-radius: 1rem;
      background: var(--mapit-color-surface);
      color: var(--mapit-color-text);
    }
    header {
      display: flex;
      align-items: center;
      gap: 0.875rem;
    }
    .direction {
      display: grid;
      place-items: center;
      flex: none;
      width: 2.75rem;
      height: 2.75rem;
      border-radius: 0.75rem;
      background: var(--mapit-editor-selection-soft);
      color: var(--mapit-color-primary-hover);
    }
    svg {
      width: 1.5rem;
      height: 1.5rem;
    }
    h2 {
      margin: 0;
      color: var(--mapit-color-primary-hover);
      font: 750 1.375rem / 1.3 var(--mapit-font-display);
      text-wrap: balance;
    }
    p {
      margin: 1rem 0 1.25rem;
      color: var(--mapit-color-text-variant);
      line-height: 1.6;
    }
    ol {
      display: grid;
      gap: 0.875rem;
      margin: 0;
      padding: 0;
      list-style: none;
      counter-reset: step;
    }
    li {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      font-weight: 650;
      line-height: 1.5;
    }
    li::before {
      display: grid;
      place-items: center;
      flex: none;
      width: 1.75rem;
      height: 1.75rem;
      border-radius: 50%;
      background: var(--mapit-editor-selection);
      color: var(--mapit-color-on-primary);
      counter-increment: step;
      content: counter(step);
    }
    @media (max-width: 60rem) {
      svg {
        transform: rotate(90deg);
      }
    }
  `,
})
export class FloorSetupGuide {
  protected readonly strings = STRINGS.spaces.editor.workspace;
}
