package com.mapit.operations.infrastructure.state;

import java.util.EnumMap;
import java.util.Map;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import com.mapit.operations.domain.state.SpaceElementStateSummaryRepository;
import com.mapit.shared.realtime.SpaceElementState;
import com.mapit.shared.tenant.TenantId;
import com.mapit.shared.tenant.TenantScope;

/** Adaptador JDBC del resumen: filtro explícito por tenant más RLS por sesión. */
@Repository
public class JdbcSpaceElementStateSummaryRepository implements SpaceElementStateSummaryRepository {

  private final JdbcTemplate jdbc;

  public JdbcSpaceElementStateSummaryRepository(JdbcTemplate jdbc) {
    this.jdbc = jdbc;
  }

  @Override
  public Map<SpaceElementState, Long> countByState(TenantId tenantId) {
    setTenant(tenantId);
    return jdbc.query(
        """
        select state, count(*) as total
        from space_element
        where tenant_id = ? and deleted_at is null
        group by state
        """,
        rs -> {
          Map<SpaceElementState, Long> counts = new EnumMap<>(SpaceElementState.class);
          while (rs.next()) {
            counts.put(SpaceElementState.valueOf(rs.getString("state")), rs.getLong("total"));
          }
          return counts;
        },
        tenantId.value());
  }

  private void setTenant(TenantId tenantId) {
    jdbc.queryForObject(TenantScope.SET_LOCAL_SQL, String.class, tenantId.value());
  }
}
