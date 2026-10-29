import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { CheckInApi } from '../data/check-in-api';
import { QR_READER_LOADER, QrScanner, type QrReaderPort, type ScannerControls } from './qr-scanner';

function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
  let resolve!: (value: T) => void;
  return {
    promise: new Promise<T>((done) => {
      resolve = done;
    }),
    resolve: (value) => resolve(value),
  };
}

describe('QrScanner lifecycle', () => {
  const enabled = signal(true);
  const authorized = signal(true);
  const trackStop = vi.fn();
  const controlsStop = vi.fn();
  const stream = { getTracks: () => [{ stop: trackStop }] } as unknown as MediaStream;
  const getUserMedia = vi.fn<() => Promise<MediaStream>>(() => Promise.resolve(stream));
  const decode = vi.fn<QrReaderPort['decode']>(() => Promise.resolve({ stop: controlsStop }));
  const loadReader = vi.fn<() => Promise<QrReaderPort>>(() => Promise.resolve({ decode }));
  const video = { srcObject: null, pause: vi.fn() } as unknown as HTMLVideoElement;
  let scanner: QrScanner;

  beforeEach(() => {
    vi.clearAllMocks();
    enabled.set(true);
    authorized.set(true);
    getUserMedia.mockResolvedValue(stream);
    decode.mockResolvedValue({ stop: controlsStop });
    loadReader.mockResolvedValue({ decode });
    video.srcObject = null;
    vi.stubGlobal('isSecureContext', true);
    vi.stubGlobal('navigator', {
      mediaDevices: { getUserMedia, enumerateDevices: () => Promise.resolve([]) },
    });
    TestBed.configureTestingModule({
      providers: [
        QrScanner,
        { provide: CheckInApi, useValue: { enabled, authorized } },
        { provide: QR_READER_LOADER, useValue: loadReader },
      ],
    });
    scanner = TestBed.inject(QrScanner);
  });
  afterEach(() => {
    scanner.stop();
    vi.unstubAllGlobals();
  });

  it('no solicita cámara al crear el servicio y carga ZXing solo al iniciar', async () => {
    expect(getUserMedia).not.toHaveBeenCalled();
    expect(loadReader).not.toHaveBeenCalled();
    await scanner.start(video, vi.fn());
    expect(getUserMedia).toHaveBeenCalledWith({
      audio: false,
      video: { facingMode: { ideal: 'environment' } },
    });
    expect(loadReader).toHaveBeenCalledOnce();
    expect(scanner.state()).toBe('active');
    scanner.stop();
    expect(trackStop).toHaveBeenCalled();
    expect(controlsStop).toHaveBeenCalledOnce();
  });

  it('cierra un stream cuya autorización llega después de cancelar', async () => {
    const permission = deferred<MediaStream>();
    getUserMedia.mockReturnValue(permission.promise);
    const start = scanner.start(video, vi.fn());
    scanner.stop();
    permission.resolve(stream);
    await start;
    expect(trackStop).toHaveBeenCalled();
    expect(loadReader).not.toHaveBeenCalled();
    expect(scanner.state()).toBe('idle');
  });

  it('cierra captura pendiente de importación cuando se destruye la vista', async () => {
    const reader = deferred<QrReaderPort>();
    loadReader.mockReturnValue(reader.promise);
    const start = scanner.start(video, vi.fn());
    await Promise.resolve();
    expect(loadReader).toHaveBeenCalledOnce();
    TestBed.resetTestingModule();
    reader.resolve({ decode });
    await start;
    expect(trackStop).toHaveBeenCalled();
    expect(decode).not.toHaveBeenCalled();
  });

  it('detiene controles ZXing que resuelven después de detener la cámara', async () => {
    const controls = deferred<ScannerControls>();
    decode.mockReturnValue(controls.promise);
    const start = scanner.start(video, vi.fn());
    await Promise.resolve();
    await Promise.resolve();
    expect(decode).toHaveBeenCalledOnce();
    scanner.stop();
    video.srcObject = stream; // ZXing tardío puede adjuntar el preview después de stop.
    controls.resolve({ stop: controlsStop });
    await start;
    expect(controlsStop).toHaveBeenCalledOnce();
    expect(trackStop).toHaveBeenCalled();
    expect(video.srcObject).toBeNull();
  });

  it('procesa un solo código y detiene recursos antes de entregarlo', async () => {
    const onCode = vi.fn(() => expect(trackStop).toHaveBeenCalled());
    await scanner.start(video, onCode);
    const decoded = decode.mock.calls[0]?.[2];
    decoded?.('codigo-de-prueba');
    decoded?.('segundo-codigo');
    expect(onCode).toHaveBeenCalledOnce();
    expect(onCode).toHaveBeenCalledWith('codigo-de-prueba');
    expect(controlsStop).toHaveBeenCalledOnce();
  });

  it('rechaza contexto inseguro y modo deshabilitado sin abrir recursos', async () => {
    vi.stubGlobal('isSecureContext', false);
    await scanner.start(video, vi.fn());
    expect(scanner.error()).toContain('HTTPS');
    enabled.set(false);
    await scanner.start(video, vi.fn());
    expect(getUserMedia).not.toHaveBeenCalled();
  });

  it('revalida permisos cuando se concede cámara tras cambiar la sesión', async () => {
    const permission = deferred<MediaStream>();
    getUserMedia.mockReturnValue(permission.promise);
    const start = scanner.start(video, vi.fn());
    authorized.set(false);
    permission.resolve(stream);
    await start;
    expect(trackStop).toHaveBeenCalled();
    expect(decode).not.toHaveBeenCalled();
  });

  it('explica permiso denegado sin requerir cámara para el ingreso manual', async () => {
    getUserMedia.mockRejectedValue(new DOMException('denied', 'NotAllowedError'));
    await scanner.start(video, vi.fn());
    expect(scanner.state()).toBe('error');
    expect(scanner.error()).toContain('manualmente');
  });
});
