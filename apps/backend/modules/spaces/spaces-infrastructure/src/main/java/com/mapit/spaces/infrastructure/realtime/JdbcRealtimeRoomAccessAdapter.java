package com.mapit.spaces.infrastructure.realtime;

import java.util.Optional;
import java.util.Set;
import java.util.UUID;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionTemplate;

import com.mapit.shared.realtime.RealtimeRoomAccessPort;
import com.mapit.shared.tenant.TenantId;
import com.mapit.shared.tenant.TenantScope;

/** Verifica la pertenencia de una sala contra el modelo espacial y su RLS. */
@Component
public final class JdbcRealtimeRoomAccessAdapter implements RealtimeRoomAccessPort {

  private static final Set<String> ROLES_DE_OPERACION = Set.of("ADMIN", "MANAGER", "STAFF");

  private final JdbcTemplate jdbc;
  private final TransactionTemplate transactions;

  public JdbcRealtimeRoomAccessAdapter(JdbcTemplate jdbc, TransactionTemplate transactions) {
    this.jdbc = jdbc;
    this.transactions = transactions;
  }

  @Override
  public boolean canSubscribe(
      TenantId tenantId,
      UUID userId,
      String role,
      UUID establishmentId,
      Optional<UUID> sectorId) {
    if (!ROLES_DE_OPERACION.contains(role)) return false;
    Boolean allowed =
        transactions.execute(
            status -> {
              jdbc.queryForObject(TenantScope.SET_LOCAL_SQL, String.class, tenantId.value());
              Boolean activeUser =
                  jdbc.queryForObject(
                      "select exists (select 1 from app_user where id = ? and tenant_id = ? and active)",
                      Boolean.class,
                      userId,
                      tenantId.value());
              if (!Boolean.TRUE.equals(activeUser)) return false;
              if (sectorId.isEmpty()) {
                return jdbc.queryForObject(
                    """
                    select exists (
                      select 1
                      from establishment
                      where id = ? and tenant_id = ? and deleted_at is null
                    )
                    """,
                    Boolean.class,
                    establishmentId,
                    tenantId.value());
              }
              return jdbc.queryForObject(
                  """
                  select exists (
                    select 1
                    from sector s
                    join floor f on f.id = s.floor_id
                    join establishment e on e.id = f.establishment_id
                    where s.id = ?
                      and s.tenant_id = ?
                      and f.tenant_id = ?
                      and e.tenant_id = ?
                      and s.deleted_at is null
                      and f.deleted_at is null
                      and e.deleted_at is null
                      and e.id = ?
                  )
                  """,
                  Boolean.class,
                  sectorId.orElseThrow(),
                  tenantId.value(),
                  tenantId.value(),
                  tenantId.value(),
                  establishmentId);
            });
    return Boolean.TRUE.equals(allowed);
  }
}
