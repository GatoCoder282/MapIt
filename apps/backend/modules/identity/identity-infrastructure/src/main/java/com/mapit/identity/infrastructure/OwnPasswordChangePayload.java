package com.mapit.identity.infrastructure;

import java.util.Map;
import java.util.Set;

import org.jspecify.annotations.Nullable;

import com.mapit.identity.application.OwnPasswordChange;
import com.mapit.identity.application.OwnPasswordChangeFailure;
import com.mapit.identity.application.OwnPasswordChangeFailure.Reason;

/** Lector cerrado preparado para el contrato existente; no registra rutas/controladores. */
public final class OwnPasswordChangePayload {
  private static final Set<String> FIELDS = Set.of("currentPassword", "newPassword", "newPasswordConfirm");

  private OwnPasswordChangePayload() {}

  public static OwnPasswordChange read(Map<String, @Nullable Object> body) {
    if (!body.keySet().equals(FIELDS)
        || !(body.get("currentPassword") instanceof String current)
        || !(body.get("newPassword") instanceof String next)
        || !(body.get("newPasswordConfirm") instanceof String confirmation)) {
      throw new OwnPasswordChangeFailure(Reason.INVALID_REQUEST);
    }
    return new OwnPasswordChange(current, next, confirmation);
  }
}
