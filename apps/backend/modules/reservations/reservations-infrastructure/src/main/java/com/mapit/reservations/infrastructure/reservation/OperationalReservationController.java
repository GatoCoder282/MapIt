package com.mapit.reservations.infrastructure.reservation;

import java.sql.SQLException;
import java.time.Instant;
import java.util.Arrays;
import java.util.List;
import java.util.UUID;

import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import com.mapit.shared.security.ActorContext;
import com.mapit.shared.security.EstablishmentAuthorizationPort;
import com.mapit.shared.tenant.TenantContext;
import com.mapit.shared.tenant.TenantScope;

/** Lectura mínima para recepción, limitada por el establecimiento autorizado y por RLS. */
@RestController
@RequestMapping("/api/v1/establishments/{establishmentId}/reservations")
public class OperationalReservationController {
  private final JdbcTemplate jdbc;
  private final TenantContext tenants;
  private final ActorContext actors;
  private final EstablishmentAuthorizationPort access;

  public OperationalReservationController(JdbcTemplate jdbc, TenantContext tenants,
      ActorContext actors, EstablishmentAuthorizationPort access) {
    this.jdbc = jdbc; this.tenants = tenants; this.actors = actors; this.access = access;
  }

  @GetMapping
  @Transactional(readOnly = true)
  public Page list(@PathVariable UUID establishmentId,
      @RequestParam(defaultValue = "20") int limit, @RequestParam(defaultValue = "0") int offset) {
    if (limit < 1 || limit > 100 || offset < 0 || offset > 100000) {
      throw new IllegalArgumentException("Paginación inválida");
    }
    var tenant = tenants.require();
    if (!access.canReadOperations(tenant, actors.requireUserId(), establishmentId)) {
      throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Establecimiento no autorizado");
    }
    jdbc.queryForObject(TenantScope.SET_LOCAL_SQL, String.class, tenant.value());
    long total = jdbc.queryForObject("select count(*) from reservation where tenant_id=? and establishment_id=?",
        Long.class, tenant.value(), establishmentId);
    List<Item> items = jdbc.query("""
        select r.id, r.starts_at, r.ends_at, r.status, r.checked_in_at,
          coalesce(s.ids, '{}'::uuid[]) as space_ids
        from reservation r
        left join lateral (
          select array_agg(rse.space_element_id order by rse.space_element_id) as ids
          from reservation_space_element rse
          where rse.tenant_id=r.tenant_id and rse.reservation_id=r.id
        ) s on true
        where r.tenant_id=? and r.establishment_id=?
        order by r.starts_at desc, r.id desc limit ? offset ?
        """, (row, index) -> new Item(row.getObject("id", UUID.class),
            row.getTimestamp("starts_at").toInstant(), row.getTimestamp("ends_at").toInstant(),
            row.getString("status"), row.getTimestamp("checked_in_at") != null, spaces(row)),
        tenant.value(), establishmentId, limit, offset);
    return new Page(items, total, limit, offset);
  }

  private static List<UUID> spaces(java.sql.ResultSet row) throws SQLException {
    return Arrays.stream((Object[]) row.getArray("space_ids").getArray()).map(UUID.class::cast).toList();
  }

  public record Item(UUID id, Instant startsAt, Instant endsAt, String status, boolean checkedIn,
      List<UUID> spaceElementIds) {}
  public record Page(List<Item> items, long total, int limit, int offset) {}
}
