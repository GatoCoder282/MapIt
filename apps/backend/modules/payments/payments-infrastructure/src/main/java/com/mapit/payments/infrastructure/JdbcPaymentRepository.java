package com.mapit.payments.infrastructure;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

import org.jspecify.annotations.Nullable;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import com.mapit.payments.domain.Money;
import com.mapit.payments.domain.Payment;
import com.mapit.payments.domain.PaymentProvider;
import com.mapit.payments.domain.PaymentRepository;
import com.mapit.shared.tenant.TenantId;
import com.mapit.shared.tenant.TenantScope;

@Repository
public class JdbcPaymentRepository implements PaymentRepository {
  private final JdbcTemplate jdbc;
  public JdbcPaymentRepository(JdbcTemplate jdbc) { this.jdbc = jdbc; }

  @Override
  public Payment insert(Payment p) { return insert(p, UUID.randomUUID()); }

  @Override
  public Payment insert(Payment p, UUID requestId) {
    scope(p.tenantId());
    jdbc.update("""
        insert into payment(id,tenant_id,establishment_id,reservation_id,method_id,provider,merchant_reference,
          external_reference,amount,currency,status,created_at,expires_at,verified_at,verified_by,verification_source,request_id)
        values(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        """, p.id(), p.tenantId().value(), p.establishmentId(), p.reservationId(), p.methodId(),
        p.provider().name(), p.merchantReference(), p.externalReference(), p.money().amount(), p.money().currency(),
        p.status().name(), Timestamp.from(p.createdAt()), Timestamp.from(p.expiresAt()),
        p.verifiedAt() == null ? null : Timestamp.from(p.verifiedAt()), p.verifiedBy(), p.verificationSource(), requestId);
    addRequestAlias(p, requestId);
    return p;
  }

  @Override
  public void addRequestAlias(Payment payment, UUID requestId) {
    scope(payment.tenantId());
    jdbc.update("""
        insert into payment_request_alias(id,tenant_id,reservation_id,request_id,payment_id)
        values(?,?,?,?,?)
        """, UUID.randomUUID(), payment.tenantId().value(), payment.reservationId(), requestId, payment.id());
  }

  @Override
  public Optional<Payment> find(TenantId tenant, UUID id) {
    scope(tenant);
    return jdbc.query("select * from payment where tenant_id=? and id=?", JdbcPaymentRepository::map, tenant.value(), id).stream().findFirst();
  }

  @Override
  public Optional<Payment> findByRequest(TenantId tenant, UUID reservationId, UUID requestId) {
    if (requestId == null) return Optional.empty();
    scope(tenant);
    return jdbc.query("""
        select payment.* from payment_request_alias alias
        join payment on payment.tenant_id=alias.tenant_id and payment.id=alias.payment_id
        where alias.tenant_id=? and alias.reservation_id=? and alias.request_id=?
        """, JdbcPaymentRepository::map, tenant.value(), reservationId, requestId).stream().findFirst();
  }

  @Override
  public Optional<Payment> latest(TenantId tenant, UUID reservationId) {
    scope(tenant);
    return jdbc.query("select * from payment where tenant_id=? and reservation_id=? order by created_at desc, id desc limit 1",
        JdbcPaymentRepository::map, tenant.value(), reservationId).stream().findFirst();
  }

  @Override
  public java.util.List<Payment> pending(TenantId tenant, UUID reservationId) {
    scope(tenant);
    return jdbc.query("select * from payment where tenant_id=? and reservation_id=? and status in ('PENDING','PENDING_MANUAL_VERIFICATION') order by created_at desc, id desc",
        JdbcPaymentRepository::map, tenant.value(), reservationId);
  }

  @Override
  public Optional<Payment> confirmed(TenantId tenant, UUID reservationId) {
    scope(tenant);
    return jdbc.query("select * from payment where tenant_id=? and reservation_id=? and status='CONFIRMED' order by created_at desc limit 1",
        JdbcPaymentRepository::map, tenant.value(), reservationId).stream().findFirst();
  }

  @Override
  public Optional<Payment> reconciliationRequired(TenantId tenant, UUID reservationId) {
    scope(tenant);
    return jdbc.query("select * from payment where tenant_id=? and reservation_id=? and status='RECONCILIATION_REQUIRED' order by verified_at desc, id desc limit 1",
        JdbcPaymentRepository::map, tenant.value(), reservationId).stream().findFirst();
  }

  @Override
  public Optional<Payment> lock(TenantId tenant, UUID id) {
    scope(tenant);
    return jdbc.query("select * from payment where tenant_id=? and id=? for update",
        JdbcPaymentRepository::map, tenant.value(), id).stream().findFirst();
  }

  @Override
  public void update(Payment p) {
    scope(p.tenantId());
    if (jdbc.update("""
        update payment set status=?,verified_at=?,verified_by=?,verification_source=? where tenant_id=? and id=?
        """, p.status().name(), p.verifiedAt() == null ? null : Timestamp.from(p.verifiedAt()),
        p.verifiedBy(), p.verificationSource(), p.tenantId().value(), p.id()) != 1) {
      throw new IllegalStateException("El pago bloqueado dejó de existir");
    }
  }

  @Override
  public boolean recordEvent(Payment p, String eventId, Payment.Outcome outcome, Instant receivedAt) {
    scope(p.tenantId());
    boolean inserted = jdbc.update("""
        insert into payment_webhook_event(id,tenant_id,payment_id,provider,event_id,outcome,received_at)
        values(?,?,?,?,?,?,?) on conflict(tenant_id,provider,event_id) do nothing
        """, UUID.randomUUID(), p.tenantId().value(), p.id(), p.provider().name(), eventId, outcome.name(),
        Timestamp.from(receivedAt)) == 1;
    if (!inserted) {
      Boolean identical = jdbc.queryForObject("""
          select exists(select 1 from payment_webhook_event
            where tenant_id=? and provider=? and event_id=? and payment_id=? and outcome=?)
          """, Boolean.class, p.tenantId().value(), p.provider().name(), eventId, p.id(), outcome.name());
      if (!Boolean.TRUE.equals(identical)) throw new IllegalArgumentException("Identificador de webhook reutilizado con otro evento");
    }
    return inserted;
  }

  @Override
  public void recordVerification(Payment p, @Nullable UUID actor, String source, String reference, Instant now) {
    scope(p.tenantId());
    jdbc.update("""
        insert into payment_verification(id,tenant_id,payment_id,actor_id,source,reference,created_at)
        values(?,?,?,?,?,?,?)
        """, UUID.randomUUID(), p.tenantId().value(), p.id(), actor, source, reference, Timestamp.from(now));
  }

  private void scope(TenantId tenant) { jdbc.queryForObject(TenantScope.SET_LOCAL_SQL, String.class, tenant.value()); }

  static Payment map(ResultSet r, int row) throws SQLException {
    Timestamp verified = r.getTimestamp("verified_at");
    return new Payment(r.getObject("id", UUID.class), TenantId.of(r.getString("tenant_id")),
        r.getObject("establishment_id", UUID.class), r.getObject("reservation_id", UUID.class),
        r.getObject("method_id", UUID.class), PaymentProvider.valueOf(r.getString("provider")),
        r.getString("merchant_reference"), r.getString("external_reference"),
        new Money(r.getBigDecimal("amount"), r.getString("currency")), Payment.Status.valueOf(r.getString("status")),
        r.getTimestamp("created_at").toInstant(), r.getTimestamp("expires_at").toInstant(),
        verified == null ? null : verified.toInstant(), r.getObject("verified_by", UUID.class), r.getString("verification_source"));
  }
}
