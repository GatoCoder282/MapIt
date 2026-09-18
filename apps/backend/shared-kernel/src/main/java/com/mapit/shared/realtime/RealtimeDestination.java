package com.mapit.shared.realtime;

import java.util.Optional;
import java.util.UUID;

/** Parser y generador sin framework para los destinos STOMP públicos de HUT-01. */
public record RealtimeDestination(UUID establishmentId, Optional<UUID> sectorId) {

  public static final String ESTABLISHMENT_TOPIC_PREFIX = "/topic/establishments/";
  public static final String SECTOR_SEGMENT = "/sectors/";

  public RealtimeDestination {
    if (establishmentId == null) {
      throw new NullPointerException("establishmentId no puede ser null");
    }
    if (sectorId == null) {
      throw new NullPointerException("sectorId no puede ser null");
    }
  }

  /** Interpreta solo los destinos de sala que el servidor expone. */
  public static Optional<RealtimeDestination> parse(String destination) {
    if (destination == null || !destination.startsWith(ESTABLISHMENT_TOPIC_PREFIX)) {
      return Optional.empty();
    }
    String suffix = destination.substring(ESTABLISHMENT_TOPIC_PREFIX.length());
    String[] parts = suffix.split("/", -1);
    try {
      if (parts.length == 1 && !parts[0].isBlank()) {
        return Optional.of(new RealtimeDestination(UUID.fromString(parts[0]), Optional.empty()));
      }
      if (parts.length == 3
          && !parts[0].isBlank()
          && "sectors".equals(parts[1])
          && !parts[2].isBlank()) {
        return Optional.of(
            new RealtimeDestination(
                UUID.fromString(parts[0]), Optional.of(UUID.fromString(parts[2]))));
      }
    } catch (IllegalArgumentException ignored) {
      // Un destino mal formado no debe tumbar el canal: simplemente no autoriza la suscripción.
    }
    return Optional.empty();
  }

  /** Destino STOMP al que se entrega el evento. */
  public String topic() {
    return ESTABLISHMENT_TOPIC_PREFIX
        + establishmentId
        + sectorId.map(id -> SECTOR_SEGMENT + id).orElse("");
  }
}
