package com.mapit.reservations.infrastructure.availability;

import java.sql.Timestamp;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import com.mapit.reservations.domain.availability.PublicAvailability;
import com.mapit.reservations.domain.availability.PublicAvailabilityElement;
import com.mapit.reservations.domain.availability.PublicAvailabilityRepository;
import com.mapit.reservations.domain.reservation.ReservationResource;
import com.mapit.shared.tenant.TenantScope;

/** Consulta disponibilidad con proyecciones propias del contexto reservations y RLS explícita. */
@Repository
public class JdbcPublicAvailabilityRepository implements PublicAvailabilityRepository {

  private final JdbcTemplate jdbc;

  public JdbcPublicAvailabilityRepository(JdbcTemplate jdbc) {
    this.jdbc = jdbc;
  }

  @Override
  public Optional<PublicAvailability> findBySlugsAndDate(
      String tenantSlug, String establishmentSlug, LocalDate date) {
    Optional<String> tenantId = findActiveTenantId(tenantSlug);
    if (tenantId.isEmpty()) {
      return Optional.empty();
    }

    setTenant(tenantId.orElseThrow());
    List<PublicEstablishment> establishments =
        jdbc.query(
            """
            select id, timezone
            from establishment
            where tenant_id = ? and slug = ? and deleted_at is null
            """,
            (result, rowNumber) ->
                new PublicEstablishment(
                    result.getObject("id", UUID.class), result.getString("timezone")),
            tenantId.orElseThrow(),
            establishmentSlug);
    if (establishments.isEmpty()) {
      return Optional.empty();
    }

    PublicEstablishment establishment = establishments.getFirst();
    ZoneId zone = ZoneId.of(establishment.timezone());
    Instant startsAt = date.atStartOfDay(zone).toInstant();
    Instant endsAt = date.plusDays(1).atStartOfDay(zone).toInstant();
    List<PublicAvailabilityElement> elements =
        jdbc.query(
            """
            select se.id, se.type
            from space_element se
            join sector s
              on s.id = se.sector_id and s.tenant_id = se.tenant_id and s.deleted_at is null
            join floor f
              on f.id = s.floor_id and f.tenant_id = s.tenant_id and f.deleted_at is null
            join establishment e
              on e.id = f.establishment_id and e.tenant_id = f.tenant_id and e.deleted_at is null
            where se.tenant_id = ?
              and e.id = ?
              and e.slug = ?
              and se.deleted_at is null
              and se.type <> 'DECOR'
              and se.state = 'AVAILABLE'
              and not exists (
                select 1
                from reservation_space_element rse
                join reservation r
                  on r.id = rse.reservation_id and r.tenant_id = rse.tenant_id
                where r.tenant_id = se.tenant_id
                  and rse.space_element_id = se.id
                  and r.status in ('CREATED', 'CONFIRMED', 'ACTIVE')
                  and r.starts_at < ?
                  and ? < r.ends_at
              )
            order by se.type, se.id
            """,
            (result, rowNumber) ->
                new PublicAvailabilityElement(
                    result.getObject("id", UUID.class),
                    ReservationResource.Kind.valueOf(result.getString("type"))),
            tenantId.orElseThrow(),
            establishment.id(),
            establishmentSlug,
            Timestamp.from(endsAt),
            Timestamp.from(startsAt));

    return Optional.of(new PublicAvailability(establishment.id(), date, elements));
  }

  private Optional<String> findActiveTenantId(String tenantSlug) {
    List<String> tenantIds =
        jdbc.query(
            "select id from tenant where slug = ? and status = 'ACTIVE'",
            (result, rowNumber) -> result.getString("id"),
            tenantSlug);
    return tenantIds.stream().findFirst();
  }

  private void setTenant(String tenantId) {
    jdbc.queryForObject(TenantScope.SET_LOCAL_SQL, String.class, tenantId);
  }

  private record PublicEstablishment(UUID id, String timezone) {}
}
