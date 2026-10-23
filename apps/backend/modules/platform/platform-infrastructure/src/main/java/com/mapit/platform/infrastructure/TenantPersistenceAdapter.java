package com.mapit.platform.infrastructure;

import java.util.Optional;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Repository;

import com.mapit.platform.domain.Tenant;
import com.mapit.platform.domain.TenantPage;
import com.mapit.platform.domain.TenantRepository;
import com.mapit.platform.domain.TenantStatus;
import com.mapit.shared.tenant.TenantId;

/** Adaptador que conecta el puerto de tenants con Spring Data JPA. */
@Repository
class TenantPersistenceAdapter implements TenantRepository {

  private final TenantSpringDataRepository repository;

  TenantPersistenceAdapter(TenantSpringDataRepository repository) {
    this.repository = repository;
  }

  @Override
  public boolean existsBySlug(String slug) {
    return repository.existsBySlug(slug);
  }

  @Override
  public Tenant save(Tenant tenant) {
    // saveAndFlush: la fila del tenant debe existir YA para la FK de
    // invitation_tokens (la invitación del primer ADMIN se inserta en la misma
    // transacción vía JDBC). El INSERT normal de JPA se diferiría al commit.
    return repository.saveAndFlush(TenantJpaEntity.fromDomain(tenant)).toDomain();
  }

  @Override
  public Optional<Tenant> findById(TenantId id) {
    return repository.findById(id.value()).map(TenantJpaEntity::toDomain);
  }

  @Override
  public TenantPage search(String search, TenantStatus status, int page, int size) {
    String pattern = toLikePattern(search);
    Page<TenantJpaEntity> result =
        repository.search(
            pattern, status, PageRequest.of(page, size, Sort.Direction.DESC, "createdAt"));
    return new TenantPage(
        result.getContent().stream().map(TenantJpaEntity::toDomain).toList(),
        result.getNumber(),
        result.getSize(),
        result.getTotalElements(),
        result.getTotalPages());
  }

  /**
   * Convierte el texto libre en patrón LIKE escapando los comodines para que una
   * búsqueda con {@code %} o {@code _} se trate como texto literal.
   */
  private static String toLikePattern(String search) {
    if (search == null || search.isBlank()) {
      return null;
    }
    String escaped =
        search.trim().toLowerCase()
            .replace("\\", "\\\\")
            .replace("%", "\\%")
            .replace("_", "\\_");
    return "%" + escaped + "%";
  }
}
