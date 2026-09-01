package com.mapit.spaces.infrastructure;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

/** Repositorio Spring Data interno del adaptador de persistencia. */
interface DemoItemSpringDataRepository extends JpaRepository<DemoItemJpaEntity, UUID> {

  List<DemoItemJpaEntity> findAllByTenantIdOrderByCreatedAtDesc(String tenantId);

  Optional<DemoItemJpaEntity> findByIdAndTenantId(UUID id, String tenantId);

  void deleteByIdAndTenantId(UUID id, String tenantId);
}
