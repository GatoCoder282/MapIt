package com.mapit.reservations.infrastructure.booking;

import java.sql.Array;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

import org.jspecify.annotations.Nullable;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import com.mapit.reservations.domain.booking.ReservationAccessRepository;
import com.mapit.reservations.domain.booking.ReservationAccessView;
import com.mapit.reservations.domain.person.PersonId;
import com.mapit.reservations.domain.reservation.Reservation;
import com.mapit.reservations.domain.reservation.ReservationId;
import com.mapit.reservations.domain.reservation.ReservationStatus;
import com.mapit.reservations.domain.reservation.ReservationTimeRange;
import com.mapit.shared.tenant.TenantId;
import com.mapit.shared.tenant.TenantScope;

/** Proyecciones y transiciones de reservas con filtros explícitos y RLS transaccional. */
@Repository
public class JdbcReservationAccessRepository implements ReservationAccessRepository {
  private final JdbcTemplate jdbc;

  public JdbcReservationAccessRepository(JdbcTemplate jdbc) { this.jdbc = jdbc; }

  @Override
  public void insertAccess(Reservation reservation, String tokenHash, Instant createdAt, Instant expiresAt) {
    scope(reservation.tenantId());
    jdbc.update("""
        insert into reservation_access(id,tenant_id,establishment_id,reservation_id,token_hash,created_at,expires_at)
        values(?,?,?,?,?,?,?)
        """, UUID.randomUUID(), reservation.tenantId().value(), reservation.establishmentId(),
        reservation.id().value(), tokenHash, Timestamp.from(createdAt), Timestamp.from(expiresAt));
  }

  @Override
  public boolean accepts(TenantId tenantId, UUID establishmentId, UUID reservationId, String tokenHash, Instant now) {
    scope(tenantId);
    Boolean accepted = jdbc.queryForObject("""
        select exists (
          select 1 from reservation_access ra
          join reservation r on r.tenant_id=ra.tenant_id and r.id=ra.reservation_id
            and r.establishment_id=ra.establishment_id
          where ra.tenant_id=? and ra.establishment_id=? and ra.reservation_id=?
            and ra.token_hash=? and ra.revoked_at is null and ra.created_at<=? and ra.expires_at>?
        )
        """, Boolean.class, tenantId.value(), establishmentId, reservationId, tokenHash,
        Timestamp.from(now), Timestamp.from(now));
    return Boolean.TRUE.equals(accepted);
  }

  @Override
  public Optional<ReservationAccessView> read(TenantId tenantId, UUID reservationId) {
    scope(tenantId);
    List<ReservationAccessView> rows = jdbc.query("""
        select r.id,r.establishment_id,e.name as establishment_name,t.slug as tenant_slug,
               e.slug as establishment_slug,r.starts_at,r.ends_at,e.timezone,r.status,
               r.confirmed_payment_id,r.checked_in_at,r.checked_in_by
        from reservation r
        join establishment e on e.tenant_id=r.tenant_id and e.id=r.establishment_id and e.deleted_at is null
        join tenant t on t.id=r.tenant_id and t.status='ACTIVE'
        where r.tenant_id=? and r.id=?
        """, (rs, row) -> new ReservationAccessView(tenantId, rs.getObject("id", UUID.class),
        rs.getObject("establishment_id", UUID.class), rs.getString("establishment_name"),
        rs.getString("tenant_slug"), rs.getString("establishment_slug"),
        rs.getTimestamp("starts_at").toInstant(), rs.getTimestamp("ends_at").toInstant(),
        rs.getString("timezone"), ReservationStatus.valueOf(rs.getString("status")), List.of(),
        rs.getObject("confirmed_payment_id", UUID.class), instant(rs, "checked_in_at"),
        rs.getObject("checked_in_by", UUID.class)), tenantId.value(), reservationId);
    if (rows.isEmpty()) return Optional.empty();
    ReservationAccessView row = rows.getFirst();
    return Optional.of(new ReservationAccessView(row.tenantId(), row.id(), row.establishmentId(),
        row.establishmentName(), row.tenantSlug(), row.establishmentSlug(), row.startsAt(), row.endsAt(),
        row.timezone(), row.status(), spaces(tenantId, reservationId), row.confirmedPaymentId(),
        row.checkedInAt(), row.checkedInBy()));
  }

