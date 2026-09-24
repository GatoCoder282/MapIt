import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { map } from 'rxjs/operators';
import { toSignal } from '@angular/core/rxjs-interop';
import { SpaceElementListComponent } from './space-element-list';

/** Página de gestión de elementos espaciales dentro de un sector (HU-2.03 / MAP-117). */
@Component({
  selector: 'mapit-space-elements-page',
  imports: [SpaceElementListComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (sectorId(); as sid) {
      <mapit-space-element-list [sectorId]="sid" />
    }
  `,
  styles: `
    :host {
      display: block;
      padding: 1rem;
    }
  `,
})
export class SpaceElementsPageComponent {
  private readonly route = inject(ActivatedRoute);

  protected readonly sectorId = toSignal(
    this.route.paramMap.pipe(map((params) => params.get('sectorId'))),
  );
}
