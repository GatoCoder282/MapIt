package com.mapit.reservations.infrastructure.reservation;

import java.sql.Timestamp;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import com.mapit.reservations.domain.reservation.ReservationAvailabilityRepository;
import com.mapit.reservations.domain.reservation.ReservationTimeRange;
import com.mapit.shared.tenant.TenantId;
import com.mapit.shared.tenant.TenantScope;

/** Consulta solapamientos con la semántica de intervalo semiabierto [inicio, fin). */
@Repository
public class JdbcReservationAvailabilityRepository
    implements ReservationAvailabilityRepository {

  private final JdbcTemplate jdbc;

  public JdbcReservationAvailabilityRepository(JdbcTemplate jdbc) {
    this.jdbc = jdbc;
  }

  @Override
  public Set<UUID> findConflictingElementIds(
      TenantId tenantId, Set<UUID> elementIds, ReservationTimeRange timeRange) {
    if (elementIds.isEmpty()) {
      return Set.of();
    }
    setTenant(tenantId);
    String placeholders = String.join(", ", Collections.nCopies(elementIds.size(), "?"));
    String sql =
        """
        select distinct rse.space_element_id
        from reservation_space_element rse
        join reservation r
          on r.id = rse.reservation_id and r.tenant_id = rse.tenant_id
        where r.tenant_id = ?
          and rse.space_element_id in (%s)
          and r.status in ('CREATED', 'CONFIRMED', 'ACTIVE')
          and r.starts_at < ?
          and ? < r.ends_at
        """
            .formatted(placeholders);
    List<Object> arguments = new ArrayList<>();
    arguments.add(tenantId.value());
    arguments.addAll(elementIds);
    arguments.add(Timestamp.from(timeRange.endsAt()));
    arguments.add(Timestamp.from(timeRange.startsAt()));
    return new LinkedHashSet<>(
        jdbc.query(
            sql,
            (result, rowNumber) -> result.getObject("space_element_id", UUID.class),
            arguments.toArray()));
  }

  private void setTenant(TenantId tenantId) {
    jdbc.queryForObject(TenantScope.SET_LOCAL_SQL, String.class, tenantId.value());
  }
}
