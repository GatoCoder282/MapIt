package com.mapit.platform.infrastructure;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.jspecify.annotations.Nullable;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import com.mapit.platform.domain.BusinessApplication;
import com.mapit.platform.domain.BusinessApplicationPage;
import com.mapit.platform.domain.BusinessApplicationRepository;
import com.mapit.platform.domain.BusinessApplicationStatus;
import com.mapit.platform.domain.BusinessVertical;
import com.mapit.shared.tenant.TenantId;

/** Escrituras acotadas a platform; la transacción ya tiene RLS activada. */
@Repository
class JdbcBusinessApplicationRepository implements BusinessApplicationRepository {

  private static final String SAVE_PENDING = """
      insert into business_application
        (id, tenant_id, business_name, vertical, location, contact_name, contact_email,
         contact_phone, verification_token_hash, verification_expires_at, created_at, updated_at)
      values (?, 'platform', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      on conflict (tenant_id, lower(contact_email), lower(btrim(business_name)))
        where status = 'PENDING'
      do update set
        verification_token_hash = excluded.verification_token_hash,
        verification_expires_at = excluded.verification_expires_at
      where business_application.contact_verified_at is null
      returning id
      """;

  private final JdbcTemplate jdbc;

  JdbcBusinessApplicationRepository(JdbcTemplate jdbc) {
    this.jdbc = jdbc;
  }

  @Override
  public boolean savePending(BusinessApplication application, String tokenHash, Instant expiresAt) {
    return !jdbc.query(
        SAVE_PENDING,
        (rs, row) -> rs.getObject("id", UUID.class),
        application.id(), application.businessName(), application.vertical().name(),
        application.location(), application.contactName(), application.contactEmail(),
        application.contactPhone(), tokenHash, Timestamp.from(expiresAt),
        Timestamp.from(application.createdAt()), Timestamp.from(application.updatedAt()))
        .isEmpty();
  }

  @Override
  public boolean verifyContact(String tokenHash, Instant now) {
    return jdbc.update(
        """
        update business_application
        set contact_verified_at = ?, verification_token_hash = null,
            verification_expires_at = null
        where tenant_id = 'platform' and status = 'PENDING'
          and verification_token_hash = ? and verification_expires_at > ?
        """,
        Timestamp.from(now), tokenHash, Timestamp.from(now)) == 1;
  }

  @Override
  public BusinessApplicationPage search(@Nullable String search, @Nullable BusinessApplicationStatus status, int page, int size) {
    String term = search == null ? "" : search.strip();
    String statusName = status == null ? "" : status.name();
    String filter = """
        tenant_id = 'platform'
        and (? = '' or status = ?)
        and (? = '' or position(lower(?) in lower(business_name)) > 0
          or position(lower(?) in lower(contact_email)) > 0)
        """;
    Long total = jdbc.queryForObject("select count(*) from business_application where " + filter,
        Long.class, statusName, statusName, term, term, term);
    List<BusinessApplication> content = jdbc.query(
        "select * from business_application where " + filter + " order by created_at desc, id desc limit ? offset ?",
        (rs, row) -> map(rs), statusName, statusName, term, term, term, size, (long) page * size);
    long count = total == null ? 0 : total;
    return new BusinessApplicationPage(content, page, size, count, (int) ((count + size - 1) / size));
  }

  @Override
  public Optional<BusinessApplication> findById(UUID id) {
    return jdbc.query("select * from business_application where tenant_id = 'platform' and id = ?",
        (rs, row) -> map(rs), id).stream().findFirst();
  }

  private BusinessApplication map(ResultSet rs) throws SQLException {
    Timestamp verified = rs.getTimestamp("contact_verified_at");
    Timestamp decided = rs.getTimestamp("decided_at");
    String approvedTenant = rs.getString("approved_tenant_id");
    return new BusinessApplication(
        rs.getObject("id", UUID.class), TenantId.of(rs.getString("tenant_id")),
        rs.getString("business_name"), BusinessVertical.valueOf(rs.getString("vertical")),
        rs.getString("location"), rs.getString("contact_name"), rs.getString("contact_email"),
        rs.getString("contact_phone"), BusinessApplicationStatus.valueOf(rs.getString("status")),
        verified == null ? null : verified.toInstant(), rs.getObject("decided_by", UUID.class),
        decided == null ? null : decided.toInstant(), rs.getString("rejection_reason"),
        approvedTenant == null ? null : TenantId.of(approvedTenant),
        rs.getTimestamp("created_at").toInstant(), rs.getTimestamp("updated_at").toInstant());
  }
}
