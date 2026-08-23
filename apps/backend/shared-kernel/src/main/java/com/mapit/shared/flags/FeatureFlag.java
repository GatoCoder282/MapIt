package com.mapit.shared.flags;

/**
 * Catálogo de feature toggles de MapIt.
 *
 * <p>Se usa un enum en vez de strings sueltos por tres razones:
 * el compilador detecta erratas, el IDE encuentra todos los usos de una flag,
 * y el catálogo queda documentado en un solo lugar.
 *
 * <p>Los cuatro tipos son los canónicos (Martin Fowler); ver plan §9.
 * <strong>Higiene:</strong> toda flag de tipo RELEASE nace con fecha de retiro
 * y un issue asociado. Las flags zombis son deuda técnica.
 */
public enum FeatureFlag {

  /** Banner de demostración: verifica el toggle de punta a punta. */
  DEMO_HELLO("demo.hello", Tipo.EXPERIMENT, true),

  /** Pago de anticipo con pasarela QR (CU-17). */
  PAYMENTS_QR("payments.qr", Tipo.RELEASE, false),

  /** Difusión de estados por WebSocket/STOMP (CU-09). Kill switch: cae a polling. */
  REALTIME_WEBSOCKET("realtime.websocket", Tipo.KILL_SWITCH, true),

  /** Agrupar elementos en el editor de mapas (CU-06). */
  SPACES_EDITOR_GROUPING("spaces.editor-grouping", Tipo.RELEASE, false),

  /** Vertical Hotel: reservas por rango de fechas (CU-22). */
  VERTICAL_HOTEL("vertical.hotel", Tipo.PERMISSION, false),

  /** Vertical Salón de eventos: butacas numeradas (CU-21). */
  VERTICAL_EVENT_HALL("vertical.event-hall", Tipo.PERMISSION, false);

  /**
   * Tipos canónicos de toggle. El tipo determina cuánto debe vivir la flag:
   * RELEASE y EXPERIMENT se borran; KILL_SWITCH y PERMISSION son permanentes.
   */
  public enum Tipo {
    /** Temporal, mientras se termina una funcionalidad. Se retira al estabilizar. */
    RELEASE,
    /** Permanente. Apaga una funcionalidad en caliente ante un incidente. */
    KILL_SWITCH,
    /** Corta. Compara dos variantes (A/B). */
    EXPERIMENT,
    /** Permanente. Habilita funcionalidad según el tenant o el rol. */
    PERMISSION,
  }

  private final String clave;
  private final Tipo tipo;
  private final boolean valorPorDefecto;

  FeatureFlag(String clave, Tipo tipo, boolean valorPorDefecto) {
    this.clave = clave;
    this.tipo = tipo;
    this.valorPorDefecto = valorPorDefecto;
  }

  /** Clave tal como está registrada en Unleash. */
  public String clave() {
    return clave;
  }

  public Tipo tipo() {
    return tipo;
  }

  /**
   * Valor usado cuando el servidor de flags no responde.
   *
   * <p>La aplicación nunca debe caerse porque Unleash esté abajo.
   */
  public boolean valorPorDefecto() {
    return valorPorDefecto;
  }
}
