import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import type {
  CheckoutSpace,
  PublicAvailabilityMap,
  PublicMapElement,
  VerticalProfile,
} from '@mapit/api-client';
import { STRINGS } from './strings';
import { verticalTerms } from './vertical-booking';

export type PublicSpaceDescriptor = Pick<
  CheckoutSpace,
  'id' | 'name' | 'floor' | 'sector' | 'type' | 'label' | 'capacity' | 'x' | 'y'
> & {
  readonly positionRequired?: boolean;
  readonly selectable?: boolean;
  readonly availability?: PublicMapElement.AvailabilityEnum;
};

export function validPublicInterval(date: string, start: string, end: string): boolean {
  const time = /^([01]\d|2[0-3]):[0-5]\d$/;
  const day = /^\d{4}-\d{2}-\d{2}$/.test(date) ? new Date(date + 'T12:00:00Z') : null;
  return (
    !!day &&
    Number.isFinite(day.getTime()) &&
    day.toISOString().slice(0, 10) === date &&
    time.test(start) &&
    time.test(end) &&
    start < end
  );
}

export function matchesPublicMap(
  data: PublicAvailabilityMap,
  tenantSlug: string,
  establishmentSlug: string,
  date: string,
  start: string,
  end: string,
  endDate = '',
): boolean {
  return (
    data.tenantSlug === tenantSlug &&
    data.establishmentSlug === establishmentSlug &&
    data.mode === 'INTERVAL' &&
    data.date === date &&
    (!endDate || data.endDate === endDate) &&
    (data.startTime === start || data.startTime === start + ':00') &&
    (data.endTime === end || data.endTime === end + ':00')
  );
}

export function findPublicSpace(
  data: PublicAvailabilityMap,
  id: string,
): PublicSpaceDescriptor | null {
  const all = data.floors.flatMap((floor) =>
    floor.sectors.flatMap((sector) =>
      sector.elements.map((element) => ({ element, floor: floor.name, sector: sector.name })),
    ),
  );
  const found = all.find(({ element }) => element.id === id);
  if (!found) return null;
  const { element, floor, sector } = found;
  return {
    id: element.id,
    name: element.name,
    type: element.type,
    label: element.label,
    capacity: element.capacity,
    x: element.x,
    y: element.y,
    floor,
    sector,
    availability: element.availability,
    selectable: element.selectable,
    positionRequired:
      element.label === null ||
      all.some(({ element: other }) => other.id !== id && other.name === element.name),
  };
}

/** The server supplies the name; this view only adds actual location/metadata. */
@Component({
  selector: 'mp-public-space',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <strong>{{ space().name }}</strong>
    @if (typeLabel()) {
      <span>{{ typeLabel() }}</span>
    }
    <span>{{ space().floor }} · {{ space().sector }}</span>
    @if (showPosition()) {
      <span>{{ strings.position }}: x {{ space().x }} · y {{ space().y }}</span>
    }
    @if (space().capacity !== null && space().capacity !== undefined) {
      <span>{{ strings.capacity }}: {{ space().capacity }}</span>
    }
  `,
  styles: `
    :host {
      display: grid;
      gap: 0.3rem;
      min-width: 0;
      overflow-wrap: anywhere;
    }
    strong {
      font-weight: 600;
    }
    span {
      font-size: 0.8125rem;
      color: var(--mapit-color-text-variant);
      line-height: 1.5;
    }
  `,
})
export class PublicSpaceSummary {
  readonly space = input.required<PublicSpaceDescriptor>();
  readonly peers = input<readonly PublicSpaceDescriptor[]>([]);
  /** HU-7.01/7.02: nombra el tipo en la terminología de la vertical (mesa VIP, ubicación…). */
  readonly profile = input<VerticalProfile | null>(null);
  protected readonly strings = STRINGS.publicSpace;
  protected readonly typeLabel = computed(() => {
    const type = this.space().type ?? '';
    const labels: Readonly<Record<string, string>> = STRINGS.availability.types;
    const profile = this.profile();
    return (profile ? verticalTerms(profile).types[type] : undefined) ?? labels[type] ?? '';
  });
  protected readonly showPosition = computed(() => {
    const space = this.space();
    return (
      space.x != null &&
      space.y != null &&
      (space.label == null ||
        space.positionRequired ||
        this.peers().some((other) => other.id !== space.id && other.name === space.name))
    );
  });
}
