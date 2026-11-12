import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { NgOptimizedImage } from '@angular/common';
import { STRINGS } from '../../core/strings';
@Component({
  selector: 'mp-how-editor',
  imports: [NgOptimizedImage],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div class="editor">
    <img
      ngSrc="assets/img/landing/business-editor.jpg"
      [alt]="copy.ui.editorAlt"
      width="1672"
      height="941"
      sizes="(max-width: 767px) 95vw, 55vw"
      [priority]="priority()"
    />
  </div>`,
  styles: [
    `
      :host {
        display: block;
        min-width: 0;
      }
      .editor {
        position: relative;
        overflow: hidden;
        aspect-ratio: 1544/624;
        border: 10px solid #fff;
        border-radius: 24px;
        background: #f5f8ff;
        box-shadow:
          0 12px 28px #2361b52e,
          0 0 0 1px #e6eeff;
      }
      .editor img {
        position: absolute;
        max-width: none;
        width: 108.3%;
        height: auto;
        left: -7.25%;
        top: -20.2%;
      }
      @media (max-width: 767px) {
        .editor {
          border-width: 6px;
          border-radius: 16px;
        }
      }
    `,
  ],
})
export class HowEditor {
  readonly priority = input(false);
  protected readonly copy = STRINGS.howItWorks;
}
