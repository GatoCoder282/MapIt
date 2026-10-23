import { ChangeDetectionStrategy, Component } from '@angular/core';

import { SiteNav, SiteFooter, RevealOnScroll } from '@mapit/ui-kit';

import { LandingHero } from './ui/hero/hero';
import { LandingProblem } from './ui/problem/problem';
import { LandingProduct } from './ui/product/product';
import { LandingBusinessTypes } from './ui/business-types/business-types';
import { LandingEditor } from './ui/editor/editor';
import { LandingBooking } from './ui/booking/booking';
import { LandingDashboard } from './ui/dashboard/dashboard';
import { LandingRealtime } from './ui/realtime/realtime';
import { LandingCtaFinal } from './ui/cta-final/cta-final';

/**
 * Landing pública de MapIt.
 * Compuesta por secciones standalone; cada una es lazy-friendly
 * y sin estado compartido. Datos estáticos para el CU de marketing.
 * Nav y footer viven en @mapit/ui-kit porque se reutilizan en /reservas.
 */
@Component({
  selector: 'mp-landing',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    SiteNav,
    SiteFooter,
    RevealOnScroll,
    LandingHero,
    LandingProblem,
    LandingProduct,
    LandingBusinessTypes,
    LandingEditor,
    LandingBooking,
    LandingDashboard,
    LandingRealtime,
    LandingCtaFinal,
  ],
  templateUrl: './landing.html',
  styleUrl: './landing.scss',
})
export class Landing {}
