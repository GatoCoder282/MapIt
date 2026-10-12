package com.mapit.reservations.infrastructure.reservation;

import java.sql.Timestamp;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import com.mapit.reservations.domain.person.PersonId;
import com.mapit.reservations.domain.reservation.Reservation;
import com.mapit.reservations.domain.reservation.ReservationId;
import com.mapit.reservations.domain.reservation.ReservationRepository;
import com.mapit.reservations.domain.reservation.ReservationStatus;
import com.mapit.reservations.domain.reservation.ReservationTimeRange;
import com.mapit.shared.tenant.TenantId;
import com.mapit.shared.tenant.TenantScope;

/** Inserta el agregado y sus elementos dentro de la transacción del caso de uso. */
@Repository
public class JdbcReservationRepository implements ReservationRepository {

  private final JdbcTemplate jdbc;

  public JdbcReservationRepository(JdbcTemplate jdbc) {
    this.jdbc = jdbc;
  }

  @Override
  public Reservation save(Reservation reservation) {
    setTenant(reservation.tenantId());
    jdbc.update(
        """
        insert into reservation (
          id, tenant_id, establishment_id, person_id, starts_at, ends_at,
          status, created_at, created_by, updated_at
        ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        reservation.id().value(),
        reservation.tenantId().value(),
        reservation.establishmentId(),
        reservation.personId().value(),
        Timestamp.from(reservation.timeRange().startsAt()),
        Timestamp.from(reservation.timeRange().endsAt()),
        reservation.status().name(),
        Timestamp.from(reservation.createdAt()),
        reservation.createdBy(),
        Timestamp.from(reservation.createdAt()));

    List<Object[]> associations =
        reservation.spaceElementIds().stream()
            .map(
                elementId ->
                    new Object[] {
                      reservation.tenantId().value(), reservation.id().value(), elementId
                    })
            .toList();
    jdbc.batchUpdate(
        """
        insert into reservation_space_element (tenant_id, reservation_id, space_element_id)
        values (?, ?, ?)
        """,
        associations);
    return reservation;
  }

  @Override
  public Optional<Reservation> findAliveByTenantAndEstablishmentAndId(
      TenantId tenantId, UUID establishmentId, ReservationId reservationId) {
    setTenant(tenantId);
    List<ReservationRow> rows =
        jdbc.query(
            """
            select id, tenant_id, establishment_id, person_id, starts_at, ends_at,
              status, created_at, created_by
            from reservation
            where tenant_id = ? and establishment_id = ? and id = ?
            """,
            (result, rowNumber) ->
                new ReservationRow(
                    result.getObject("id", UUID.class),
                    TenantId.of(result.getString("tenant_id")),
                    result.getObject("establishment_id", UUID.class),
                    PersonId.of(result.getObject("person_id", UUID.class)),
                    result.getTimestamp("starts_at").toInstant(),
                    result.getTimestamp("ends_at").toInstant(),
                    ReservationStatus.valueOf(result.getString("status")),
                    result.getTimestamp("created_at").toInstant(),
                    result.getObject("created_by", UUID.class)),
            tenantId.value(),
            establishmentId,
            reservationId.value());
    if (rows.isEmpty()) {
      return Optional.empty();
    }

    ReservationRow row = rows.getFirst();
    List<UUID> elementIds =
        jdbc.query(
            """
            select space_element_id
            from reservation_space_element
            where tenant_id = ? and reservation_id = ?
            order by space_element_id
            """,
            (result, rowNumber) -> result.getObject("space_element_id", UUID.class),
            tenantId.value(),
            reservationId.value());
    return Optional.of(
        new Reservation(
            ReservationId.of(row.id()),
            row.tenantId(),
            row.establishmentId(),
            row.personId(),
            java.util.Set.copyOf(elementIds),
            ReservationTimeRange.of(row.startsAt(), row.endsAt()),
            row.status(),
            row.createdAt(),
            row.createdBy()));
  }

  @Override
  public boolean updateStatus(
      TenantId tenantId,
      UUID establishmentId,
      ReservationId reservationId,
      ReservationStatus expectedStatus,
      ReservationStatus nextStatus,
      UUID actorId,
      java.time.Instant updatedAt) {
    setTenant(tenantId);
    return jdbc.update(
            """
            update reservation
            set status = ?, updated_at = ?, updated_by = ?
            where tenant_id = ? and establishment_id = ? and id = ? and status = ?
            """,
            nextStatus.name(),
            Timestamp.from(updatedAt),
            actorId,
            tenantId.value(),
            establishmentId,
            reservationId.value(),
            expectedStatus.name())
        == 1;
  }

  private void setTenant(TenantId tenantId) {
    jdbc.queryForObject(TenantScope.SET_LOCAL_SQL, String.class, tenantId.value());
  }

  private record ReservationRow(
      UUID id,
      TenantId tenantId,
      UUID establishmentId,
      PersonId personId,
      java.time.Instant startsAt,
      java.time.Instant endsAt,
      ReservationStatus status,
      java.time.Instant createdAt,
      UUID createdBy) {}
}
