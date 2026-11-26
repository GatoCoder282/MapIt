import { ChangeDetectionStrategy, Component } from '@angular/core';
import { NgOptimizedImage } from '@angular/common';
import { LucideLayers, LucideMousePointer2, LucideScan } from '@lucide/angular';
import { STRINGS } from '../../../core/strings';
@Component({
  selector: 'mapit-floor-setup-guide',
  imports: [NgOptimizedImage, LucideLayers, LucideMousePointer2, LucideScan],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: ` <section class="guide" role="status">
    <img
      class="hero"
      ngSrc="/assets/illustrations/first-floor-plan.png"
      priority
      width="1536"
      height="1024"
      alt=""
    />
    <h2>{{ strings.floorSetupTitle }}</h2>
    <p class="intro">{{ strings.floorSetupHint }}</p>
    <ol role="list">
      <li>
        <span class="number">1</span><svg lucideLayers aria-hidden="true"></svg>
        <h3>{{ strings.floorSetupFloor }}</h3>
        <p>{{ strings.floorSetupCreate }}</p>
      </li>
      <li>
        <span class="number">2</span><svg lucideScan aria-hidden="true"></svg>
        <h3>{{ strings.floorSetupZones }}</h3>
        <p>{{ strings.floorSetupZonesHelp }}</p>
      </li>
      <li>
        <span class="number">3</span><svg lucideMousePointer2 aria-hidden="true"></svg>
        <h3>{{ strings.floorSetupDesign }}</h3>
        <p>{{ strings.floorSetupDesignHelp }}</p>
      </li>
    </ol>
  </section>`,
  styles: `
    :host {
      display: block;
      position: relative;
    }
    .guide {
      position: relative;
      padding: 0 1rem 2rem;
      text-align: center;
      color: var(--mapit-color-text);
    }
    .hero {
      display: block;
      width: min(100%, 34rem);
      height: auto;
      aspect-ratio: 3/2;
      object-fit: contain;
      margin: -1rem auto 0;
      filter: drop-shadow(0 1rem 1.25rem rgb(29 78 216 / 0.12));
    }
    h2 {
      margin: 0;
      font: 800 clamp(1.65rem, 2.7vw, 2.6rem)/1.2 var(--mapit-font-display);
      letter-spacing: -0.025em;
      text-wrap: balance;
    }
    .intro {
      max-width: 48rem;
      margin: 1rem auto 2rem;
      font-size: clamp(1rem, 1.4vw, 1.25rem);
      line-height: 1.6;
      color: var(--mapit-color-text-variant);
      text-wrap: balance;
    }
    ol {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 1.5rem;
      padding: 0;
      margin: 0;
      list-style: none;
    }
    li {
      position: relative;
      padding: 2.25rem 1rem 1.5rem;
      border-radius: 1.25rem;
      background: var(--mapit-color-surface);
      box-shadow: 0 0.5rem 1.5rem rgb(29 78 216 / 0.09);
    }
    .number {
      position: absolute;
      top: 0.875rem;
      left: 0.875rem;
      display: grid;
      place-items: center;
      width: 2rem;
      height: 2rem;
      border-radius: 50%;
      background: var(--mapit-editor-selection-soft);
      color: var(--mapit-color-primary-hover);
      font-weight: 800;
    }
    li svg {
      width: 3rem;
      height: 3rem;
      color: var(--mapit-color-primary);
      margin-bottom: 1rem;
    }
    h3 {
      margin: 0;
      font: 800 1.125rem/1.4 var(--mapit-font-display);
      text-wrap: balance;
    }
    li p {
      margin: 0.5rem 0 0;
      color: var(--mapit-color-text-variant);
      font-size: 1rem;
      line-height: 1.5;
    }
    @media (max-width: 75rem) {
      ol {
        gap: 0.75rem;
      }
    }
    @media (max-width: 48rem) {
      .guide {
        padding: 0 0 1rem;
      }
      .hero {
        max-width: 26rem;
        margin: 0 auto;
      }
      ol {
        grid-template-columns: 1fr;
      }
      li {
        padding: 1.5rem 1rem 1.5rem 4rem;
        text-align: left;
      }
      li svg {
        width: 2rem;
        height: 2rem;
        margin-bottom: 0.5rem;
      }
      .number {
        top: 1.5rem;
      }
    }
  `,
})
export class FloorSetupGuide {
  protected readonly strings = STRINGS.spaces.editor.workspace;
}
