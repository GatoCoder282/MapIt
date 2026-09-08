package com.mapit.platform.infrastructure;

import org.springframework.data.jpa.repository.JpaRepository;

/** Repositorio Spring Data del tenant global. */
interface TenantSpringDataRepository extends JpaRepository<TenantJpaEntity, String> {

  boolean existsBySlug(String slug);
}
