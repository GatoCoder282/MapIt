import { DOCUMENT } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';

import { STRINGS } from '../../../core/strings';
import { PaymentQr } from '../data/payment-qr';

@Component({
  selector: 'mp-payment-qr',
  template: `
    <div class="qr-frame" [attr.aria-busy]="!image() && !failed()">
      @if (image(); as src) {
        <!-- eslint-disable-next-line @angular-eslint/template/prefer-ngsrc -- QR local en data URI, sin optimización remota. -->
        <img [src]="src" [alt]="label()" width="256" height="256" />
      } @else {
        <p role="status">{{ failed() ? strings.qrError : strings.qrLoading }}</p>
      }
    </div>
  `,
  styles: `
    :host {
      display: block;
      max-width: 100%;
      min-width: 0;
    }
    .qr-frame {
      width: 256px;
      height: 256px;
      max-width: 100%;
      display: grid;
      place-items: center;
      background: #fff;
      margin-inline: auto;
    }
    img {
      display: block;
      max-width: 100%;
      height: auto;
    }
    p {
      padding: 1rem;
      font-size: 0.875rem;
      line-height: 1.5;
      color: var(--mapit-color-text-variant);
      text-align: center;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PaymentQrImage {
  readonly path = input<string>('');
  readonly url = input<string | null>(null);
  readonly label = input.required<string>();
  private readonly qr = inject(PaymentQr);
  private readonly document = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);
  private version = 0;
  protected readonly image = signal<string | null>(null);
  protected readonly failed = signal(false);
  protected readonly strings = STRINGS.payment;

  constructor() {
    this.destroyRef.onDestroy(() => this.version++);
    effect(() => {
      const absolute = this.url();
      const path = this.path();
      const version = ++this.version;
      this.image.set(null);
      this.failed.set(false);
      const origin = this.document.defaultView?.location.origin;
      const target =
        absolute !== null
          ? this.qr.renderAttempt(absolute)
          : origin && path
            ? this.qr.render(path, origin)
            : Promise.reject(new Error('invalid-qr-target'));
      void target
        .then((image) => {
          if (version === this.version) this.image.set(image);
        })
        .catch(() => {
          if (version === this.version) this.failed.set(true);
        });
    });
  }
}
