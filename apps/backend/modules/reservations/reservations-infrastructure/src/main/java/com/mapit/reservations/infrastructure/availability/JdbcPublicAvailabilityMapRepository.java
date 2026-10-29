package com.mapit.reservations.infrastructure.availability;

import java.sql.Timestamp;
import java.time.Clock;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.util.Optional;
import java.util.UUID;

import org.jspecify.annotations.Nullable;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import com.mapit.reservations.domain.availability.PublicAvailabilityMap;
import com.mapit.reservations.domain.availability.PublicAvailabilityMapRepository;
import com.mapit.reservations.domain.reservation.BookingWindow;
import com.mapit.reservations.domain.reservation.PublicReservationTimeRange;
import com.mapit.shared.spaces.SpaceDisplayName;
import com.mapit.shared.tenant.TenantId;
import com.mapit.shared.tenant.TenantScope;
import com.mapit.shared.vertical.Vertical;
import com.mapit.shared.vertical.VerticalCatalog;
import com.mapit.shared.vertical.VerticalGate;
import com.mapit.shared.vertical.VerticalProfileView;

@Repository
public class JdbcPublicAvailabilityMapRepository implements PublicAvailabilityMapRepository {
  private final JdbcTemplate jdbc;
  private final Clock clock;
  private final VerticalGate verticalGate;
  public JdbcPublicAvailabilityMapRepository(JdbcTemplate jdbc, Clock clock, VerticalGate verticalGate) {
    this.jdbc = jdbc; this.clock = clock; this.verticalGate = verticalGate;
  }

  @Override
  public Optional<PublicAvailabilityMap> find(String tenantSlug, String establishmentSlug, LocalDate date,
      @Nullable LocalTime start, @Nullable LocalDate endDate, @Nullable LocalTime end) {
    var tenants = jdbc.query("select id from tenant where slug=? and status='ACTIVE'", (r,n) -> r.getString(1), tenantSlug);
    if (tenants.isEmpty()) return Optional.empty();
    String tenant = tenants.getFirst();
    jdbc.queryForObject(TenantScope.SET_LOCAL_SQL, String.class, tenant);
    var venues = jdbc.query("select id,name,timezone,type from establishment where tenant_id=? and slug=? and deleted_at is null",
        (r,n) -> new Venue(r.getObject("id", UUID.class), r.getString("name"), r.getString("timezone"), r.getString("type")), tenant, establishmentSlug);
    if (venues.isEmpty()) return Optional.empty();
    var venue = venues.getFirst();
    ZoneId zone = ZoneId.of(venue.timezone());
    // HU-7.01/7.02: la vertical persistida decide ventana y reservables; Unleash solo si está habilitada.
    var profile = VerticalCatalog.of(venue.type());
    boolean enabled = verticalGate.isEnabled(Vertical.of(venue.type()), TenantId.of(tenant));
    var from = date.atStartOfDay(zone).toInstant();
    var to = date.plusDays(1).atStartOfDay(zone).toInstant();
    if (start != null && end != null) {
      var range = PublicReservationTimeRange.resolve(date, start, endDate, end, zone, profile.allowsOvernight());
      BookingWindow.of(profile).validate(range, zone);
      from = range.startsAt(); to = range.endsAt();
      if (!from.isAfter(clock.instant())) throw new IllegalArgumentException("El inicio debe ser futuro");
    }
    var startsAt = from; var endsAt = to;
    var floors = jdbc.query("select id,name,level,canvas_width,canvas_height from floor where tenant_id=? and establishment_id=? and deleted_at is null order by level,id",
        (f,n) -> {
          UUID floor = f.getObject("id", UUID.class);
          var sectors = jdbc.query("select id,name,width,height,x,y,rotation from sector where tenant_id=? and floor_id=? and deleted_at is null order by name,id",
              (s,m) -> {
                UUID sector = s.getObject("id", UUID.class);
                var elements = jdbc.query("""
                    select se.id,se.type,se.label,se.capacity,se.x,se.y,se.width,se.height,se.rotation,
                      case when se.state<>'AVAILABLE' then 'UNAVAILABLE'
                        when exists(select 1 from reservation_space_element rse join reservation r
                          on r.tenant_id=rse.tenant_id and r.id=rse.reservation_id
                          where rse.tenant_id=se.tenant_id and rse.space_element_id=se.id
                            and r.establishment_id=? and r.status in ('CREATED','CONFIRMED','ACTIVE')
                            and r.starts_at<? and ?<r.ends_at) then 'RESERVED' else 'AVAILABLE' end as availability
                    from space_element se where se.tenant_id=? and se.sector_id=? and se.deleted_at is null order by se.id
                    """, (e,k) -> {
                      String type = e.getString("type");
                      // Un tipo que la vertical no reserva (DECOR, STAGE, ajeno) nunca se ofrece.
                      String availability = enabled && profile.isReservable(type) ? e.getString("availability") : "UNAVAILABLE";
                      return new PublicAvailabilityMap.Element(e.getObject("id", UUID.class), e.getString("type"),
                          e.getString("label"), SpaceDisplayName.format(e.getString("type"), e.getString("label")),
                          e.getObject("capacity", Integer.class), e.getDouble("x"), e.getDouble("y"), e.getDouble("width"),
                          e.getDouble("height"), e.getDouble("rotation"), availability.equals("AVAILABLE"), availability);
                    }, venue.id(), Timestamp.from(endsAt), Timestamp.from(startsAt), tenant, sector);
                return new PublicAvailabilityMap.Sector(sector,s.getString("name"),s.getDouble("width"),s.getDouble("height"),
                    s.getDouble("x"),s.getDouble("y"),s.getDouble("rotation"),elements);
              }, tenant, floor);
          return new PublicAvailabilityMap.Floor(floor,f.getString("name"),f.getInt("level"),f.getDouble("canvas_width"),f.getDouble("canvas_height"),sectors);
        }, tenant, venue.id());
    // ponytail: 1+floors+sectors consultas; usar agregación SQL si el tamaño real del plano lo exige.
    return Optional.of(new PublicAvailabilityMap(venue.id(),venue.name(),tenantSlug,establishmentSlug,venue.timezone(),date,
        start == null ? null : start.toString(),start == null ? date : endsAt.atZone(zone).toLocalDate(),end == null ? null : end.toString(),
        startsAt,endsAt,start == null ? "DAY" : "INTERVAL",VerticalProfileView.of(profile, enabled),floors));
  }
  private record Venue(UUID id, String name, String timezone, String type) {}
}
