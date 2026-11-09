package com.mapit.reservations.domain.availability;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import org.jspecify.annotations.Nullable;

import com.mapit.shared.vertical.VerticalProfileView;

/**
 * Plano público con disponibilidad. HU-7.01/7.02 añade {@code endDate} (el fin puede caer otro
 * día) y el perfil de la vertical, para que el portal adapte formulario y terminología sin
 * repetir las reglas.
 */
public record PublicAvailabilityMap(UUID establishmentId, String establishmentName, String tenantSlug,
    String establishmentSlug, String timezone, LocalDate date, @Nullable String startTime,
    LocalDate endDate, @Nullable String endTime, Instant startsAt, Instant endsAt, String mode,
    VerticalProfileView vertical, List<Floor> floors) {
  public record Floor(UUID id, String name, int level, double canvasWidth, double canvasHeight, List<Sector> sectors) {}
  public record Sector(UUID id, String name, double width, double height, double x, double y, double rotation, List<Element> elements) {}
  public record Element(UUID id, String type, @Nullable String label, String name, @Nullable Integer capacity,
      double x, double y, double width, double height, double rotation, boolean selectable, String availability) {}
}
