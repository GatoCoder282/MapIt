package com.mapit.platform.domain.observability;

import java.util.Optional;

/** Señales de la API desde el arranque del proceso; vacío si no están instrumentadas. */
public interface ApiHealthProbe {

  Optional<ApiHealth> read();

  boolean databaseAvailable();

  record ApiHealth(long requests, long serverErrors, double meanLatencyMillis) {}
}
