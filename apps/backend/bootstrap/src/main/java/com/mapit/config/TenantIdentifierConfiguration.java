package com.mapit.config;

import org.hibernate.context.spi.CurrentTenantIdentifierResolver;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import com.mapit.shared.tenant.TenantContext;
import com.mapit.shared.tenant.TenantId;

/**
 * Capa ORM del ADR-0004: el multi-tenancy por columna discriminadora.
 *
 * <p>Con un {@code CurrentTenantIdentifierResolver} registrado, cada entidad que
 * marque su columna con {@code @TenantId} queda filtrada automáticamente en JPA:
 * ningún {@code SELECT}/{@code UPDATE}/{@code DELETE} requiere mencionar
 * {@code tenant_id}, y en los {@code INSERT} Hibernate lo fija (y rechaza un valor
 * que no coincida con el tenant actual).
 *
 * <p>La fuente de verdad sigue siendo {@code TenantContext} (claim del JWT; el
 * fallback a {@code demo} lo decide esa implementación, no este resolver). Así las
 * dos capas —filtro de Hibernate y RLS de PostgreSQL— nunca pueden divergir: ambas
 * leen el mismo tenant.
 */
@Configuration
public class TenantIdentifierConfiguration {

  @Bean
  CurrentTenantIdentifierResolver<String> mapitTenantIdentifierResolver(TenantContext tenants) {
    return new CurrentTenantIdentifierResolver<>() {
      @Override
      public String resolveCurrentTenantIdentifier() {
        // No debe pasar nunca: SecurityTenantContext siempre tiene un tenant
        // (JWT) o el fallback deliberado. Si eso se rompe, fallar en voz alta
        // es mejor que operar sin filtro.
        return tenants
            .current()
            .map(TenantId::value)
            .orElseThrow(
                () ->
                    new IllegalStateException(
                        "No hay tenant en contexto: la resolución debe ser fail-closed, no opcional."));
      }

      @Override
      public boolean validateExistingCurrentSessions() {
        return false;
      }
    };
  }
}
