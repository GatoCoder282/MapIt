import { FLAGS_POR_DEFECTO } from './feature-flag.catalog';
import { VERTICAL_FLAGS } from './vertical-flags';

/**
 * El catálogo del frontend debe mantenerse en sincronía con el enum del backend
 * (apps/backend/shared-kernel/.../flags/FeatureFlag.java).
 *
 * Estos tests no comprueban lógica, comprueban una CONVENCIÓN: son baratos y
 * detectan justo el fallo que ocurre cuando alguien añade una flag a mano en un
 * solo lado en vez de usar `pnpm new:flag`.
 */
describe('catálogo de feature flags', () => {
  it('usa la convención <dominio>.<feature>', () => {
    for (const clave of Object.keys(FLAGS_POR_DEFECTO)) {
      expect(clave, `"${clave}" no sigue la convención`).toMatch(
        /^[a-z][a-z0-9-]*\.[a-z][a-z0-9-]*$/,
      );
    }
  });

  it('incluye la flag de demostración usada por ambas apps', () => {
    expect(FLAGS_POR_DEFECTO['demo.hello']).toBe(true);
  });

  it('deja los pagos QR apagados por defecto (CU-17 sin pasarela elegida)', () => {
    expect(FLAGS_POR_DEFECTO['payments.qr']).toBe(false);
  });

  it('deja el tiempo real encendido: su kill switch debe fallar a favor', () => {
    // Si Unleash no responde, se usa este valor. Para un kill switch, el default
    // correcto es "encendido": la funcionalidad opera salvo que se apague a propósito.
    expect(FLAGS_POR_DEFECTO['realtime.websocket']).toBe(true);
  });

  it('deja hotel y salón encendidos: una caída de Unleash no apaga una vertical (HU-7.01/7.02)', () => {
    expect(FLAGS_POR_DEFECTO['vertical.hotel']).toBe(true);
    expect(FLAGS_POR_DEFECTO['vertical.event-hall']).toBe(true);
  });

  it('asocia cada vertical con flag a una clave existente del catálogo', () => {
    expect(VERTICAL_FLAGS['HOTEL']).toBe('vertical.hotel');
    expect(VERTICAL_FLAGS['EVENT_HALL']).toBe('vertical.event-hall');
    expect(VERTICAL_FLAGS['RESTAURANT']).toBeUndefined();
    for (const flag of Object.values(VERTICAL_FLAGS)) {
      expect(flag && flag in FLAGS_POR_DEFECTO).toBe(true);
    }
  });
});
