import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import gsap from 'gsap';

import { evaluatePassword, STRENGTH_LABELS } from '../model/password-rules';

/**
 * Medidor de fortaleza de contraseña.
 *
 * Traducción React (Framer Motion) → Angular (GSAP):
 * - La spring de cada celda (stiffness 520, damping 34 — overdamped, sin rebote
 *   visible) se traduce a `power3.out` de 0.25s conservando el stagger de 30ms.
 * - El crossfade de la etiqueta de nivel se mantiene en 0.2s `power2.out`.
 * - `useReducedMotion` → `matchMedia('(prefers-reduced-motion)')`: duración 0.
 * - Limpieza en `ngOnDestroy` vía DestroyRef (evita timelines huérfanas).
 */
@Component({
  selector: 'mapit-password-strength',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="strength-accordion" [class.visible]="!!value()">
      <div class="strength-inner">
        <div
          class="meter"
          role="meter"
          aria-label="Fortaleza de la contraseña"
          [attr.aria-valuemin]="0"
          [attr.aria-valuemax]="result().max"
          [attr.aria-valuenow]="result().score"
          [attr.aria-valuetext]="result().label"
        >
          @for (rule of result().rules; track rule.id; let i = $index) {
            <div class="cell">
              <span class="cell-fill" [class]="'cell-fill tone-' + tone()"></span>
            </div>
          }
        </div>

        <div class="meter-footer">
          <span class="label-stack" aria-hidden="true">
            @for (text of labels; track text) {
              <span
                [class.active]="text === result().label"
                [class]="'tone-' + tone() + ' label'"
                >{{ text }}</span
              >
            }
          </span>
          @if (result().guessable) {
            <span class="warning">Patrón muy común</span>
          }
        </div>

        <ul class="rules">
          @for (rule of result().rules; track rule.id) {
            <li [class.met]="rule.met">
              <span class="rule-check" aria-hidden="true">
                <svg viewBox="0 0 12 12" fill="none">
                  <path
                    d="M2 6.2 4.7 8.9 10 3.3"
                    stroke="currentColor"
                    stroke-width="1.9"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />
                </svg>
              </span>
              {{ rule.label }}
              <span class="sr-only">{{ rule.met ? '(cumplido)' : '(pendiente)' }}</span>
            </li>
          }
        </ul>

        <p class="sr-only" aria-live="polite">{{ announcement() }}</p>
      </div>
    </div>
  `,
  styles: `
    .strength-accordion {
      display: grid;
      grid-template-rows: 0fr;
      opacity: 0;
      transform: translateY(-4px);
      transition:
        grid-template-rows 300ms var(--mapit-ease-out, cubic-bezier(0.22, 1, 0.36, 1)),
        opacity 250ms var(--mapit-ease-out, cubic-bezier(0.22, 1, 0.36, 1)),
        transform 250ms var(--mapit-ease-out, cubic-bezier(0.22, 1, 0.36, 1)),
        margin-top 250ms var(--mapit-ease-out, cubic-bezier(0.22, 1, 0.36, 1));
      margin-top: 0;
      overflow: hidden;
    }

    .strength-accordion.visible {
      grid-template-rows: 1fr;
      opacity: 1;
      transform: translateY(0);
      margin-top: 10px;
    }

    .strength-inner {
      min-height: 0;
      overflow: hidden;
    }

    .meter {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 6px;
    }
    .cell {
      position: relative;
      height: 6px;
      overflow: hidden;
      border-radius: 2px;
      background: var(--mapit-color-border);
    }
    .cell-fill {
      position: absolute;
      inset: 0;
      border-radius: 2px;
      transform: scaleX(0);
      transform-origin: left;
      transition: background-color 200ms ease-out;
    }
    .tone-none {
      background-color: var(--mapit-color-border-input);
      color: var(--mapit-color-text-muted);
    }
    .tone-danger {
      background-color: #ef4444;
      color: #b91c1c;
    }
    .tone-caution {
      background-color: #f59e0b;
      color: #b45309;
    }
    .tone-safe {
      background-color: #22c55e;
      color: #15803d;
    }

    .meter-footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      height: 20px;
      margin-top: 8px;
      font-size: 12px;
    }
    .label-stack {
      display: inline-grid;
    }
    .label {
      grid-area: 1 / 1;
      white-space: nowrap;
      opacity: 0;
      font-weight: 500;
      background: none;
      transition:
        opacity 250ms ease-out,
        color 200ms ease-out;
    }
    .label.active {
      opacity: 1;
    }
    .warning {
      color: #b45309;
      white-space: nowrap;
    }

    .rules {
      list-style: none;
      margin: 10px 0 0;
      padding: 0;
      display: grid;
      gap: 6px;
      font-size: 12.5px;
      color: var(--mapit-color-text-muted);
    }
    .rules li {
      display: flex;
      align-items: center;
      gap: 8px;
      transition: color 250ms ease-out;
    }
    .rules li.met {
      color: var(--mapit-color-text);
    }
    .rule-check {
      display: grid;
      place-items: center;
      width: 14px;
      height: 14px;
      border: 1px solid var(--mapit-color-border);
      border-radius: 4px;
      color: #fff;
      background: transparent;
      transition:
        background-color 250ms ease-out,
        border-color 250ms ease-out;
    }
    .rule-check svg {
      width: 9px;
      opacity: 0;
      transform: scale(0.6);
      transition:
        opacity 250ms ease-out,
        transform 250ms ease-out;
    }
    li.met .rule-check {
      background: #22c55e;
      border-color: transparent;
    }
    li.met .rule-check svg {
      opacity: 1;
      transform: scale(1);
    }

    .sr-only {
      position: absolute;
      width: 1px;
      height: 1px;
      overflow: hidden;
      clip: rect(0 0 0 0);
      white-space: nowrap;
    }

    @media (prefers-reduced-motion: reduce) {
      .strength-accordion,
      .label,
      .rules li,
      .rule-check,
      .rule-check svg,
      .cell-fill {
        transition-duration: 0ms !important;
      }
    }
  `,
})
export class PasswordStrength {
  readonly value = input.required<string>();

  protected readonly labels = STRENGTH_LABELS;
  protected readonly result = computed(() => evaluatePassword(this.value()));
  protected readonly announcement = signal('');

  private readonly host = inject(ElementRef) as ElementRef<HTMLElement>;
  private readonly destroyRef = inject(DestroyRef);
  private readonly reducedMotion =
    typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  private announcementTimer: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    effect(() => {
      const { score, label, rules, guessable } = this.result();
      const cells = this.host.nativeElement.querySelectorAll('.cell-fill');
      cells.forEach((cell: Element, i: number) => {
        gsap.to(cell, {
          scaleX: i < score ? 1 : 0,
          duration: this.reducedMotion ? 0 : 0.25,
          ease: 'power3.out',
          delay: this.reducedMotion || i >= score ? 0 : i * 0.03,
        });
      });

      // Anuncio accesible con el retardo de 700ms de la referencia.
      clearTimeout(this.announcementTimer);
      const unmet = rules.filter((r) => !r.met).map((r) => r.label.toLowerCase());
      const text =
        score === 0 && this.value() === ''
          ? ''
          : [
              `Fortaleza de la contraseña: ${label.toLowerCase()}.`,
              guessable ? 'Es un patrón muy común.' : '',
              unmet.length === 0 ? 'Cumples todos los requisitos.' : `Falta: ${unmet.join(', ')}.`,
            ]
              .filter(Boolean)
              .join(' ');
      this.announcementTimer = setTimeout(() => this.announcement.set(text), 700);
    });

    this.destroyRef.onDestroy(() => {
      clearTimeout(this.announcementTimer);
      gsap.killTweensOf(this.host.nativeElement.querySelectorAll('.cell-fill'));
    });
  }

  protected tone(): 'none' | 'danger' | 'caution' | 'safe' {
    const { score, max } = this.result();
    if (score === 0) return 'none';
    const ratio = score / max;
    if (ratio <= 0.34) return 'danger';
    if (ratio <= 0.67) return 'caution';
    return 'safe';
  }
}
