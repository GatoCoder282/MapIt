import { ChangeDetectionStrategy, Component } from '@angular/core';

import { SiteNav, SiteFooter } from '@mapit/ui-kit';

import { ReservasHero } from './ui/hero/hero';
import { ReservasCategories } from './ui/categories/categories';
import { ReservasPopular } from './ui/popular/popular';
import { ReservasSteps } from './ui/steps/steps';
import { ReservasCta } from './ui/cta/cta';

/**
 * Página pública de Reservas: listado de establecimientos (tenants) del ecosistema MapIt.
 * Secciones standalone con datos mock (ver establishments.data.ts).
 * Spec de diseño: apps/public-web/design/ (referencia: imagen de reservas).
 */
@Component({
  selector: 'mp-reservas',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    SiteNav,
    SiteFooter,
    ReservasHero,
    ReservasCategories,
    ReservasPopular,
    ReservasSteps,
    ReservasCta,
  ],
  templateUrl: './reservas.html',
  styleUrl: './reservas.scss',
})
export class Reservas {}
