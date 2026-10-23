package com.mapit.platform.domain;

import java.util.List;
import java.util.Objects;

/** Página de tenants para el listado de la consola de plataforma. */
public record TenantPage(List<Tenant> content, int page, int size, long totalElements, int totalPages) {
  public TenantPage {
    Objects.requireNonNull(content, "content no puede ser null");
  }
}
