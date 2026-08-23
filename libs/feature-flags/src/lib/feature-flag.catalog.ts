/**
 * Catálogo de feature flags del frontend.
 *
 * Debe mantenerse en sincronía con el enum `FeatureFlag` del backend
 * (apps/backend/shared-kernel/…/flags/FeatureFlag.java).
 * `pnpm new:flag` crea la entrada en ambos lados a la vez para evitar que se separen.
 *
 * El tipo literal hace que una errata en el nombre de una flag sea un error de
 * compilación, no un `false` silencioso en producción.
 */
export const FLAGS_POR_DEFECTO = {
  /** Banner de demostración: verifica el toggle de punta a punta. */
  'demo.hello': true,

  /** Pago de anticipo con pasarela QR (CU-17). */
  'payments.qr': false,

  /** Difusión de estados por WebSocket/STOMP (CU-09). Kill switch. */
  'realtime.websocket': true,

  /** Agrupar elementos en el editor de mapas (CU-06). */
  'spaces.editor-grouping': false,

  /** Vertical Hotel: reservas por rango de fechas (CU-22). */
  'vertical.hotel': false,

  /** Vertical Salón de eventos: butacas numeradas (CU-21). */
  'vertical.event-hall': false,
} as const satisfies Record<string, boolean>;

export type FeatureFlagKey = keyof typeof FLAGS_POR_DEFECTO;
