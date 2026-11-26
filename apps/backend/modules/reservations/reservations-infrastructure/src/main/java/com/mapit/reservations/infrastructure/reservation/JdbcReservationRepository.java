package com.mapit.reservations.infrastructure.reservation;

import java.sql.Array;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;

import org.jspecify.annotations.Nullable;
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
  private static final String SELECT = """
      select r.id, r.tenant_id, r.establishment_id, r.person_id, r.starts_at, r.ends_at,
             r.status, r.created_at, r.created_by, r.party_size, r.notes,
             %s as customer_name,
             coalesce(e.element_ids, '{}') as element_ids
      from reservation r
      left join lateral (
        select array_agg(rse.space_element_id order by rse.space_element_id) as element_ids
        from reservation_space_element rse
        where rse.tenant_id = r.tenant_id and rse.reservation_id = r.id
      ) e on true
      %s
      where r.tenant_id = ? %s
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
          status, created_at, created_by, updated_at, party_size, notes
        ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
        Timestamp.from(reservation.createdAt()),
        reservation.partySize(),
        reservation.notes());

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
    enqueueCreated(reservation);
    return reservation;
  }

  private void enqueueCreated(Reservation reservation) {
    UUID eventId = UUID.randomUUID();
    Timestamp now = Timestamp.from(reservation.createdAt());
    jdbc.update(
        """
        insert into realtime_event_outbox (
          event_id, tenant_id, event_type, schema_version, occurred_at, establishment_id,
          aggregate_version, payload
        ) values (?, ?, 'reservation.created.v1', 1, ?, ?, 1,
          jsonb_build_object('eventId', ?::uuid, 'eventType', 'reservation.created.v1',
            'schemaVersion', 1, 'establishmentId', ?::uuid))
        """,
        eventId,
        reservation.tenantId().value(),
        now,
        reservation.establishmentId(),
        eventId,
        reservation.establishmentId());
  }

  @Override
  public List<Reservation> findAll(TenantId tenantId) {
    setTenant(tenantId);
    return jdbc.query(SELECT.formatted("null", "", ""), JdbcReservationRepository::map, tenantId.value());
  }

  @Override
  public List<WithCustomer> findForEstablishment(
      TenantId tenantId, UUID establishmentId, @Nullable Instant endsAfter) {
    setTenant(tenantId);
    String personJoin = """
        left join person p on p.id = r.person_id and p.tenant_id = r.tenant_id and p.deleted_at is null
        """;
    String filter = "and r.establishment_id = ?";
    Object[] parameters;
    if (endsAfter == null) {
      parameters = new Object[] {tenantId.value(), establishmentId};
    } else {
      filter += " and r.ends_at > ? and r.status in ('CREATED', 'CONFIRMED', 'ACTIVE')";
      parameters = new Object[] {tenantId.value(), establishmentId, Timestamp.from(endsAfter)};
    }
    return jdbc.query(
        SELECT.formatted("p.full_name", personJoin, filter),
        (row, index) -> new WithCustomer(map(row, index), row.getString("customer_name")),
        parameters);
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
        result.getObject("created_by", UUID.class),
        result.getObject("party_size", Integer.class),
        result.getString("notes"));
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
