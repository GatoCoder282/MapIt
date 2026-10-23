import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

import { STRINGS } from '../../core/strings';

@Component({
  selector: 'mapit-not-found',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="nf">
      <h1>{{ strings.notFound.code }}</h1>
      <p>{{ strings.notFound.title }}</p>
      <a routerLink="/">{{ strings.notFound.backHome }}</a>
    </section>
  `,
  styles: `
    .nf {
      padding: 4rem 2rem;
      text-align: center;
    }
  `,
})
export class NotFound {
  protected readonly strings = STRINGS;
}
