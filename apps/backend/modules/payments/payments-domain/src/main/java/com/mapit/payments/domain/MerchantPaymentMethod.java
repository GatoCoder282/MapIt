package com.mapit.payments.domain;

import java.time.Instant;
import java.util.Arrays;
import java.util.Base64;
import java.util.Currency;
import java.util.Locale;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;

import org.jspecify.annotations.Nullable;

import com.mapit.shared.tenant.TenantId;

/** Configuración no secreta. El QR cargado es una imagen bancaria, nunca evidencia de pago. */
public record MerchantPaymentMethod(
    UUID id, TenantId tenantId, @Nullable UUID establishmentId, String displayName,
    String country, String currency, PaymentProvider provider, String bankName,
    String accountReference, @Nullable String staticQrImage, boolean enabled,
    Instant createdAt, Instant updatedAt, UUID createdBy, UUID updatedBy,
    @Nullable String accountHolderName, @Nullable UUID mockQrConfigurationId,
    @Nullable Instant supersededAt) {

  public MerchantPaymentMethod(UUID id, TenantId tenantId, @Nullable UUID establishmentId, String displayName,
      String country, String currency, PaymentProvider provider, String bankName, String accountReference,
      @Nullable String staticQrImage, boolean enabled, Instant createdAt, Instant updatedAt, UUID createdBy,
      UUID updatedBy, @Nullable String accountHolderName) {
    this(id, tenantId, establishmentId, displayName, country, currency, provider, bankName, accountReference,
        staticQrImage, enabled, createdAt, updatedAt, createdBy, updatedBy, accountHolderName, null, null);
  }

  /** Compatibilidad de lectura con registros anteriores a V23, sin inventar un titular. */
  public MerchantPaymentMethod(UUID id, TenantId tenantId, @Nullable UUID establishmentId, String displayName,
      String country, String currency, PaymentProvider provider, String bankName, String accountReference,
      @Nullable String staticQrImage, boolean enabled, Instant createdAt, Instant updatedAt, UUID createdBy, UUID updatedBy) {
    this(id, tenantId, establishmentId, displayName, country, currency, provider, bankName, accountReference,
        staticQrImage, enabled, createdAt, updatedAt, createdBy, updatedBy, null, null, null);
  }

  private static final Set<String> COUNTRIES = Set.of(Locale.getISOCountries());

  public MerchantPaymentMethod {
    Objects.requireNonNull(id, "id");
    Objects.requireNonNull(tenantId, "tenantId");
    displayName = required(displayName, "displayName");
    bankName = required(bankName, "bankName");
    accountReference = required(accountReference, "accountReference");
    if (accountHolderName != null) accountHolderName = required(accountHolderName, "accountHolderName");
    if (!COUNTRIES.contains(country)) throw new IllegalArgumentException("País ISO inválido");
    if (Currency.getInstance(currency).getDefaultFractionDigits() < 0) {
      throw new IllegalArgumentException("Moneda no apta para cobros");
    }
    Objects.requireNonNull(provider, "provider");
    Objects.requireNonNull(createdAt, "createdAt");
    Objects.requireNonNull(updatedAt, "updatedAt");
    Objects.requireNonNull(createdBy, "createdBy");
    Objects.requireNonNull(updatedBy, "updatedBy");
    if (mockQrConfigurationId != null
        && (provider != PaymentProvider.MOCK_GATEWAY || establishmentId == null)) {
      throw new IllegalArgumentException("Una proyección MOCK debe ser local y usar MOCK_GATEWAY");
    }
    if (supersededAt != null && mockQrConfigurationId == null) {
      throw new IllegalArgumentException("Solo se puede superseder una proyección MOCK");
    }
    if (staticQrImage != null) validateQr(staticQrImage);
    if (provider == PaymentProvider.STATIC_BANK_QR && staticQrImage == null) {
      throw new IllegalArgumentException("El método bancario requiere su imagen QR");
    }
    if (provider != PaymentProvider.STATIC_BANK_QR && staticQrImage != null) {
      throw new IllegalArgumentException("Solo el método bancario admite una imagen QR propia");
    }
    if (provider == PaymentProvider.INTEGRATED_GATEWAY && enabled) {
      throw new IllegalArgumentException("No existe un proveedor real integrado");
    }
  }

  public String verification() {
    return provider == PaymentProvider.STATIC_BANK_QR ? "MANUAL" : "AUTOMATIC";
  }

  private static String required(String value, String name) {
    Objects.requireNonNull(value, name);
    String clean = value.strip();
    if (clean.isEmpty() || clean.length() > 120) throw new IllegalArgumentException(name + " inválido");
    return clean;
  }

  private static void validateQr(String image) {
    if (image.length() > 350000) throw new IllegalArgumentException("Imagen QR demasiado grande");
    String png = "data:image/png;base64,";
    String jpeg = "data:image/jpeg;base64,";
    boolean isPng = image.startsWith(png);
    if (!isPng && !image.startsWith(jpeg)) throw new IllegalArgumentException("Formato QR no permitido");
    byte[] bytes = Base64.getDecoder().decode(image.substring(isPng ? png.length() : jpeg.length()));
    byte[] signature = isPng ? new byte[] {(byte)137,80,78,71,13,10,26,10} : new byte[] {(byte)255,(byte)216,(byte)255};
    if (bytes.length <= signature.length || !Arrays.equals(signature, Arrays.copyOf(bytes, signature.length))) {
      throw new IllegalArgumentException("Contenido de imagen QR inválido");
    }
  }
}
