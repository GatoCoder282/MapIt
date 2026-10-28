import {
  DestroyRef,
  Injectable,
  InjectionToken,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { STRINGS } from '../../../core/strings';
import { CheckInApi } from '../data/check-in-api';

export interface ScannerControls {
  stop(): void;
}
export interface QrReaderPort {
  decode(
    stream: MediaStream,
    video: HTMLVideoElement,
    onCode: (value: string) => void,
  ): Promise<ScannerControls>;
}
/** La dependencia de cámara/decodificación solo se carga tras una acción explícita. */
export const QR_READER_LOADER = new InjectionToken<() => Promise<QrReaderPort>>(
  'mapit.qr-reader-loader',
  {
    providedIn: 'root',
    factory: () => async () => {
      const { BrowserQRCodeReader } = await import('@zxing/browser');
      const reader = new BrowserQRCodeReader();
      return {
        decode: (stream, video, onCode) =>
          reader.decodeFromStream(stream, video, (result) => {
            if (result) onCode(result.getText());
          }),
      };
    },
  },
);

/** Posee todos los recursos: también libera streams/controles que llegan tras cancelar. */
@Injectable()
export class QrScanner {
  private readonly loadReader = inject(QR_READER_LOADER);
  private readonly api = inject(CheckInApi);
  private generation = 0;
  private stream: MediaStream | null = null;
  private controls: ScannerControls | null = null;
  private video: HTMLVideoElement | null = null;
  private readonly stateSignal = signal<'idle' | 'starting' | 'active' | 'error'>('idle');
  private readonly devicesSignal = signal<readonly MediaDeviceInfo[]>([]);
  private readonly errorSignal = signal<string | null>(null);
  private readonly selectedSignal = signal('');
  readonly state = this.stateSignal.asReadonly();
  readonly devices = this.devicesSignal.asReadonly();
  readonly error = this.errorSignal.asReadonly();
  readonly selectedDevice = this.selectedSignal.asReadonly();

  constructor() {
    inject(DestroyRef).onDestroy(() => this.stop());
    effect(() => {
      if (!this.api.enabled() || !this.api.authorized()) untracked(() => this.stop());
    });
  }

  selectDevice(deviceId: string): void {
    this.stop();
    this.selectedSignal.set(deviceId);
  }

  async start(video: HTMLVideoElement, onCode: (value: string) => void): Promise<void> {
    this.stop();
    this.errorSignal.set(null);
    if (!this.api.enabled() || !this.api.authorized()) {
      this.fail(STRINGS.checkIn.errors.unavailable);
      return;
    }
    if (!globalThis.isSecureContext) {
      this.fail(STRINGS.checkIn.errors.cameraSecure);
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      this.fail(STRINGS.checkIn.errors.cameraMissing);
      return;
    }
    const generation = ++this.generation;
    this.video = video;
    this.stateSignal.set('starting');
    try {
      const deviceId = this.selectedDevice();
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: deviceId
          ? { deviceId: { exact: deviceId } }
          : { facingMode: { ideal: 'environment' } },
      });
      if (!this.isCurrent(generation)) {
        this.stopTracks(stream);
        return;
      }
      this.stream = stream;
      void navigator.mediaDevices
        .enumerateDevices()
        .then((devices) => {
          if (generation === this.generation)
            this.devicesSignal.set(devices.filter((device) => device.kind === 'videoinput'));
        })
        .catch(() => {
          /* La selección manual sigue disponible sin enumeración. */
        });
      const reader = await this.loadReader();
      if (!this.isCurrent(generation)) {
        this.stopTracks(stream);
        return;
      }
      const controls = await reader.decode(stream, video, (value) => {
        if (!this.isCurrent(generation)) return;
        this.stop();
        onCode(value);
      });
      if (!this.isCurrent(generation)) {
        controls.stop();
        this.stopTracks(stream);
        if (video.srcObject === stream) {
          video.pause();
          video.srcObject = null;
        }
        return;
      }
      this.controls = controls;
      this.stateSignal.set('active');
    } catch (error) {
      if (generation !== this.generation) return;
      this.stop();
      const name = error instanceof Error ? error.name : '';
      this.fail(
        name === 'NotAllowedError' || name === 'SecurityError'
          ? STRINGS.checkIn.errors.cameraDenied
          : name === 'NotFoundError' || name === 'OverconstrainedError'
            ? STRINGS.checkIn.errors.cameraMissing
            : STRINGS.checkIn.errors.cameraUnavailable,
      );
    }
  }

  stop(): void {
    this.generation++;
    try {
      this.controls?.stop();
    } catch {
      /* Los tracks se liberan incluso si falla ZXing. */
    }
    this.controls = null;
    if (this.stream) this.stopTracks(this.stream);
    this.stream = null;
    if (this.video) {
      if (this.video.srcObject) this.video.pause();
      this.video.srcObject = null;
      this.video = null;
    }
    this.stateSignal.set('idle');
  }

  private stopTracks(stream: MediaStream): void {
    for (const track of stream.getTracks()) track.stop();
  }

  private isCurrent(generation: number): boolean {
    if (generation !== this.generation) return false;
    if (!this.api.enabled() || !this.api.authorized()) {
      this.stop();
      return false;
    }
    return true;
  }

  private fail(message: string): void {
    this.errorSignal.set(message);
    this.stateSignal.set('error');
  }
}
