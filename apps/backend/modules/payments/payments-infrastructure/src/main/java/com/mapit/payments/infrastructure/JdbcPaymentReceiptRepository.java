package com.mapit.payments.infrastructure;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.util.Optional;
import java.util.UUID;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import com.mapit.payments.domain.PaymentReceiptRepository;
import com.mapit.shared.tenant.TenantId;
import com.mapit.shared.tenant.TenantScope;

@Repository
public class JdbcPaymentReceiptRepository implements PaymentReceiptRepository {
  private final JdbcTemplate jdbc;
  public JdbcPaymentReceiptRepository(JdbcTemplate jdbc) { this.jdbc = jdbc; }

  @Override
  public void insert(StoredReceipt r) {
    scope(r.tenantId());
    jdbc.update("""
        insert into payment_receipt(id,tenant_id,establishment_id,reservation_id,payment_id,token_hash,
          created_at,expires_at,revoked_at) values(?,?,?,?,?,?,?,?,?)
        """, r.id(), r.tenantId().value(), r.establishmentId(), r.reservationId(), r.paymentId(),
        r.tokenHash(), Timestamp.from(r.createdAt()), Timestamp.from(r.expiresAt()),
        r.revokedAt() == null ? null : Timestamp.from(r.revokedAt()));
  }

  @Override
  public Optional<StoredReceipt> find(TenantId tenant, UUID establishmentId, String hash) {
    scope(tenant);
    return jdbc.query("select * from payment_receipt where tenant_id=? and establishment_id=? and token_hash=?",
        JdbcPaymentReceiptRepository::map, tenant.value(), establishmentId, hash).stream().findFirst();
  }

  @Override
  public Optional<StoredReceipt> findByHash(TenantId tenant, String hash) {
    scope(tenant);
    return jdbc.query("select * from payment_receipt where tenant_id=? and token_hash=?",
        JdbcPaymentReceiptRepository::map, tenant.value(), hash).stream().findFirst();
  }

  private void scope(TenantId tenant) { jdbc.queryForObject(TenantScope.SET_LOCAL_SQL, String.class, tenant.value()); }
  private static StoredReceipt map(ResultSet r, int row) throws SQLException {
    Timestamp revoked = r.getTimestamp("revoked_at");
    return new StoredReceipt(r.getObject("id", UUID.class), TenantId.of(r.getString("tenant_id")),
        r.getObject("establishment_id", UUID.class), r.getObject("reservation_id", UUID.class),
        r.getObject("payment_id", UUID.class), r.getString("token_hash"), r.getTimestamp("created_at").toInstant(),
        r.getTimestamp("expires_at").toInstant(), revoked == null ? null : revoked.toInstant());
  }
}
