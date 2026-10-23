import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { map } from 'rxjs/operators';
import { toSignal } from '@angular/core/rxjs-interop';
import { SpacesStore } from '../model/spaces-store';
import { SectorListComponent } from './sector-list';

/** Página de gestión de sectores de un piso (CU-05 · MAP-70). */
@Component({
  selector: 'mapit-sector-page',
  imports: [SectorListComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (floorId(); as fid) {
      <mapit-sector-list [floorId]="fid" [floorName]="floorName()" />
    }
  `,
  styles: `
    :host {
      display: block;
      padding: 1rem;
    }
  `,
})
export class SectorPageComponent {
  private readonly route = inject(ActivatedRoute);
  protected readonly store = inject(SpacesStore);

  protected readonly floorId = toSignal(
    this.route.paramMap.pipe(map((params) => params.get('floorId'))),
  );

  protected readonly floorName = toSignal(
    this.route.paramMap.pipe(
      map(() => {
        const fid = this.floorId();
        if (!fid) return 'Piso';
        const floor = this.store.floors().find((f) => f.id === fid);
        return floor?.name ?? 'Piso';
      }),
    ),
    { initialValue: 'Piso' },
  );
}
