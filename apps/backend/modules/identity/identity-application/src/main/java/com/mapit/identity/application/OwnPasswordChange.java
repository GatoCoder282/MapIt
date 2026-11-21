package com.mapit.identity.application;

import org.jspecify.annotations.Nullable;

/** Datos efímeros: nunca registrar, persistir ni devolver al cliente. Sin identidad objetivo. */
public record OwnPasswordChange(
    @Nullable String currentPassword,
    @Nullable String newPassword,
    @Nullable String newPasswordConfirm) {
  @Override
  public String toString() {
    return "OwnPasswordChange[REDACTED]";
  }
}
