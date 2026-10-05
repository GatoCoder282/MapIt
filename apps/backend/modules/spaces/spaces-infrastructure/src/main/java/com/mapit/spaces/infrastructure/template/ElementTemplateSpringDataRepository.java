package com.mapit.spaces.infrastructure.template;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/** Repositorio Spring Data interno del adaptador de ElementTemplate. */
interface ElementTemplateSpringDataRepository
    extends JpaRepository<ElementTemplateJpaEntity, UUID> {

  @Query(
      "select t from ElementTemplateJpaEntity t "
          + "where t.tenantId = :tenantId and t.deletedAt is null "
          + "order by lower(t.name) asc")
  List<ElementTemplateJpaEntity> findAllAliveByTenant(@Param("tenantId") String tenantId);

  @Query(
      "select t from ElementTemplateJpaEntity t "
          + "where t.id = :id and t.tenantId = :tenantId and t.deletedAt is null")
  Optional<ElementTemplateJpaEntity> findAliveById(
      @Param("id") UUID id, @Param("tenantId") String tenantId);

  @Query(
      "select count(t) > 0 from ElementTemplateJpaEntity t "
          + "where lower(t.name) = lower(:name) and t.tenantId = :tenantId "
          + "and t.deletedAt is null")
  boolean existsAliveByName(
      @Param("tenantId") String tenantId, @Param("name") String name);
}
