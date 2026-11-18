package com.mapit.reservations.infrastructure.reservation;

import java.time.Instant;
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
        select id, starts_at, ends_at, status, checked_in_at
        from reservation where tenant_id=? and establishment_id=?
        order by starts_at desc, id desc limit ? offset ?
        """, (row, index) -> new Item(row.getObject("id", UUID.class),
            row.getTimestamp("starts_at").toInstant(), row.getTimestamp("ends_at").toInstant(),
            row.getString("status"), row.getTimestamp("checked_in_at") != null),
        tenant.value(), establishmentId, limit, offset);
    return new Page(items, total, limit, offset);
  }

  public record Item(UUID id, Instant startsAt, Instant endsAt, String status, boolean checkedIn) {}
  public record Page(List<Item> items, long total, int limit, int offset) {}
}
