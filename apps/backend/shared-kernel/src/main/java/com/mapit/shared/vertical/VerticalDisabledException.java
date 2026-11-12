package com.mapit.shared.vertical;

/**
 * La vertical del establecimiento está apagada en Unleash para el tenant (spec D3).
 *
 * <p>Se traduce a {@code 403 vertical-disabled} en la frontera HTTP. La vertical persistida no
 * cambia: solo se rechaza el alta o la reserva nueva.
 */
public class VerticalDisabledException extends RuntimeException {

  private final Vertical vertical;

  public VerticalDisabledException(Vertical vertical) {
    super("La vertical %s no está habilitada para este tenant".formatted(vertical));
    this.vertical = vertical;
  }

  public Vertical vertical() {
    return vertical;
  }
}
