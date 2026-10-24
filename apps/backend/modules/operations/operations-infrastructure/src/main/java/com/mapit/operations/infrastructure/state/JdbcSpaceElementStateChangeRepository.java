package com.mapit.operations.infrastructure.state;

import java.util.List;
import java.util.UUID;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import com.mapit.operations.domain.state.SpaceElementStateChange;
import com.mapit.operations.domain.state.SpaceElementStateChangeRepository;
import com.mapit.shared.realtime.SpaceElementState;
import com.mapit.shared.tenant.TenantId;
import com.mapit.shared.tenant.TenantScope;

/** Adaptador JDBC de la bitácora inmutable, con contexto RLS por transacción. */
@Repository
public class JdbcSpaceElementStateChangeRepository
    implements SpaceElementStateChangeRepository {

  private final JdbcTemplate jdbc;

  public JdbcSpaceElementStateChangeRepository(JdbcTemplate jdbc) {
    this.jdbc = jdbc;
  }

  @Override
  public List<SpaceElementStateChange> findByElement(
      TenantId tenantId, UUID sectorId, UUID elementId) {
    setTenant(tenantId);
    return jdbc.query(
        """
        select id, tenant_id, resource_id as space_element_id,
               details ->> 'sectorId' as sector_id,
               details ->> 'previousState' as previous_state,
               details ->> 'newState' as new_state,
               actor_id as changed_by, occurred_at as changed_at
        from audit_log
        where tenant_id = ?
          and resource_type = 'SPACE_ELEMENT'
          and event_type = 'SPACE_ELEMENT_STATE_CHANGED'
          and resource_id = ?
          and details ->> 'sectorId' = ?
        order by occurred_at desc, id desc
        """,
        (rs, rowNum) ->
            new SpaceElementStateChange(
                rs.getObject("id", UUID.class),
                TenantId.of(rs.getString("tenant_id")),
                UUID.fromString(rs.getString("sector_id")),
                rs.getObject("space_element_id", UUID.class),
                SpaceElementState.valueOf(rs.getString("previous_state")),
                SpaceElementState.valueOf(rs.getString("new_state")),
                rs.getObject("changed_by", UUID.class),
                rs.getTimestamp("changed_at").toInstant()),
        tenantId.value(),
        elementId,
        sectorId.toString());
  }

  private void setTenant(TenantId tenantId) {
    jdbc.queryForObject(TenantScope.SET_LOCAL_SQL, String.class, tenantId.value());
  }
}
