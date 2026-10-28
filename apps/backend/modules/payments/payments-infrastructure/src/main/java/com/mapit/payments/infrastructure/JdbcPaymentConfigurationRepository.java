package com.mapit.payments.infrastructure;

import java.math.BigDecimal;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.util.Optional;
import java.util.UUID;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import com.mapit.payments.domain.Money;
import com.mapit.payments.domain.PaymentConfigurationRepository;
import com.mapit.payments.domain.PaymentPolicy;
import com.mapit.payments.domain.ReservationPaymentQuote;
import com.mapit.shared.tenant.TenantId;
import com.mapit.shared.tenant.TenantScope;

@Repository
public class JdbcPaymentConfigurationRepository implements PaymentConfigurationRepository {
  private final JdbcTemplate jdbc;
  public JdbcPaymentConfigurationRepository(JdbcTemplate jdbc) { this.jdbc = jdbc; }

  @Override
  public boolean lockEstablishment(TenantId tenant, UUID establishmentId) {
    scope(tenant);
    return !jdbc.query("select id from establishment where tenant_id=? and id=? and deleted_at is null for no key update",
        (r, row) -> r.getObject("id", UUID.class), tenant.value(), establishmentId).isEmpty();
  }

  @Override
  public Optional<PaymentPolicy> policy(TenantId tenant, UUID establishmentId) {
    scope(tenant);
    return jdbc.query("select * from payment_policy where tenant_id=? and establishment_id=?",
        JdbcPaymentConfigurationRepository::mapPolicy, tenant.value(), establishmentId).stream().findFirst();
  }

  @Override
  public PaymentPolicy savePolicy(PaymentPolicy policy) {
    scope(policy.tenantId());
    jdbc.update("""
        insert into payment_policy(id,tenant_id,establishment_id,enabled,currency,deposit_amount,total_amount,
          payment_window_minutes,updated_at,updated_by)
        values(?,?,?,?,?,?,?,?,?,?)
        on conflict(tenant_id,establishment_id) do update set
          enabled=excluded.enabled,currency=excluded.currency,deposit_amount=excluded.deposit_amount,
          total_amount=excluded.total_amount,payment_window_minutes=excluded.payment_window_minutes,
          updated_at=excluded.updated_at,updated_by=excluded.updated_by
        """, policy.id(), policy.tenantId().value(), policy.establishmentId(), policy.enabled(),
        policy.deposit().currency(), policy.deposit().amount(),
        policy.total() == null ? null : policy.total().amount(), policy.paymentWindowMinutes(),
        Timestamp.from(policy.updatedAt()), policy.updatedBy());
    return policy(policy.tenantId(), policy.establishmentId()).orElseThrow();
  }

  @Override
  public Optional<ReservationPaymentQuote> quote(TenantId tenant, UUID reservationId) {
    scope(tenant);
    return jdbc.query("select * from reservation_payment_quote where tenant_id=? and reservation_id=?",
        JdbcPaymentConfigurationRepository::mapQuote, tenant.value(), reservationId).stream().findFirst();
  }

  @Override
  public ReservationPaymentQuote insertQuote(ReservationPaymentQuote quote) {
    scope(quote.tenantId());
    jdbc.update("""
        insert into reservation_payment_quote(id,tenant_id,establishment_id,reservation_id,deposit_amount,
          deposit_currency,total_amount,total_currency,payment_window_minutes,created_at,expires_at)
        values(?,?,?,?,?,?,?,?,?,?,?)
        """, quote.id(), quote.tenantId().value(), quote.establishmentId(), quote.reservationId(),
        quote.deposit().amount(), quote.deposit().currency(),
        quote.total() == null ? null : quote.total().amount(),
        quote.total() == null ? null : quote.total().currency(),
        quote.paymentWindowMinutes(), Timestamp.from(quote.createdAt()), Timestamp.from(quote.expiresAt()));
    return quote;
  }

  private void scope(TenantId tenant) { jdbc.queryForObject(TenantScope.SET_LOCAL_SQL, String.class, tenant.value()); }

  private static PaymentPolicy mapPolicy(ResultSet r, int row) throws SQLException {
    BigDecimal totalAmount = r.getBigDecimal("total_amount");
    Money totalMoney = totalAmount == null ? null : new Money(totalAmount, r.getString("currency"));
    return new PaymentPolicy(r.getObject("id", UUID.class), TenantId.of(r.getString("tenant_id")),
        r.getObject("establishment_id", UUID.class), r.getBoolean("enabled"),
        new Money(r.getBigDecimal("deposit_amount"), r.getString("currency")),
        totalMoney, r.getInt("payment_window_minutes"),
        r.getTimestamp("updated_at").toInstant(), r.getObject("updated_by", UUID.class));
  }

  private static ReservationPaymentQuote mapQuote(ResultSet r, int row) throws SQLException {
    BigDecimal totalAmount = r.getBigDecimal("total_amount");
    String totalCurrency = r.getString("total_currency");
    Money total = (totalAmount == null || totalCurrency == null) ? null : new Money(totalAmount, totalCurrency);
    return new ReservationPaymentQuote(r.getObject("id", UUID.class), TenantId.of(r.getString("tenant_id")),
        r.getObject("establishment_id", UUID.class), r.getObject("reservation_id", UUID.class),
        new Money(r.getBigDecimal("deposit_amount"), r.getString("deposit_currency")), total,
        r.getInt("payment_window_minutes"), r.getTimestamp("created_at").toInstant(),
        r.getTimestamp("expires_at").toInstant());
  }
}
