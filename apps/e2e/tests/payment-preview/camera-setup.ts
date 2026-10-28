import { mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve, join } from 'node:path';
import { PREVIEW_RECEIPT_PATH } from '../../../../libs/api-client/src/lib/payment-preview';

/** Cámara virtual con un QR de fixture: comprueba el decoder ZXing real, sin cámara física. */
export default function prepareCamera(): void {
  const requirePublic = createRequire(resolve(__dirname, '../../../public-web/package.json'));
  const qr = requirePublic('qrcode') as {
    create(
      value: string,
      options: { errorCorrectionLevel: string },
    ): { modules: { size: number; get(row: number, column: number): boolean } };
  };
  const matrix = qr.create('http://localhost:4500' + PREVIEW_RECEIPT_PATH, {
    errorCorrectionLevel: 'M',
  }).modules;
  const width = 640;
  const height = 480;
  const cell = Math.floor(400 / (matrix.size + 8));
  const offsetX = Math.floor((width - matrix.size * cell) / 2);
  const offsetY = Math.floor((height - matrix.size * cell) / 2);
  const luminance = Buffer.alloc(width * height, 235);
  for (let row = 0; row < matrix.size; row++) {
    for (let column = 0; column < matrix.size; column++) {
      if (!matrix.get(row, column)) continue;
      for (let y = 0; y < cell; y++) {
        const start = (offsetY + row * cell + y) * width + offsetX + column * cell;
        luminance.fill(16, start, start + cell);
      }
    }
  }
  const frame = Buffer.concat([
    Buffer.from('FRAME\n'),
    luminance,
    Buffer.alloc((width * height) / 2, 128),
  ]);
  const directory = resolve(__dirname, '../../.tmp');
  mkdirSync(directory, { recursive: true });
  writeFileSync(
    join(directory, 'payments-camera.y4m'),
    Buffer.concat([Buffer.from('YUV4MPEG2 W640 H480 F10:1 Ip A1:1 C420jpeg\n'), frame, frame]),
  );
}
