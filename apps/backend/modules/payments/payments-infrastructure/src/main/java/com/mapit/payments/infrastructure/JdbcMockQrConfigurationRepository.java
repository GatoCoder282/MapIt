package com.mapit.payments.infrastructure;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.dao.DuplicateKeyException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import com.mapit.payments.domain.MockQrConfiguration;
import com.mapit.payments.domain.MockQrConfigurationRepository;
import com.mapit.shared.tenant.TenantId;
import com.mapit.shared.tenant.TenantScope;

@Repository
public class JdbcMockQrConfigurationRepository implements MockQrConfigurationRepository {
  private final JdbcTemplate jdbc;
  public JdbcMockQrConfigurationRepository(JdbcTemplate jdbc) { this.jdbc = jdbc; }

  public List<MockQrConfiguration> list(TenantId tenant) {
    scope(tenant);
    return jdbc.query("select * from mock_qr_configuration where tenant_id=? order by created_at,id",
        JdbcMockQrConfigurationRepository::map, tenant.value());
  }
  public Optional<MockQrConfiguration> find(TenantId tenant, UUID id) {
    scope(tenant);
    return jdbc.query("select * from mock_qr_configuration where tenant_id=? and id=?",
        JdbcMockQrConfigurationRepository::map, tenant.value(), id).stream().findFirst();
  }
  public Optional<MockQrConfiguration> findByEstablishment(TenantId tenant, UUID establishmentId) {
    scope(tenant);
    return jdbc.query("select * from mock_qr_configuration where tenant_id=? and establishment_id=?",
        JdbcMockQrConfigurationRepository::map, tenant.value(), establishmentId).stream().findFirst();
  }
  public Optional<MockQrConfiguration> lock(TenantId tenant, UUID id) {
    scope(tenant);
    return jdbc.query("select * from mock_qr_configuration where tenant_id=? and id=? for no key update",
        JdbcMockQrConfigurationRepository::map, tenant.value(), id).stream().findFirst();
  }
  public boolean establishmentExists(TenantId tenant, UUID id) {
    scope(tenant);
    Boolean exists = jdbc.queryForObject("select exists(select 1 from establishment where tenant_id=? and id=? and deleted_at is null)",
        Boolean.class, tenant.value(), id);
    return Boolean.TRUE.equals(exists);
  }
  public boolean insert(MockQrConfiguration c) {
    scope(c.tenantId());
    return jdbc.update("""
        insert into mock_qr_configuration(id,tenant_id,establishment_id,country,bank_name,account_holder_name,
          account_reference,enabled,simulation_token,created_at,updated_at,created_by,updated_by)
        values(?,?,?,?,?,?,?,?,?,?,?,?,?) on conflict (tenant_id,establishment_id) do nothing
        """, c.id(), c.tenantId().value(), c.establishmentId(), c.country(), c.bankName(), c.accountHolderName(),
        c.accountReference(), c.enabled(), c.simulationToken(), Timestamp.from(c.createdAt()), Timestamp.from(c.updatedAt()),
        c.createdBy(), c.updatedBy()) == 1;
  }
  public boolean update(MockQrConfiguration c) {
    scope(c.tenantId());
    try {
      return jdbc.update("""
          update mock_qr_configuration set establishment_id=?,country=?,bank_name=?,account_holder_name=?,
            account_reference=?,enabled=?,simulation_token=?,updated_at=?,updated_by=? where tenant_id=? and id=?
          """, c.establishmentId(), c.country(), c.bankName(), c.accountHolderName(), c.accountReference(), c.enabled(),
          c.simulationToken(), Timestamp.from(c.updatedAt()), c.updatedBy(), c.tenantId().value(), c.id()) == 1;
    } catch (DuplicateKeyException duplicate) {
      throw new MockQrConfigurationRepository.Duplicate();
    }
  }
  private void scope(TenantId tenant) { jdbc.queryForObject(TenantScope.SET_LOCAL_SQL, String.class, tenant.value()); }
  private static MockQrConfiguration map(ResultSet r, int row) throws SQLException {
    return new MockQrConfiguration(r.getObject("id", UUID.class), TenantId.of(r.getString("tenant_id")),
        r.getObject("establishment_id", UUID.class), r.getString("country"), r.getString("bank_name"),
        r.getString("account_holder_name"), r.getString("account_reference"), r.getBoolean("enabled"),
        r.getObject("simulation_token", UUID.class), r.getTimestamp("created_at").toInstant(),
        r.getTimestamp("updated_at").toInstant(), r.getObject("created_by", UUID.class), r.getObject("updated_by", UUID.class));
  }
}
