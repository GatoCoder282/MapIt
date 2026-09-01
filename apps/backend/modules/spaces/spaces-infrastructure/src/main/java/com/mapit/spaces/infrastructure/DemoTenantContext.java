package com.mapit.spaces.infrastructure;

import java.util.Optional;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import com.mapit.shared.tenant.TenantContext;
import com.mapit.shared.tenant.TenantId;

/**
 * Contexto temporal del CRUD de prueba.
 *
 * <p>CU-23/CU-24 lo reemplazará por un adaptador que lea el claim {@code tenant} del JWT. Este
 * adaptador usa el tenant configurado para que el CRUD pueda probarse antes de implementar la
 * autenticación.
 */
@Component
public class DemoTenantContext implements TenantContext {

  private final TenantId tenantId;

  public DemoTenantContext(@Value("${mapit.tenant.default:demo}") String tenant) {
    this.tenantId = TenantId.of(tenant);
  }

  @Override
  public Optional<TenantId> current() {
    return Optional.of(tenantId);
  }
}
