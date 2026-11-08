import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { map } from 'rxjs/operators';
import { toSignal } from '@angular/core/rxjs-interop';
import { SpacesStore } from '../model/spaces-store';
import { SectorListComponent } from './sector-list';
import { confirmOperationalExit } from '../../../core/operational-exit-guard';

/** Página de gestión de sectores de un piso (CU-05 · MAP-70). */
@Component({
  selector: 'mapit-sector-page',
  imports: [SectorListComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (displayedFloorId(); as fid) {
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
  private readonly router = inject(Router);
  protected readonly store = inject(SpacesStore);
  private readonly sectorList = viewChild(SectorListComponent);
  protected readonly displayedFloorId = signal<string | null>(null);

  canDeactivate(): boolean {
    return confirmOperationalExit(this.store.busy(), this.sectorList()?.dirty() ?? false);
  }

  private readonly floorId = toSignal(
    this.route.paramMap.pipe(map((params) => params.get('floorId'))),
  );

  protected readonly floorName = computed(() => {
    const id = this.displayedFloorId();
    if (!id) return 'Piso';
    return this.store.floors().find((floor) => floor.id === id)?.name ?? 'Piso';
  });

  constructor() {
    effect(() => {
      const nextFloorId = this.floorId();
      if (!nextFloorId) return;
      const currentFloorId = this.displayedFloorId();
      if (!currentFloorId) {
        this.displayedFloorId.set(nextFloorId);
        return;
      }
      if (nextFloorId === currentFloorId) return;
      if (!confirmOperationalExit(this.store.busy(), this.sectorList()?.dirty() ?? false)) {
        void this.router.navigate(['/spaces/floors', currentFloorId, 'sectors'], {
          replaceUrl: true,
        });
        return;
      }
      this.displayedFloorId.set(nextFloorId);
    });
  }
}
