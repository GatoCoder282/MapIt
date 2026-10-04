package com.mapit.reservations.infrastructure.reservation;

import java.sql.Timestamp;
import java.util.List;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import com.mapit.reservations.domain.reservation.Reservation;
import com.mapit.reservations.domain.reservation.ReservationRepository;
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

  private void setTenant(TenantId tenantId) {
    jdbc.queryForObject(TenantScope.SET_LOCAL_SQL, String.class, tenantId.value());
  }
}
