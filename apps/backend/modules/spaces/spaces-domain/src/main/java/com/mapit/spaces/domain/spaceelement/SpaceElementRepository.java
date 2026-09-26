package com.mapit.spaces.domain.spaceelement;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import com.mapit.shared.tenant.TenantId;

/**
 * Puerto de persistencia de elementos espaciales.
 *
 * <p>Vive en el dominio porque es el dominio quien declara qué necesita guardar; la
 * infraestructura decide cómo. Inversión de dependencias de la arquitectura hexagonal.
 *
 * <p>Todas las operaciones llevan el {@code tenantId} explícito y si scopear por sector:
 * la cadena {@code tenant → sector → elemento} es la frontera de aislamiento (RN-1/RN-2).
 * Ninguna operación "viva" devuelve elementos dados de baja.
 */
public interface SpaceElementRepository {

  /** Elementos vivos de un sector del tenant, del más reciente al más antiguo. */
  List<SpaceElement> findAliveBySectorId(TenantId tenantId, UUID sectorId);

  /**
   * Busca un elemento vivo por id, restringido al sector y tenant dados.
   *
   * <p>Vacío si no existe, está dado de baja, es de otro sector o de otro tenant: el
   * "no existe" y el "no es tuyo" devuelven lo mismo para no filtrar existencia.
   */
  Optional<SpaceElement> findAliveById(TenantId tenantId, UUID sectorId, SpaceElementId id);

  /** Inserta o actualiza. La baja lógica también pasa por aquí. */
  SpaceElement save(SpaceElement element);
}
