package com.mapit.operations.infrastructure.state;

import java.sql.Timestamp;
import java.util.Optional;
import java.util.UUID;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import com.mapit.operations.domain.state.OperationalSpaceElement;
import com.mapit.operations.domain.state.SpaceElementStateRepository;
import com.mapit.shared.realtime.SpaceElementState;
import com.mapit.shared.tenant.TenantId;
import com.mapit.shared.tenant.TenantScope;

/** Adaptador JDBC sobre la tabla creada por HU-2.03, aislado por tenant y RLS. */
@Repository
public class JdbcSpaceElementStateRepository implements SpaceElementStateRepository {

  private final JdbcTemplate jdbc;

  public JdbcSpaceElementStateRepository(JdbcTemplate jdbc) {
    this.jdbc = jdbc;
  }

  @Override
  public Optional<OperationalSpaceElement> findAliveById(
      TenantId tenantId, UUID sectorId, UUID elementId) {
    setTenant(tenantId);
    return jdbc
        .query(
            """
            select id, tenant_id, sector_id, state, updated_at
            from space_element
            where tenant_id = ? and sector_id = ? and id = ? and deleted_at is null
            """,
            (rs, rowNum) ->
                new OperationalSpaceElement(
                    rs.getObject("id", UUID.class),
                    TenantId.of(rs.getString("tenant_id")),
                    rs.getObject("sector_id", UUID.class),
                    SpaceElementState.valueOf(rs.getString("state")),
                    rs.getTimestamp("updated_at").toInstant()),
            tenantId.value(),
            sectorId,
            elementId)
        .stream()
        .findFirst();
  }

  @Override
  public OperationalSpaceElement save(OperationalSpaceElement element) {
    setTenant(element.tenantId());
    return jdbc
        .query(
            """
            update space_element
            set state = ?, updated_at = ?
            where tenant_id = ? and sector_id = ? and id = ? and deleted_at is null
            returning id, tenant_id, sector_id, state, updated_at
            """,
            (rs, rowNum) ->
                new OperationalSpaceElement(
                    rs.getObject("id", UUID.class),
                    TenantId.of(rs.getString("tenant_id")),
                    rs.getObject("sector_id", UUID.class),
                    SpaceElementState.valueOf(rs.getString("state")),
                    rs.getTimestamp("updated_at").toInstant()),
            element.state().name(),
            Timestamp.from(element.updatedAt()),
            element.tenantId().value(),
            element.sectorId(),
            element.id())
        .stream()
        .findFirst()
        .orElseThrow(() -> new IllegalStateException("El elemento desapareció durante el cambio"));
  }

  private void setTenant(TenantId tenantId) {
    jdbc.queryForObject(TenantScope.SET_LOCAL_SQL, String.class, tenantId.value());
  }
}
