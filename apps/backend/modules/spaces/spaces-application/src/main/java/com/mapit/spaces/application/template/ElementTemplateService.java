package com.mapit.spaces.application.template;

import java.time.Clock;
import java.util.List;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.mapit.shared.tenant.TenantContext;
import com.mapit.shared.tenant.TenantId;
import com.mapit.spaces.domain.spaceelement.SpaceElementType;
import com.mapit.spaces.domain.template.ElementTemplate;
import com.mapit.spaces.domain.template.ElementTemplateId;
import com.mapit.spaces.domain.template.ElementTemplateRepository;

/**
 * Casos de uso CRUD de plantillas de elemento (HU-4.02 / MAP-204).
 *
 * <p>Misma arquitectura que los demás servicios de spaces: el tenant siempre sale
 * del contexto, nunca del body. Las validaciones ocurren antes de persistir.
 */
@Service
public class ElementTemplateService {

  private final ElementTemplateRepository repository;
  private final TenantContext tenantContext;
  private final Clock clock;

  public ElementTemplateService(
      ElementTemplateRepository repository,
      TenantContext tenantContext,
      Clock clock) {
    this.repository = repository;
    this.tenantContext = tenantContext;
    this.clock = clock;
  }

  // ===== CREAR =====

  @Transactional
  public ElementTemplateResponse create(CreateElementTemplateCommand command) {
    TenantId tenantId = tenantContext.require();
    SpaceElementType type = parseType(command.type());

    String trimmed = command.name().trim();
    if (repository.existsAliveByName(tenantId, trimmed)) {
      throw new ElementTemplateNameConflictException(trimmed);
    }

    ElementTemplate saved =
        repository.save(
            ElementTemplate.register(
                ElementTemplateId.generate(),
                tenantId,
                trimmed,
                type,
                clock.instant(),
                null));
    return ElementTemplateResponse.fromDomain(saved);
  }

  // ===== LISTAR =====

  @Transactional(readOnly = true)
  public List<ElementTemplateResponse> listAll() {
    TenantId tenantId = tenantContext.require();
    return repository.findAllAliveByTenant(tenantId).stream()
        .map(ElementTemplateResponse::fromDomain)
        .toList();
  }

  // ===== OBTENER POR ID =====

  @Transactional(readOnly = true)
  public ElementTemplateResponse getById(java.util.UUID templateId) {
    TenantId tenantId = tenantContext.require();
    return repository
        .findAliveById(tenantId, ElementTemplateId.of(templateId))
        .map(ElementTemplateResponse::fromDomain)
        .orElseThrow(() -> new ElementTemplateNotFoundException(templateId));
  }

  // ===== ACTUALIZAR =====

  @Transactional
  public ElementTemplateResponse update(UpdateElementTemplateCommand command) {
    TenantId tenantId = tenantContext.require();
    SpaceElementType type = parseType(command.type());

    ElementTemplate existing =
        repository
            .findAliveById(tenantId, ElementTemplateId.of(command.templateId()))
            .orElseThrow(() -> new ElementTemplateNotFoundException(command.templateId()));

    String trimmed = command.name().trim();
    // Verificar unicidad de nombre solo si cambió
    if (!trimmed.equalsIgnoreCase(existing.name())
        && repository.existsAliveByName(tenantId, trimmed)) {
      throw new ElementTemplateNameConflictException(trimmed);
    }

    ElementTemplate updated = existing.update(trimmed, type, clock.instant(), null);
    return ElementTemplateResponse.fromDomain(repository.save(updated));
  }

  // ===== ELIMINAR =====

  @Transactional
  public void delete(java.util.UUID templateId) {
    TenantId tenantId = tenantContext.require();
    ElementTemplate existing =
        repository
            .findAliveById(tenantId, ElementTemplateId.of(templateId))
            .orElseThrow(() -> new ElementTemplateNotFoundException(templateId));

    repository.save(existing.softDelete(clock.instant(), null));
  }

  // ===== UTILIDADES =====

  private SpaceElementType parseType(String raw) {
    try {
      return SpaceElementType.valueOf(raw);
    } catch (IllegalArgumentException ex) {
      throw new IllegalArgumentException(
          "type inválido: '%s'. Valores: %s"
              .formatted(raw, java.util.Arrays.toString(SpaceElementType.values())));
    }
  }
}
