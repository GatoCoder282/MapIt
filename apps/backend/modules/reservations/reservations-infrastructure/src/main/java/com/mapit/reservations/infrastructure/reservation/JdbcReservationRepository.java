package com.mapit.reservations.infrastructure.reservation;

import java.sql.Array;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
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

  /**
   * Reservas del tenant con sus elementos.
   *
   * <p>El {@code left join lateral} trae los elementos de cada reserva en la misma
   * consulta: una segunda consulta por reserva sería N+1 y el array evita de agrupar
   * filas en Java.
   */
  private static final String SELECT_ALL = """
      select r.id, r.tenant_id, r.establishment_id, r.person_id, r.starts_at, r.ends_at,
             r.status, r.created_at, r.created_by,
             coalesce(e.element_ids, '{}') as element_ids
      from reservation r
      left join lateral (
        select array_agg(rse.space_element_id order by rse.space_element_id) as element_ids
        from reservation_space_element rse
        where rse.tenant_id = r.tenant_id and rse.reservation_id = r.id
      ) e on true
      where r.tenant_id = ?
      order by r.created_at desc, r.id desc
      """;

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
  public List<Reservation> findAll(TenantId tenantId) {
    setTenant(tenantId);
    return jdbc.query(SELECT_ALL, JdbcReservationRepository::map, tenantId.value());
  }

  private static Reservation map(ResultSet result, int rowNumber) throws SQLException {
    return new Reservation(
        ReservationId.of(result.getObject("id", UUID.class)),
        TenantId.of(result.getString("tenant_id")),
        result.getObject("establishment_id", UUID.class),
        PersonId.of(result.getObject("person_id", UUID.class)),
        elementIds(result),
        ReservationTimeRange.of(
            result.getTimestamp("starts_at").toInstant(),
            result.getTimestamp("ends_at").toInstant()),
        ReservationStatus.valueOf(result.getString("status")),
        result.getTimestamp("created_at").toInstant(),
        result.getObject("created_by", UUID.class));
  }

  private static Set<UUID> elementIds(ResultSet result) throws SQLException {
    Array column = result.getArray("element_ids");
    if (column == null) {
      return Set.of();
    }
    Object[] raw = (Object[]) column.getArray();
    Set<UUID> ids = new LinkedHashSet<>(raw.length);
    for (Object elementId : raw) {
      ids.add((UUID) elementId);
    }
    return ids;
  }

  private void setTenant(TenantId tenantId) {
    jdbc.queryForObject(TenantScope.SET_LOCAL_SQL, String.class, tenantId.value());
  }
}
