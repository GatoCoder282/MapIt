package com.mapit.shared.vertical;

import java.time.Duration;
import java.time.LocalTime;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;

import org.jspecify.annotations.Nullable;

import com.mapit.shared.flags.FeatureFlag;

/**
 * Reglas de una vertical: qué se dibuja, qué se reserva y con qué ventana temporal.
 *
 * <p>Los tipos de elemento son los nombres de {@code SpaceElementType}; se guardan como texto
 * porque el shared kernel no conoce los enums de cada contexto (igual que
 * {@code SpaceDisplayName}). Los tests de spaces y reservations comprueban que cada nombre
 * existe en su enum.
 *
 * @param maxDuration duración máxima de una reserva; nula en {@link BookingMode#STAY}
 * @param minNights mínimo de noches; solo en {@link BookingMode#STAY}
 * @param maxNights máximo de noches; solo en {@link BookingMode#STAY}
 * @param defaultStartTime hora local de check-in; solo en {@link BookingMode#STAY}
 * @param defaultEndTime hora local de check-out; solo en {@link BookingMode#STAY}
 * @param flag flag de Unleash que la habilita; vacía en las verticales base
 */
public record VerticalProfile(
    Vertical vertical,
    BookingMode bookingMode,
    Set<String> allowedElementTypes,
    Set<String> reservableElementTypes,
    boolean allowsOvernight,
    @Nullable Duration maxDuration,
    @Nullable Integer minNights,
    @Nullable Integer maxNights,
    @Nullable LocalTime defaultStartTime,
    @Nullable LocalTime defaultEndTime,
    Optional<FeatureFlag> flag) {

  public VerticalProfile {
    Objects.requireNonNull(vertical, "vertical no puede ser null");
    Objects.requireNonNull(bookingMode, "bookingMode no puede ser null");
    Objects.requireNonNull(flag, "flag no puede ser null");
    allowedElementTypes = Set.copyOf(allowedElementTypes);
    reservableElementTypes = Set.copyOf(reservableElementTypes);
    if (!allowedElementTypes.containsAll(reservableElementTypes)) {
      throw new IllegalArgumentException("Un tipo reservable debe estar admitido en la vertical");
    }
    if (bookingMode == BookingMode.STAY) {
      Objects.requireNonNull(minNights, "Una estadía necesita mínimo de noches");
      Objects.requireNonNull(maxNights, "Una estadía necesita máximo de noches");
      Objects.requireNonNull(defaultStartTime, "Una estadía necesita hora de check-in");
      Objects.requireNonNull(defaultEndTime, "Una estadía necesita hora de check-out");
    } else {
      Objects.requireNonNull(maxDuration, "Un modo por horas necesita duración máxima");
    }
  }

  public boolean isAllowed(String elementType) {
    return allowedElementTypes.contains(elementType);
  }

  public boolean isReservable(String elementType) {
    return reservableElementTypes.contains(elementType);
  }
}
