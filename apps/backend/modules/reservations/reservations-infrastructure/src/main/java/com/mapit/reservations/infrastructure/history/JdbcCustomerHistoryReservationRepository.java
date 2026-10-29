package com.mapit.reservations.infrastructure.history;

import java.sql.Array;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.Arrays;
import java.util.List;
import java.util.UUID;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import com.mapit.reservations.domain.history.CustomerHistoryReservation;
import com.mapit.reservations.domain.history.CustomerHistoryReservationRepository;
import com.mapit.reservations.domain.reservation.ReservationStatus;
import com.mapit.shared.tenant.TenantId;
import com.mapit.shared.tenant.TenantScope;

@Repository
public class JdbcCustomerHistoryReservationRepository implements CustomerHistoryReservationRepository {
  private final JdbcTemplate jdbc;

  public JdbcCustomerHistoryReservationRepository(JdbcTemplate jdbc) {
    this.jdbc = jdbc;
  }

  @Override
  public List<CustomerHistoryReservation> findForPerson(TenantId tenant, UUID person,
      Instant asOf, boolean upcoming, int limitPlusOne, int offset) {
    jdbc.queryForObject(TenantScope.SET_LOCAL_SQL, String.class, tenant.value());
    // Una consulta con lateral: sin N+1, incluidas reservas de staff y públicas.
    return jdbc.query("""
        select r.id, r.establishment_id, e.name as establishment_name,
               e.timezone, r.starts_at, r.ends_at, r.status, r.created_at,
               coalesce(elements.ids, '{}'::uuid[]) as element_ids
        from reservation r
        join establishment e on e.tenant_id = r.tenant_id and e.id = r.establishment_id
        left join lateral (
          select array_agg(x.space_element_id order by x.space_element_id) as ids
          from reservation_space_element x
          where x.tenant_id = r.tenant_id and x.reservation_id = r.id
        ) elements on true
        where r.tenant_id = ? and r.person_id = ?
          and ((? and r.ends_at > ?) or (not ? and r.ends_at <= ?))
        order by
          case when ? then r.starts_at end asc,
          case when ? then r.id end asc,
          case when not ? then r.starts_at end desc,
          case when not ? then r.id end desc
        limit ? offset ?
        """, JdbcCustomerHistoryReservationRepository::map, tenant.value(), person,
        upcoming, Timestamp.from(asOf), upcoming, Timestamp.from(asOf),
        upcoming, upcoming, upcoming, upcoming, limitPlusOne, offset);
  }

  private static CustomerHistoryReservation map(ResultSet rs, int row) throws SQLException {
    Array array = rs.getArray("element_ids");
    List<UUID> ids = Arrays.stream((Object[]) array.getArray()).map(UUID.class::cast).toList();
    return new CustomerHistoryReservation(rs.getObject("id", UUID.class),
        rs.getObject("establishment_id", UUID.class), rs.getString("establishment_name"),
        ids, rs.getTimestamp("starts_at").toInstant(), rs.getTimestamp("ends_at").toInstant(),
        rs.getString("timezone"), ReservationStatus.valueOf(rs.getString("status")),
        rs.getTimestamp("created_at").toInstant());
  }
}
