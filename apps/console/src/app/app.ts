import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

/**
 * Raíz de la aplicación.
 *
 * Nota sobre el nombre del archivo: `app.ts`, no `app.component.ts`.
 * El style guide oficial de Angular pide nombres SIN sufijo de tipo.
 */
@Component({
  selector: 'mapit-root',
  imports: [RouterOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="shell">
      <router-outlet />
    </main>
  `,
  styles: `
    .shell {
      display: flex;
      flex-direction: column;
      min-height: 100dvh;
    }
  `,
})
export class App {}
