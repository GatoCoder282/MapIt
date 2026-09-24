package com.mapit.platform.domain;

/** Estado del ciclo de vida de un tenant. */
public enum TenantStatus {
  /** Recién registrado: sus usuarios no inician sesión hasta que el SUPER_ADMIN lo apruebe. */
  PENDING_APPROVAL,
  ACTIVE,
  SUSPENDED
}
