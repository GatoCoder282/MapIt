package com.mapit.operations.infrastructure.state;

import java.sql.Timestamp;
import java.util.Optional;
import java.util.UUID;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
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

  private static final RowMapper<OperationalSpaceElement> MAPPER =
      (rs, rowNum) ->
          new OperationalSpaceElement(
              rs.getObject("id", UUID.class),
              TenantId.of(rs.getString("tenant_id")),
              rs.getObject("establishment_id", UUID.class),
              rs.getObject("sector_id", UUID.class),
              SpaceElementState.valueOf(rs.getString("state")),
              rs.getTimestamp("updated_at").toInstant());

  public JdbcSpaceElementStateRepository(JdbcTemplate jdbc) {
    this.jdbc = jdbc;
  }

  @Override
  public Optional<OperationalSpaceElement> findAliveById(
      TenantId tenantId, UUID sectorId, UUID elementId) {
    return read(tenantId, sectorId, elementId, false);
  }

  @Override
  public Optional<OperationalSpaceElement> lockAliveById(
      TenantId tenantId, UUID sectorId, UUID elementId) {
    return read(tenantId, sectorId, elementId, true);
  }

  private Optional<OperationalSpaceElement> read(TenantId tenantId, UUID sectorId, UUID elementId, boolean lock) {
    setTenant(tenantId);
    return jdbc
        .query(
            """
            select el.id, el.tenant_id, f.establishment_id, el.sector_id, el.state, el.updated_at
            from space_element el
            join sector s on s.id = el.sector_id
            join floor f on f.id = s.floor_id
            where el.tenant_id = ? and el.sector_id = ? and el.id = ?
              and el.deleted_at is null and s.deleted_at is null and f.deleted_at is null
            """ + (lock ? " for update of el" : ""),
            MAPPER,
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
            update space_element el
            set state = ?, updated_at = ?
            from sector s
            join floor f on f.id = s.floor_id
            where el.tenant_id = ? and el.sector_id = ? and el.id = ? and s.id = el.sector_id
              and el.deleted_at is null and s.deleted_at is null and f.deleted_at is null
            returning el.id, el.tenant_id, f.establishment_id, el.sector_id, el.state, el.updated_at
            """,
            MAPPER,
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
