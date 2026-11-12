package com.mapit.shared.vertical;

/** Cómo reserva una vertical. Cada modo tiene su propia ventana temporal (spec D4). */
public enum BookingMode {
  /** Turno de restaurante: mismo día local. */
  SHIFT,
  /** Noche de discoteca: puede terminar al día siguiente. */
  NIGHT,
  /** Evento de salón: puede terminar al día siguiente. */
  EVENT,
  /** Estadía de hotel: se mide en noches entre check-in y check-out. */
  STAY
}
