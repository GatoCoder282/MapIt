package com.mapit.operations.infrastructure.state;

import java.sql.Timestamp;
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
  public void append(SpaceElementStateChange change) {
    setTenant(change.tenantId());
    jdbc.update(
        """
        insert into space_element_state_change
          (id, tenant_id, sector_id, space_element_id, previous_state,
           new_state, changed_by, changed_at)
        values (?, ?, ?, ?, ?, ?, ?, ?)
        """,
        change.id(),
        change.tenantId().value(),
        change.sectorId(),
        change.elementId(),
        change.previousState().name(),
        change.newState().name(),
        change.changedBy(),
        Timestamp.from(change.changedAt()));
  }

  @Override
  public List<SpaceElementStateChange> findByElement(
      TenantId tenantId, UUID sectorId, UUID elementId) {
    setTenant(tenantId);
    return jdbc.query(
        """
        select id, tenant_id, sector_id, space_element_id, previous_state,
               new_state, changed_by, changed_at
        from space_element_state_change
        where tenant_id = ? and sector_id = ? and space_element_id = ?
        order by changed_at desc, id desc
        """,
        (rs, rowNum) ->
            new SpaceElementStateChange(
                rs.getObject("id", UUID.class),
                TenantId.of(rs.getString("tenant_id")),
                rs.getObject("sector_id", UUID.class),
                rs.getObject("space_element_id", UUID.class),
                SpaceElementState.valueOf(rs.getString("previous_state")),
                SpaceElementState.valueOf(rs.getString("new_state")),
                rs.getObject("changed_by", UUID.class),
                rs.getTimestamp("changed_at").toInstant()),
        tenantId.value(),
        sectorId,
        elementId);
  }

  private void setTenant(TenantId tenantId) {
    jdbc.queryForObject(TenantScope.SET_LOCAL_SQL, String.class, tenantId.value());
  }
}
