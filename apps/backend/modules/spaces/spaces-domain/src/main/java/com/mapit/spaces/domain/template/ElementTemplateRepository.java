package com.mapit.spaces.domain.template;

import java.util.List;
import java.util.Optional;

import com.mapit.shared.tenant.TenantId;

/**
 * Puerto de persistencia de plantillas de elemento (HU-4.02 / MAP-202).
 *
 * <p>Vive en el dominio (hexagonal: la infraestructura implementa, el dominio declara).
 * Todas las operaciones llevan el {@code tenantId} explícito: las plantillas están
 * completamente aisladas por tenant.
 */
public interface ElementTemplateRepository {

  /** Plantillas vivas del tenant, ordenadas por nombre. */
  List<ElementTemplate> findAllAliveByTenant(TenantId tenantId);

  /**
   * Busca una plantilla viva por id, scoped al tenant.
   *
   * <p>Vacío si no existe, está dada de baja, o es de otro tenant (no se distingue
   * para no filtrar existencia entre tenants).
   */
  Optional<ElementTemplate> findAliveById(TenantId tenantId, ElementTemplateId id);

  /** Inserta o actualiza (incluyendo baja lógica). */
  ElementTemplate save(ElementTemplate template);

  /**
   * Comprueba si ya existe una plantilla viva con ese nombre en el tenant.
   * Usado para dar un error 409 claro en lugar de una excepción de constraint.
   */
  boolean existsAliveByName(TenantId tenantId, String name);
}
