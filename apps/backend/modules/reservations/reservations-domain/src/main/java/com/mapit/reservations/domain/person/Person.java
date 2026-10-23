package com.mapit.reservations.domain.person;

import java.time.Instant;
import java.util.Locale;
import java.util.Objects;
import java.util.UUID;
import java.util.regex.Pattern;

import org.jspecify.annotations.Nullable;

import com.mapit.shared.tenant.TenantId;

/** Cliente que puede ser asociado a una reserva dentro de un tenant. */
public record Person(
    PersonId id,
    TenantId tenantId,
    String fullName,
    @Nullable String email,
    @Nullable String phone,
    Instant createdAt,
    UUID createdBy,
    Instant updatedAt,
    UUID updatedBy,
    @Nullable Instant deletedAt,
    @Nullable UUID deletedBy) {

  private static final Pattern EMAIL_PATTERN =
      Pattern.compile("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$");

  public Person {
    Objects.requireNonNull(id, "id no puede ser null");
    Objects.requireNonNull(tenantId, "tenantId no puede ser null");
    fullName = normalizeRequired(fullName, "El nombre es obligatorio", 120);
    email = normalizeEmail(email);
    phone = normalizeOptional(phone, 32, "El teléfono no puede superar 32 caracteres");
    Objects.requireNonNull(createdAt, "createdAt no puede ser null");
    Objects.requireNonNull(createdBy, "createdBy no puede ser null");
    Objects.requireNonNull(updatedAt, "updatedAt no puede ser null");
    Objects.requireNonNull(updatedBy, "updatedBy no puede ser null");
    if (deletedBy != null && deletedAt == null) {
      throw new IllegalArgumentException("deletedBy requiere deletedAt");
    }
  }

  public static Person register(
      PersonId id,
      TenantId tenantId,
      String fullName,
      @Nullable String email,
      @Nullable String phone,
      Instant now,
      UUID actorId) {
    return new Person(
        id, tenantId, fullName, email, phone, now, actorId, now, actorId, null, null);
  }

  private static String normalizeRequired(String value, String message, int maxLength) {
    Objects.requireNonNull(value, message);
    String normalized = value.trim().replaceAll("\\s+", " ");
    if (normalized.isEmpty()) {
      throw new IllegalArgumentException(message);
    }
    if (normalized.length() > maxLength) {
      throw new IllegalArgumentException("El nombre no puede superar 120 caracteres");
    }
    return normalized;
  }

  private static @Nullable String normalizeEmail(@Nullable String value) {
    String normalized = normalizeOptional(value, 254, "El correo no puede superar 254 caracteres");
    if (normalized == null) {
      return null;
    }
    normalized = normalized.toLowerCase(Locale.ROOT);
    if (!EMAIL_PATTERN.matcher(normalized).matches()) {
      throw new IllegalArgumentException("El correo no tiene un formato válido");
    }
    return normalized;
  }

  private static @Nullable String normalizeOptional(
      @Nullable String value, int maxLength, String message) {
    if (value == null) {
      return null;
    }
    String normalized = value.trim();
    if (normalized.isEmpty()) {
      return null;
    }
    if (normalized.length() > maxLength) {
      throw new IllegalArgumentException(message);
    }
    return normalized;
  }
}
