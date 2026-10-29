package com.mapit.spaces.infrastructure.realtime;

import java.util.Optional;
import java.util.Set;
import java.util.UUID;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionTemplate;

import com.mapit.shared.realtime.RealtimeRoomAccessPort;
import com.mapit.shared.security.EstablishmentAuthorizationPort;
import com.mapit.shared.tenant.TenantId;
import com.mapit.shared.tenant.TenantScope;

/**
 * Verifica la pertenencia de una sala contra el modelo espacial y su RLS.
 *
 * <p>Regla de acceso: cualquier rol con acceso a la sala de <b>su propio tenant</b> —
 * {@code ADMIN}, {@code MANAGER}, {@code STAFF} con concesión explícita y también {@code SUPER_ADMIN}, que ya lee
 * los mismos datos por HTTP (si los dos caminos no coincidieran, el dashboard en vivo no
 * podría existir para el rol de plataforma). El aislamiento por tenant no se toca: el
 * usuario debe estar activo en el tenant del JWT y el establecimiento o sector debe
 * pertenecer a ese mismo tenant.
 */
@Component
public final class JdbcRealtimeRoomAccessAdapter implements RealtimeRoomAccessPort {

  private static final Set<String> ROLES_CON_ACCESO_A_SALAS =
      Set.of("ADMIN", "MANAGER", "STAFF", "SUPER_ADMIN");

  private final JdbcTemplate jdbc;
  private final TransactionTemplate transactions;
  private final EstablishmentAuthorizationPort authorization;

  public JdbcRealtimeRoomAccessAdapter(JdbcTemplate jdbc, TransactionTemplate transactions, EstablishmentAuthorizationPort authorization) {
    this.jdbc = jdbc;
    this.transactions = transactions;
    this.authorization = authorization;
  }

  @Override
  public boolean canSubscribe(
      TenantId tenantId,
      UUID userId,
      String role,
      UUID establishmentId,
      Optional<UUID> sectorId) {
    if (!ROLES_CON_ACCESO_A_SALAS.contains(role)) return false;
    if (!role.equals("SUPER_ADMIN") && !authorization.canReadOperations(tenantId,userId,establishmentId)) return false;
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
