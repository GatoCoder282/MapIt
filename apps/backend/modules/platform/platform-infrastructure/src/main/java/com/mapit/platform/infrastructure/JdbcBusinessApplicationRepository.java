package com.mapit.platform.infrastructure;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.UUID;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import com.mapit.platform.domain.BusinessApplication;
import com.mapit.platform.domain.BusinessApplicationRepository;

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
}
