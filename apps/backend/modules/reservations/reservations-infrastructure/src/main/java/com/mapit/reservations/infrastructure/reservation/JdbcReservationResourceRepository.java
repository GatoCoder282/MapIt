package com.mapit.reservations.infrastructure.reservation;

import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import java.util.UUID;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import com.mapit.reservations.domain.reservation.ReservationResource;
import com.mapit.reservations.domain.reservation.ReservationResourceRepository;
import com.mapit.shared.tenant.TenantId;
import com.mapit.shared.tenant.TenantScope;

/** Consulta las tablas de spaces mediante una proyección propia del contexto reservations. */
@Repository
public class JdbcReservationResourceRepository implements ReservationResourceRepository {

  private final JdbcTemplate jdbc;

  public JdbcReservationResourceRepository(JdbcTemplate jdbc) {
    this.jdbc = jdbc;
  }

  @Override
  public boolean establishmentExists(TenantId tenantId, UUID establishmentId) {
    setTenant(tenantId);
    Integer count =
        jdbc.queryForObject(
            """
            select count(*) from establishment
            where tenant_id = ? and id = ? and deleted_at is null
            """,
            Integer.class,
            tenantId.value(),
            establishmentId);
    return count != null && count > 0;
  }

  @Override
  public List<ReservationResource> findAliveByIds(
      TenantId tenantId, Collection<UUID> elementIds) {
    if (elementIds.isEmpty()) {
      return List.of();
    }
    setTenant(tenantId);
    String placeholders = String.join(", ", java.util.Collections.nCopies(elementIds.size(), "?"));
    String sql =
        """
        select se.id, f.establishment_id, se.type, se.state
        from space_element se
        join sector s
          on s.id = se.sector_id and s.tenant_id = se.tenant_id and s.deleted_at is null
        join floor f
          on f.id = s.floor_id and f.tenant_id = s.tenant_id and f.deleted_at is null
        join establishment e
          on e.id = f.establishment_id and e.tenant_id = f.tenant_id and e.deleted_at is null
        where se.tenant_id = ? and se.deleted_at is null and se.id in (%s)
        """
            .formatted(placeholders);
    List<Object> arguments = new ArrayList<>();
    arguments.add(tenantId.value());
    arguments.addAll(elementIds);
    return jdbc.query(
        sql,
        (result, rowNumber) ->
            new ReservationResource(
                result.getObject("id", UUID.class),
                result.getObject("establishment_id", UUID.class),
                ReservationResource.Kind.valueOf(result.getString("type")),
                ReservationResource.OperationalState.valueOf(result.getString("state"))),
        arguments.toArray());
  }

  private void setTenant(TenantId tenantId) {
    jdbc.queryForObject(TenantScope.SET_LOCAL_SQL, String.class, tenantId.value());
  }
}
