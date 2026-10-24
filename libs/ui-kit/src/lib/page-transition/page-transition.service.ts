import { Injectable, signal } from '@angular/core';
import { gsap } from 'gsap';

/**
 * Servicio de transición de página "clip wipe".
 *
 * Ejecuta un círculo azul que crece desde la izquierda cubriendo la pantalla
 * (wipe-in) y un desvanecimiento del overlay (wipe-out) tras la navegación.
 * Respeta prefers-reduced-motion: crossfade directo sin escala del círculo.
 */
@Injectable({ providedIn: 'root' })
export class PageTransitionService {
  readonly active = signal(false);

  private get reducedMotion(): boolean {
    return (
      typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
    );
  }

  /** Wipe-in del círculo ~600ms hasta cubrir toda la pantalla. Resuelve al terminar. */
  start(): Promise<void> {
    this.active.set(true);
    const circle = document.querySelector('.wipe-circle');
    if (!circle || this.reducedMotion) {
      return Promise.resolve();
    }
    const rect = circle.getBoundingClientRect();
    const radius = rect.width / 2 || 100;
    // El círculo nace en el borde izquierdo (centro x = 0). Para cubrir la esquina
    // inferior derecha (width, height) desde el punto (0, height/2) se necesita
    // un radio >= distancia a esa esquina.
    const cover = Math.ceil(Math.hypot(window.innerWidth, window.innerHeight / 2) / radius);
    return new Promise<void>((resolve) => {
      gsap.to(circle, {
        duration: 0.6,
        ease: 'cubic-bezier(0.77, 0, 0.175, 1)',
        scale: cover,
        onComplete: () => resolve(),
      });
    });
  }

  /** Wipe-out opacidad ~400ms, luego display:none y active=false. */
  complete(): Promise<void> {
    const overlay = document.querySelector('.page-wipe-overlay');
    if (!overlay) {
      this.active.set(false);
      return Promise.resolve();
    }
    if (this.reducedMotion) {
      overlay.classList.add('hidden');
      this.active.set(false);
      return Promise.resolve();
    }
    return new Promise<void>((resolve) => {
      gsap.to(overlay, {
        duration: 0.4,
        ease: 'power2.out',
        opacity: 0,
        onComplete: () => {
          overlay.classList.add('hidden');
          this.active.set(false);
          resolve();
        },
      });
    });
  }
}
