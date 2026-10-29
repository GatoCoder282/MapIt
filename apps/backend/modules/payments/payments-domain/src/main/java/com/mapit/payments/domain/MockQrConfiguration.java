package com.mapit.payments.domain;

import java.time.Instant;
import java.util.Locale;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;

import com.mapit.shared.tenant.TenantId;

/** Configuración de demostración aislada: no es un método aceptado por PaymentService. */
public record MockQrConfiguration(UUID id, TenantId tenantId, UUID establishmentId, String country,
    String bankName, String accountHolderName, String accountReference, boolean enabled,
    UUID simulationToken, Instant createdAt, Instant updatedAt, UUID createdBy, UUID updatedBy) {
  private static final Set<String> COUNTRIES = Set.of(Locale.getISOCountries());

  public MockQrConfiguration {
    Objects.requireNonNull(id, "id");
    Objects.requireNonNull(tenantId, "tenantId");
    Objects.requireNonNull(establishmentId, "establishmentId");
    Objects.requireNonNull(simulationToken, "simulationToken");
    Objects.requireNonNull(createdAt, "createdAt");
    Objects.requireNonNull(updatedAt, "updatedAt");
    Objects.requireNonNull(createdBy, "createdBy");
    Objects.requireNonNull(updatedBy, "updatedBy");
    if (!COUNTRIES.contains(country)) throw new IllegalArgumentException("País ISO inválido");
    bankName = required(bankName);
    accountHolderName = required(accountHolderName);
    accountReference = required(accountReference);
  }

  public String simulationPath() { return "/simulacion/qr/" + simulationToken; }

  private static String required(String value) {
    Objects.requireNonNull(value, "Campo requerido");
    String clean = value.strip();
    if (clean.isEmpty() || clean.length() > 120) throw new IllegalArgumentException("Campo requerido de hasta 120 caracteres");
    return clean;
  }
}