  private List<ReservationAccessView.Space> spaces(TenantId tenantId, UUID reservationId) {
    return jdbc.query("""
        select se.id,se.type,se.label,se.capacity,se.x,se.y,f.name as floor,s.name as sector,se.sector_id,se.state
        from reservation_space_element rse
        join space_element se on se.tenant_id=rse.tenant_id and se.id=rse.space_element_id
        join sector s on s.tenant_id=se.tenant_id and s.id=se.sector_id
        join floor f on f.tenant_id=s.tenant_id and f.id=s.floor_id
        join reservation r on r.tenant_id=rse.tenant_id and r.id=rse.reservation_id and r.establishment_id=f.establishment_id
        where rse.tenant_id=? and rse.reservation_id=? order by f.level,s.name,se.id
        """, (rs, row) -> new ReservationAccessView.Space(rs.getObject("id", UUID.class),
        com.mapit.shared.spaces.SpaceDisplayName.format(rs.getString("type"), rs.getString("label")), rs.getString("floor"), rs.getString("sector"),
        rs.getObject("sector_id", UUID.class), rs.getString("state"), rs.getString("type"), rs.getString("label"),
        rs.getObject("capacity", Integer.class), rs.getDouble("x"), rs.getDouble("y")), tenantId.value(), reservationId);
  }

  @Override
  public Optional<Reservation> lock(TenantId tenantId, UUID reservationId) {
    scope(tenantId);
    return jdbc.query("""
        select r.*,coalesce(elements.ids,'{}') as element_ids
        from reservation r
        left join lateral (
          select array_agg(rse.space_element_id order by rse.space_element_id) as ids
          from reservation_space_element rse where rse.tenant_id=r.tenant_id and rse.reservation_id=r.id
        ) elements on true
        where r.tenant_id=? and r.id=? for update of r
        """, (rs, row) -> new Reservation(ReservationId.of(rs.getObject("id", UUID.class)), tenantId,
        rs.getObject("establishment_id", UUID.class), PersonId.of(rs.getObject("person_id", UUID.class)),
        elementIds(rs), ReservationTimeRange.of(rs.getTimestamp("starts_at").toInstant(), rs.getTimestamp("ends_at").toInstant()),
        ReservationStatus.valueOf(rs.getString("status")), rs.getTimestamp("created_at").toInstant(),
        rs.getObject("created_by", UUID.class)), tenantId.value(), reservationId).stream().findFirst();
  }

  @Override
  public boolean hasOtherConflicts(Reservation reservation) {
    scope(reservation.tenantId());
    Boolean conflicts = jdbc.queryForObject("""
        select exists (
          select 1 from reservation_space_element mine
          join reservation_space_element other on other.tenant_id=mine.tenant_id
            and other.space_element_id=mine.space_element_id and other.reservation_id<>mine.reservation_id
          join reservation r on r.tenant_id=other.tenant_id and r.id=other.reservation_id
          where mine.tenant_id=? and mine.reservation_id=? and r.status in ('CREATED','CONFIRMED','ACTIVE')
            and r.starts_at<? and ?<r.ends_at
        )
        """, Boolean.class, reservation.tenantId().value(), reservation.id().value(),
        Timestamp.from(reservation.timeRange().endsAt()), Timestamp.from(reservation.timeRange().startsAt()));
    return Boolean.TRUE.equals(conflicts);
  }

