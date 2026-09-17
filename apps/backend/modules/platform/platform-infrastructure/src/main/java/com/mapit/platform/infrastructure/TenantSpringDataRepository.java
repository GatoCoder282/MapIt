package com.mapit.platform.infrastructure;

import org.jspecify.annotations.Nullable;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.mapit.platform.domain.TenantStatus;

/** Repositorio Spring Data del tenant global. */
interface TenantSpringDataRepository extends JpaRepository<TenantJpaEntity, String> {

  boolean existsBySlug(String slug);

  /**
   * Búsqueda de plataforma sobre la tabla global (sin RLS por diseño). Vacío o
   * null en los filtros los desactiva. El patrón de búsqueda llega ya envuelto
   * en {@code %} y en minúsculas desde el adaptador, escapado para LIKE.
   */
  @Query("""
      select t from TenantJpaEntity t
      where (:pattern is null
             or lower(t.name) like :pattern escape '\\'
             or lower(t.slug) like :pattern escape '\\')
        and (:status is null or t.status = :status)
      """)
  Page<TenantJpaEntity> search(
      @Param("pattern") @Nullable String pattern,
      @Param("status") @Nullable TenantStatus status,
      Pageable pageable);
}
