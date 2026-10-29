package com.mapit.reservations.infrastructure.booking;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import com.mapit.reservations.domain.booking.PublicEstablishment;
import com.mapit.reservations.domain.booking.PublicReservationRepository;
import com.mapit.shared.tenant.TenantId;
import com.mapit.shared.tenant.TenantScope;

/** Resuelve tenant activo y establecimiento vivo por slug, fijando RLS en la transacción. */
@Repository
public class JdbcPublicReservationRepository implements PublicReservationRepository {

  private final JdbcTemplate jdbc;

  public JdbcPublicReservationRepository(JdbcTemplate jdbc) {
    this.jdbc = jdbc;
  }

  @Override
  public Optional<PublicEstablishment> findActiveEstablishment(
      String tenantSlug, String establishmentSlug) {
    List<String> tenantIds =
        jdbc.query(
            "select id from tenant where slug = ? and status = 'ACTIVE'",
            (result, rowNumber) -> result.getString("id"),
            tenantSlug);
    if (tenantIds.isEmpty()) {
      return Optional.empty();
    }

    String tenantId = tenantIds.getFirst();
    setTenant(tenantId);
    return jdbc
        .query(
            """
            select id, timezone, type
            from establishment
            where tenant_id = ? and slug = ? and deleted_at is null
            """,
            (result, rowNumber) ->
                new PublicEstablishment(
                    TenantId.of(tenantId),
                    result.getObject("id", UUID.class),
                    result.getString("timezone"),
                    result.getString("type")),
            tenantId,
            establishmentSlug)
        .stream()
        .findFirst();
  }

  private void setTenant(String tenantId) {
    jdbc.queryForObject(TenantScope.SET_LOCAL_SQL, String.class, tenantId);
  }
}
