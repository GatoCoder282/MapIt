import { NgOptimizedImage } from '@angular/common';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { STRINGS } from '../../../../core/strings';
@Component({
  selector: 'mp-business-editor',
  imports: [NgOptimizedImage],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './business-editor.html',
  styleUrl: './business-editor.scss',
})
export class BusinessEditor {
  protected readonly panelIcons = [
    'M12 2 2 7l10 5 10-5-10-5ZM2 12l10 5 10-5M2 17l10 5 10-5',
    'M5 11V7a3 3 0 0 1 3-3h8a3 3 0 0 1 3 3v4M3 11h18v6H3zM5 17v4m14-4v4',
    'M3 6h4m4 0h10M3 12h10m4 0h4M3 18h4m4 0h10M11 6a2 2 0 1 1-4 0 2 2 0 0 1 4 0Zm6 6a2 2 0 1 1-4 0 2 2 0 0 1 4 0Zm-6 6a2 2 0 1 1-4 0 2 2 0 0 1 4 0Z',
  ];
  protected readonly benefitIcons = [
    'M4 2l16 12-8 1-4 7L4 2Zm8 13 5 6',
    this.panelIcons[0],
    this.panelIcons[2],
  ];
  protected readonly copy = STRINGS.landing.editor;
}
