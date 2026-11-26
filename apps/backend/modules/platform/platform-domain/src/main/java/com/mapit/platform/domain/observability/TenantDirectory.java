package com.mapit.platform.domain.observability;

import java.util.List;
import java.util.Optional;

import org.jspecify.annotations.Nullable;

import com.mapit.platform.domain.TenantStatus;

/** Directorio de empresas de negocio (sin el tenant técnico y sin datos de personas). */
public interface TenantDirectory {

  Page search(@Nullable String text, @Nullable TenantStatus status, int page, int size);

  List<Entry> all();

  Optional<Entry> findBySlug(String slug);

  record Entry(String id, String slug, String name, TenantStatus status) {}

  record Page(List<Entry> content, long totalElements) {}
}
