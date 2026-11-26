package com.mapit.platform.domain;

import java.time.Instant;

/** Un cambio ya auditado; {@code actorName} es el Super Admin que lo hizo. */
public record PlatformSettingChange(
    String key,
    String previousValue,
    String newValue,
    String reason,
    String actorName,
    Instant occurredAt) {}
