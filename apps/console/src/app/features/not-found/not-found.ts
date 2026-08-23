import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'mapit-not-found',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="nf">
      <h1>404</h1>
      <p>Esta página no existe.</p>
      <a routerLink="/">Volver al inicio</a>
    </section>
  `,
  styles: `
    .nf {
      padding: 4rem 2rem;
      text-align: center;
    }
  `,
})
export class NotFound {}
