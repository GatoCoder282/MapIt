package com.mapit.operations.infrastructure.state;

import java.util.UUID;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import com.mapit.operations.domain.state.SpaceElementRealtimeContextRepository;
import com.mapit.shared.tenant.TenantId;
import com.mapit.shared.tenant.TenantScope;

/** Adaptador JDBC: sector → planta → establecimiento y conteo de la bitácora, con RLS. */
@Repository
public class JdbcSpaceElementRealtimeContextRepository
    implements SpaceElementRealtimeContextRepository {

  private final JdbcTemplate jdbc;

  public JdbcSpaceElementRealtimeContextRepository(JdbcTemplate jdbc) {
    this.jdbc = jdbc;
  }

  @Override
  public SpaceElementRealtimeContext resolve(TenantId tenantId, UUID sectorId, UUID elementId) {
    jdbc.queryForObject(TenantScope.SET_LOCAL_SQL, String.class, tenantId.value());
    return jdbc
        .query(
            """
            select f.establishment_id,
                   (select count(*)
                    from space_element_state_change c
                    where c.tenant_id = s.tenant_id and c.space_element_id = ?) as version
            from sector s
            join floor f on f.id = s.floor_id and f.tenant_id = s.tenant_id
            where s.tenant_id = ? and s.id = ?
            """,
            (rs, rowNum) ->
                new SpaceElementRealtimeContext(
                    rs.getObject("establishment_id", UUID.class), rs.getLong("version")),
            elementId,
            tenantId.value(),
            sectorId)
        .stream()
        .findFirst()
        .orElseThrow(
            () -> new IllegalStateException("El sector del elemento desapareció durante el cambio"));
  }
}
