import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { NgOptimizedImage } from '@angular/common';
import {
  LucideCamera,
  LucideCalendarDays,
  LucideCheckCircle2,
  LucideCode,
  LucideInfo,
  LucideMapPin,
  LucideQrCode,
  LucideStore,
} from '@lucide/angular';
import { STRINGS } from '../../../core/strings';
import { EstablishmentContext } from '../../../core/establishment-context';
import { confirmOperationalExit } from '../../../core/operational-exit-guard';
import { CheckInStore } from '../model/check-in-store';
import { QrScanner } from '../model/qr-scanner';

type LookupMode = 'scan' | 'manual';

@Component({
  selector: 'mapit-check-in',
  imports: [
    NgOptimizedImage,
    LucideCamera,
    LucideCalendarDays,
    LucideCheckCircle2,
    LucideCode,
    LucideInfo,
    LucideMapPin,
    LucideQrCode,
    LucideStore,
  ],
  providers: [CheckInStore, QrScanner],
  templateUrl: './check-in.html',
  styleUrl: './check-in.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CheckIn {
  protected readonly strings = STRINGS.checkIn;
  protected readonly store = inject(CheckInStore);
  protected readonly scanner = inject(QrScanner);
  private readonly establishmentContext = inject(EstablishmentContext);
  protected readonly venue = computed(() =>
    this.establishmentContext.status() === 'ready' ? this.establishmentContext.active() : null,
  );
  protected readonly mode = signal<LookupMode>('scan');
  protected readonly scanning = computed(
    () => this.scanner.state() === 'starting' || this.scanner.state() === 'active',
  );

  constructor() {
    effect(() => {
      this.venue();
      this.scanner.stop();
      this.mode.set('scan');
    });
  }

  protected selectMode(mode: LookupMode): void {
    if (this.mode() === mode) return;
    this.scanner.stop();
    this.mode.set(mode);
  }

  protected navigateTabs(
    event: KeyboardEvent,
    scanTab: HTMLButtonElement,
    manualTab: HTMLButtonElement,
  ): void {
    let next: LookupMode;
    switch (event.key) {
      case 'ArrowLeft':
      case 'ArrowRight':
        next = this.mode() === 'scan' ? 'manual' : 'scan';
        break;
      case 'Home':
        next = 'scan';
        break;
      case 'End':
        next = 'manual';
        break;
      default:
        return;
    }
    event.preventDefault();
    this.selectMode(next);
    (next === 'scan' ? scanTab : manualTab).focus();
  }

  protected useDemoCode(): void {
    this.selectMode('manual');
    this.store.useDemoCode();
  }

  protected toggleCamera(video: HTMLVideoElement): void {
    if (this.scanning()) this.scanner.stop();
    else void this.scanner.start(video, this.store.onScan);
  }

  canDeactivate(): boolean {
    return confirmOperationalExit(this.store.busy(), this.store.dirty());
  }
}
