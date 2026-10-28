package com.mapit.reservations.domain.history;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import com.mapit.reservations.domain.reservation.ReservationStatus;

/** Proyección pública: no incluye propietario, correo ni actor de staff. */
public record CustomerHistoryReservation(UUID id, UUID establishmentId, String establishmentName,
    List<UUID> spaceElementIds, Instant startsAt, Instant endsAt, String timezone,
    ReservationStatus status, Instant createdAt) {}
