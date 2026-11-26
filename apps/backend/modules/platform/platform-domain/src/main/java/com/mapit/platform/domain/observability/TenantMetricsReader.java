package com.mapit.platform.domain.observability;

import java.time.Instant;

import com.mapit.shared.tenant.TenantId;

/** Lee agregados de <em>una</em> empresa dentro de su propio contexto de aislamiento. */
public interface TenantMetricsReader {

  TenantUsage read(TenantId tenantId, Instant since);
}
