package com.mapit.payments.infrastructure;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import com.mapit.payments.domain.MerchantPaymentMethod;
import com.mapit.payments.domain.PaymentMethodRepository;
import com.mapit.payments.domain.PaymentProvider;
import com.mapit.shared.tenant.TenantId;
import com.mapit.shared.tenant.TenantScope;

@Repository
public class JdbcPaymentMethodRepository implements PaymentMethodRepository {
  private final JdbcTemplate jdbc;
  public JdbcPaymentMethodRepository(JdbcTemplate jdbc) { this.jdbc = jdbc; }

  @Override
  public List<MerchantPaymentMethod> list(TenantId tenant) {
    scope(tenant);
    return jdbc.query("select * from merchant_payment_method where tenant_id = ? order by created_at, id",
        JdbcPaymentMethodRepository::map, tenant.value());
  }

  @Override
  public Optional<MerchantPaymentMethod> find(TenantId tenant, UUID id) {
    scope(tenant);
    return jdbc.query("select * from merchant_payment_method where tenant_id = ? and id = ?",
        JdbcPaymentMethodRepository::map, tenant.value(), id).stream().findFirst();
  }

  @Override
  public Optional<MerchantPaymentMethod> projection(TenantId tenant, UUID configurationId) {
    scope(tenant);
    return jdbc.query("select * from merchant_payment_method where tenant_id=? and mock_qr_configuration_id=? and superseded_at is null",
        JdbcPaymentMethodRepository::map, tenant.value(), configurationId).stream().findFirst();
  }

  @Override
  public Optional<MerchantPaymentMethod> lock(TenantId tenant, UUID id) {
    scope(tenant);
    return jdbc.query("select * from merchant_payment_method where tenant_id=? and id=? for update",
        JdbcPaymentMethodRepository::map, tenant.value(), id).stream().findFirst();
  }

  @Override
  public boolean hasPayments(TenantId tenant, UUID id) {
    scope(tenant);
    Boolean used = jdbc.queryForObject("select exists(select 1 from payment where tenant_id=? and method_id=?)",
        Boolean.class, tenant.value(), id);
    return Boolean.TRUE.equals(used);
  }

  @Override
  public void supersede(TenantId tenant, UUID id, java.time.Instant at, UUID actorId) {
    scope(tenant);
    if (jdbc.update("update merchant_payment_method set superseded_at=?,updated_at=?,updated_by=? where tenant_id=? and id=? and mock_qr_configuration_id is not null and superseded_at is null",
        Timestamp.from(at), Timestamp.from(at), actorId, tenant.value(), id) != 1) {
      throw new IllegalStateException("La proyección MOCK dejó de ser vigente");
    }
  }

  @Override
  public boolean establishmentExists(TenantId tenant, UUID establishmentId) {
    scope(tenant);
    Integer count = jdbc.queryForObject("select count(*) from establishment where tenant_id = ? and id = ? and deleted_at is null",
        Integer.class, tenant.value(), establishmentId);
    return count != null && count == 1;
  }

  @Override
  public MerchantPaymentMethod insert(MerchantPaymentMethod m) {
    scope(m.tenantId());
    jdbc.update("""
        insert into merchant_payment_method(id,tenant_id,establishment_id,display_name,country,currency,
          provider,bank_name,account_reference,static_qr_image,enabled,created_at,updated_at,created_by,updated_by,
          account_holder_name,mock_qr_configuration_id,superseded_at)
        values(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        """, m.id(), m.tenantId().value(), m.establishmentId(), m.displayName(), m.country(), m.currency(),
        m.provider().name(), m.bankName(), m.accountReference(), m.staticQrImage(), m.enabled(),
        Timestamp.from(m.createdAt()), Timestamp.from(m.updatedAt()), m.createdBy(), m.updatedBy(), m.accountHolderName(),
        m.mockQrConfigurationId(), m.supersededAt() == null ? null : Timestamp.from(m.supersededAt()));
    return m;
  }

  @Override
  public boolean update(MerchantPaymentMethod m) {
    scope(m.tenantId());
    return jdbc.update("""
        update merchant_payment_method set establishment_id=?,display_name=?,country=?,currency=?,provider=?,
          bank_name=?,account_reference=?,static_qr_image=?,enabled=?,updated_at=?,updated_by=?,account_holder_name=?
        where tenant_id=? and id=?
        """, m.establishmentId(), m.displayName(), m.country(), m.currency(), m.provider().name(),
        m.bankName(), m.accountReference(), m.staticQrImage(), m.enabled(), Timestamp.from(m.updatedAt()),
        m.updatedBy(), m.accountHolderName(), m.tenantId().value(), m.id()) == 1;
  }

  private void scope(TenantId tenant) { jdbc.queryForObject(TenantScope.SET_LOCAL_SQL, String.class, tenant.value()); }

  private static MerchantPaymentMethod map(ResultSet r, int row) throws SQLException {
    return new MerchantPaymentMethod(r.getObject("id", UUID.class), TenantId.of(r.getString("tenant_id")),
        r.getObject("establishment_id", UUID.class), r.getString("display_name"), r.getString("country"),
        r.getString("currency"), PaymentProvider.valueOf(r.getString("provider")), r.getString("bank_name"),
        r.getString("account_reference"), r.getString("static_qr_image"), r.getBoolean("enabled"),
        r.getTimestamp("created_at").toInstant(), r.getTimestamp("updated_at").toInstant(),
        r.getObject("created_by", UUID.class), r.getObject("updated_by", UUID.class), r.getString("account_holder_name"),
        r.getObject("mock_qr_configuration_id", UUID.class),
        r.getTimestamp("superseded_at") == null ? null : r.getTimestamp("superseded_at").toInstant());
  }
}
