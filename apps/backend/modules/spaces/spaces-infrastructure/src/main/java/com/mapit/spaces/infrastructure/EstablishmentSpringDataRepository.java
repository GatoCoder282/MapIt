package com.mapit.spaces.infrastructure;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

/**
 * Repositorio Spring Data interno del adaptador de persistencia.
 *
 * <p>Todos los métodos llevan {@code DeletedAtIsNull}: la baja es lógica y una consulta
 * que lo olvide expondría filas dadas de baja. Spring Data construye el SQL a partir del
 * nombre del método, así que la condición queda visible en la firma.
 */
interface EstablishmentSpringDataRepository extends JpaRepository<EstablishmentJpaEntity, UUID> {

  List<EstablishmentJpaEntity> findAllByTenantIdAndDeletedAtIsNullOrderByCreatedAtDesc(
      String tenantId);

  Optional<EstablishmentJpaEntity> findByIdAndTenantIdAndDeletedAtIsNull(UUID id, String tenantId);

  Optional<EstablishmentJpaEntity> findBySlugAndTenantIdAndDeletedAtIsNull(
      String slug, String tenantId);
}