  @Override
  public void transition(TenantId tenantId, UUID reservationId, ReservationStatus previous,
      ReservationStatus next, @Nullable UUID paymentId, @Nullable UUID actorId, Instant now) {
    scope(tenantId);
    int updated = jdbc.update("""
        update reservation set status=?,updated_at=?,updated_by=?,
          confirmed_payment_id=coalesce(?,confirmed_payment_id),
          checked_in_at=case when ?='ACTIVE' then ? else checked_in_at end,
          checked_in_by=case when ?='ACTIVE' then ? else checked_in_by end
        where tenant_id=? and id=? and status=?
        """, next.name(), Timestamp.from(now), actorId, paymentId, next.name(), Timestamp.from(now),
        next.name(), actorId, tenantId.value(), reservationId, previous.name());
    if (updated != 1) throw new IllegalStateException("La reserva cambió durante la transición bloqueada");
    jdbc.update("""
        insert into reservation_event(id,tenant_id,establishment_id,reservation_id,event_type,
          previous_state,new_state,actor_id,payment_id,source,occurred_at)
        select ?,tenant_id,establishment_id,id,?,?,?,?,?,?,? from reservation where tenant_id=? and id=?
        """, UUID.randomUUID(), next == ReservationStatus.ACTIVE ? "CHECKED_IN" : "CONFIRMED",
        previous.name(), next.name(), actorId, paymentId, actorId == null ? "PAYMENT" : "STAFF",
        Timestamp.from(now), tenantId.value(), reservationId);
  }

  @Override
  public List<PublicVenue> catalogue(@Nullable String query) {
    return catalogue(query,null,20,0);
  }
  @Override
  public List<PublicVenue> catalogue(@Nullable String query,@Nullable String tenantSlug,int limit,int offset) {
    List<TenantId> tenants = jdbc.query("select id from tenant where status='ACTIVE' and (?::text is null or slug=?) order by slug",
        (rs, row) -> TenantId.of(rs.getString("id")),tenantSlug,tenantSlug);
    List<PublicVenue> venues = new ArrayList<>();
    for (TenantId tenant : tenants) {
      if (venues.size() == limit+offset) break;
      scope(tenant);
      String search = query == null ? "" : query.toLowerCase(Locale.ROOT);
      venues.addAll(jdbc.query("""
          select e.id,e.name,e.type,e.address,t.name as tenant_name,t.slug as tenant_slug,e.slug as establishment_slug,e.timezone
          from establishment e join tenant t on t.id=e.tenant_id and t.status='ACTIVE'
          where e.tenant_id=? and e.deleted_at is null
            and position(? in lower(e.name || ' ' || coalesce(e.address,'')))>0
          order by e.name,e.id limit ?
          """, (rs, row) -> new PublicVenue(rs.getObject("id", UUID.class), rs.getString("name"),
          rs.getString("type"), rs.getString("address"), rs.getString("tenant_slug"),
          rs.getString("establishment_slug"), rs.getString("timezone"),rs.getString("tenant_name")), tenant.value(), search, limit+offset-venues.size()));
    }
    return List.copyOf(venues.subList(Math.min(offset,venues.size()),venues.size()));
  }
  @Override
  public Optional<PublicVenue> publicVenue(TenantId tenant,UUID establishmentId){
    scope(tenant);
    return jdbc.query("""
        select e.id,e.name,e.type,e.address,t.name as tenant_name,t.slug as tenant_slug,e.slug as establishment_slug,e.timezone
        from establishment e join tenant t on t.id=e.tenant_id and t.status='ACTIVE'
        where e.tenant_id=? and e.id=? and e.deleted_at is null
        """,(rs,row)->new PublicVenue(rs.getObject("id",UUID.class),rs.getString("name"),rs.getString("type"),rs.getString("address"),rs.getString("tenant_slug"),rs.getString("establishment_slug"),rs.getString("timezone"),rs.getString("tenant_name")),tenant.value(),establishmentId).stream().findFirst();
  }

  private static Set<UUID> elementIds(ResultSet rs) throws SQLException {
    Array column = rs.getArray("element_ids");
    if (column == null) return Set.of();
    try {
      Set<UUID> ids = new LinkedHashSet<>();
      for (Object id : (Object[]) column.getArray()) ids.add((UUID) id);
      return ids;
    } finally { column.free(); }
  }

  private static @Nullable Instant instant(ResultSet rs, String column) throws SQLException {
    Timestamp value = rs.getTimestamp(column);
    return value == null ? null : value.toInstant();
  }

  private void scope(TenantId tenant) {
    jdbc.queryForObject(TenantScope.SET_LOCAL_SQL, String.class, tenant.value());
  }
}
