package com.mapit.reservations.domain.availability;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import org.jspecify.annotations.Nullable;

public record PublicAvailabilityMap(UUID establishmentId, String establishmentName, String tenantSlug,
    String establishmentSlug, String timezone, LocalDate date, @Nullable String startTime,
    @Nullable String endTime, Instant startsAt, Instant endsAt, String mode, List<Floor> floors) {
  public record Floor(UUID id, String name, int level, double canvasWidth, double canvasHeight, List<Sector> sectors) {}
  public record Sector(UUID id, String name, double width, double height, double x, double y, double rotation, List<Element> elements) {}
  public record Element(UUID id, String type, @Nullable String label, String name, @Nullable Integer capacity,
      double x, double y, double width, double height, double rotation, boolean selectable, String availability) {}
}
