import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { STRINGS } from '../../../core/strings';
import { CONSOLE_BASE_URL } from '../../../core/config';
import { ActivationStore } from '../model/activation-store';

/**
 * Pantalla pública de activación del primer ADMIN (CU-25 / MAP-186).
 * Llega desde el correo con `?tenant=<slug>&token=<opaco>`.
 */
@Component({
  selector: 'mp-activation',
  providers: [ActivationStore],
  template: `
    <main class="page">
      <section class="card" aria-labelledby="activation-title">
        @if (store.success(); as slug) {
          <div class="success" role="status">
            <h1 id="activation-title">{{ strings.activation.success }}</h1>
            <a class="primary" [href]="loginUrl(slug)">{{ strings.activation.goToLogin }}</a>
          </div>
        } @else {
          <h1 id="activation-title">{{ strings.activation.title }}</h1>
          <p class="intro">{{ strings.activation.intro }}</p>

          @if (store.message()) {
            <p class="message" role="alert">{{ store.message() }}</p>
          }

          @if (store.hasLinkParams()) {
            <form (submit)="submit($event)" novalidate>
              <label>
                {{ strings.activation.passwordLabel }}
                <div class="password-wrap">
                  <input
                    #pwd
                    [type]="store.passwordVisible() ? 'text' : 'password'"
                    autocomplete="new-password"
                    maxlength="128"
                    [value]="store.password()"
                    (input)="store.setPassword(pwd.value)"
                    [disabled]="store.pending()"
                  />
                  <button
                    type="button"
                    class="toggle"
                    [attr.aria-label]="
                      store.passwordVisible()
                        ? strings.activation.toggleHide
                        : strings.activation.toggleShow
                    "
                    (click)="store.togglePassword()"
                  >
                    ●
                  </button>
                </div>
                @if (store.passwordError()) {
                  <span class="field-error" role="alert">{{ store.passwordError() }}</span>
                }
              </label>

              <label>
                {{ strings.activation.passwordConfirmLabel }}
                <input
                  #confirm
                  [type]="store.passwordVisible() ? 'text' : 'password'"
                  autocomplete="new-password"
                  maxlength="128"
                  [value]="store.passwordConfirm()"
                  (input)="store.setPasswordConfirm(confirm.value)"
                  [disabled]="store.pending()"
                />
                @if (store.confirmError()) {
                  <span class="field-error" role="alert">{{ store.confirmError() }}</span>
                }
              </label>

              <button class="primary" type="submit" [disabled]="store.pending()">
                {{ store.pending() ? strings.activation.submitting : strings.activation.submit }}
              </button>
            </form>
          } @else {
            <a class="primary" routerLink="/">{{ strings.activation.backLanding }}</a>
          }
        }
      </section>
    </main>
  `,
  styles: `
    .page {
      min-height: 100dvh;
      display: grid;
      place-items: center;
      padding: var(--mapit-space-6, 1.5rem);
      background: var(--mapit-color-canvas, #f7f8fa);
    }
    .card {
      width: min(26rem, 100%);
      background: var(--mapit-color-surface, #fff);
      border-radius: var(--mapit-radius-lg, 0.75rem);
      box-shadow: var(--mapit-shadow, 0 4px 12px rgb(0 0 0 / 5%));
      padding: 2rem;
      display: grid;
      gap: 1rem;
    }
    h1 {
      margin: 0;
      font: var(--mapit-text-display, 600 1.25rem/1.75rem 'Manrope Variable', sans-serif);
      color: var(--mapit-color-text, #151c27);
    }
    .intro {
      margin: 0;
      font: var(--mapit-text-body, 400 0.875rem/1.25rem 'Inter Variable', sans-serif);
      color: var(--mapit-color-text-muted, #6b7280);
    }
    form {
      display: grid;
      gap: 1rem;
    }
    label {
      display: grid;
      gap: 0.4rem;
      font: var(--mapit-text-body-bold, 600 0.875rem/1.25rem 'Inter Variable', sans-serif);
      color: var(--mapit-color-text, #151c27);
    }
    input {
      width: 100%;
      padding: 0.65rem 0.75rem;
      border: 1px solid var(--mapit-color-border-input, #d1d5db);
      border-radius: var(--mapit-radius-input, 0.25rem);
      font: inherit;
      box-sizing: border-box;
    }
    input:focus-visible {
      outline: 2px solid var(--mapit-color-focus-ring, rgb(61 78 242 / 20%));
      border-color: var(--mapit-color-accent, #3d4ef2);
    }
    .password-wrap {
      position: relative;
    }
    .password-wrap input {
      padding-right: 2.5rem;
    }
    .toggle {
      position: absolute;
      right: 0.25rem;
      top: 50%;
      transform: translateY(-50%);
      background: transparent;
      border: 0;
      cursor: pointer;
      color: var(--mapit-color-text-muted, #6b7280);
    }
    .field-error {
      font-size: 0.78rem;
      color: var(--mapit-color-error, #ba1a1a);
    }
    .message {
      margin: 0;
      padding: 0.75rem 1rem;
      border-radius: var(--mapit-radius, 0.5rem);
      background: #fee2e2;
      color: var(--mapit-color-error, #ba1a1a);
      font: var(--mapit-text-body, 400 0.875rem/1.25rem 'Inter Variable', sans-serif);
    }
    .primary {
      display: inline-flex;
      justify-content: center;
      padding: 0.7rem 1rem;
      border: 0;
      border-radius: var(--mapit-radius-lg, 0.75rem);
      background: var(--mapit-color-accent, #3d4ef2);
      color: #fff;
      font: var(--mapit-text-body-bold, 600 0.875rem/1.25rem 'Inter Variable', sans-serif);
      text-decoration: none;
      cursor: pointer;
    }
    .primary:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }
    .success {
      display: grid;
      gap: 1rem;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Activation {
  protected readonly store = inject(ActivationStore);
  protected readonly strings = STRINGS;

  protected loginUrl(slug: string): string {
    return `${CONSOLE_BASE_URL}/empresa/${slug}/login`;
  }

  protected submit(event: Event): void {
    event.preventDefault();
    this.store.submit();
  }
}
