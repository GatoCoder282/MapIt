package com.mapit.spaces.domain;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import com.mapit.shared.tenant.TenantId;

/**
 * Puerto de persistencia de establecimientos.
 *
 * <p>Vive en el dominio porque es el dominio quien declara <em>qué</em> necesita guardar;
 * la infraestructura decide <em>cómo</em>. Esa es la inversión de dependencias que sostiene
 * la arquitectura hexagonal.
 *
 * <p>Todas las operaciones son «vivas»: nunca devuelven filas dadas de baja. El filtro
 * {@code deleted_at IS NULL} está centralizado en el adaptador, en un único sitio, para que
 * ningún caso de uso pueda olvidarlo.
 */
public interface EstablishmentRepository {

  /** Establecimientos vivos del tenant, del más reciente al más antiguo. */
  List<Establishment> findAllAlive(TenantId tenantId);

  /** Busca uno vivo por id. Vacío si no existe, está dado de baja o es de otro tenant. */
  Optional<Establishment> findAliveById(TenantId tenantId, UUID id);

  /**
   * Busca un establecimiento vivo por su slug, para detectar conflictos.
   *
   * <p>Devuelve la entidad y no un {@code boolean} para que el caso de uso de actualización
   * pueda distinguir «el slug lo tiene otro» de «el slug ya es mío».
   */
  Optional<Establishment> findAliveBySlug(TenantId tenantId, Slug slug);

  /** Inserta o actualiza. La baja lógica también pasa por aquí: es un update. */
  Establishment save(Establishment establishment);
}
