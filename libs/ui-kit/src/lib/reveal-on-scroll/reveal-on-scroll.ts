import {
  type AfterViewInit,
  Directive,
  ElementRef,
  type OnDestroy,
  inject,
  input,
} from '@angular/core';

let sharedObserver: IntersectionObserver | null = null;

function observerCallback(entries: IntersectionObserverEntry[]): void {
  for (const entry of entries) {
    if (entry.isIntersecting) {
      entry.target.classList.add('mapit-reveal-in');
      sharedObserver?.unobserve(entry.target);
    }
  }
}

/**
 * Reveal on scroll: oculta el elemento hasta que entra en el viewport y lo
 * revela con fade + translateY (definido en styles globales: `.mapit-reveal`).
 *
 * Uso: `<article mapitReveal [mapitRevealDelay]="80">` — el delay permite
 * stagger en grids (30-80ms entre items, ver guía de motion).
 *
 * Sin dependencias: IntersectionObserver nativo (no GSAP/ScrollTrigger, que se
 * reservan para motion de scroll con narrativa). Respeta `prefers-reduced-motion`
 * vía CSS. Un solo observer compartido por toda la app.
 */
@Directive({
  selector: '[mapitReveal]',
  host: { class: 'mapit-reveal' },
})
export class RevealOnScroll implements AfterViewInit, OnDestroy {
  /** Retardo en ms del reveal (stagger en grids). */
  readonly mapitRevealDelay = input(0);

  private readonly el: HTMLElement = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;

  ngAfterViewInit(): void {
    sharedObserver ??= new IntersectionObserver(observerCallback, {
      threshold: 0.15,
      rootMargin: '0px 0px -40px 0px',
    });
    if (this.mapitRevealDelay() > 0) {
      this.el.style.setProperty('--mapit-reveal-delay', `${this.mapitRevealDelay()}ms`);
    }
    sharedObserver.observe(this.el);
  }

  ngOnDestroy(): void {
    sharedObserver?.unobserve(this.el);
  }
}
