import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { STRINGS } from '../core/strings';

/**
 * Placeholder de secciones del shell que aún no tienen caso de uso.
 * El título llega por ruta (`data: { title }` con withComponentInputBinding).
 */
@Component({
  selector: 'mapit-admin-placeholder',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="page">
      <h1>{{ title() }}</h1>
      <p class="intro">{{ strings.shell.sectionPending }}</p>
    </section>
  `,
  styles: `
    .page {
      max-width: 60rem;
    }
    h1 {
      margin: 0 0 0.5rem;
      font: var(--mapit-text-display);
      color: var(--mapit-color-text);
    }
    .intro {
      margin: 0;
      font: var(--mapit-text-body);
      color: var(--mapit-color-text-muted);
    }
  `,
})
export class AdminPlaceholder {
  readonly title = input.required<string>();
  protected readonly strings = STRINGS;
}
