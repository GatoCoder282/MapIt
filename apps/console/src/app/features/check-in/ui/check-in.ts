import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { STRINGS } from '../../../core/strings';
import { CheckInStore } from '../model/check-in-store';
import { QrScanner } from '../model/qr-scanner';

@Component({
  selector: 'mapit-check-in',
  providers: [CheckInStore, QrScanner],
  templateUrl: './check-in.html',
  styleUrl: './check-in.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CheckIn {
  protected readonly strings = STRINGS.checkIn;
  protected readonly store = inject(CheckInStore);
  protected readonly scanner = inject(QrScanner);
}
