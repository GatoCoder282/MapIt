package com.mapit.platform.domain.observability;

import java.util.UUID;

import org.jspecify.annotations.Nullable;

/** Registro append-only de quién consultó qué vista (P-4). */
public interface PlatformAccessLog {

  void record(UUID actorId, View view, @Nullable String subjectTenantId);

  enum View {
    OVERVIEW,
    TENANT_LIST,
    TENANT_DETAIL
  }
}
