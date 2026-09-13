package com.mapit.spaces.domain;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import com.mapit.shared.tenant.TenantId;

/**
 * Puerto de persistencia de pisos.
 *
 * <p>Vive en el dominio porque es el dominio quien declara qué necesita guardar;
 * la infraestructura decide cómo. Inversión de dependencias de la arquitectura hexagonal.
 *
 * <p>Todas las operaciones son «vivas»: nunca devuelven filas dadas de baja.
 */
public interface FloorRepository {

  /** Pisos vivos de un establecimiento, ordenados por nivel ascendente. */
  List<Floor> findAliveByEstablishmentId(TenantId tenantId, UUID establishmentId);

  /** Busca uno vivo por id. Vacío si no existe, está dado de baja o es de otro tenant. */
  Optional<Floor> findAliveById(TenantId tenantId, UUID id);

  /** Busca un piso vivo por su slug para detectar conflictos. */
  Optional<Floor> findAliveBySlug(TenantId tenantId, UUID establishmentId, Slug slug);

  /** Verifica si existe un piso con el nivel especificado (entre filas vivas). */
  boolean existsAliveByLevel(TenantId tenantId, UUID establishmentId, int level);

  /** Obtiene el nivel máximo de los pisos vivos del establecimiento. */
  Optional<Integer> findMaxLevel(TenantId tenantId, UUID establishmentId);

  /** Inserta o actualiza. La baja lógica también pasa por aquí. */
  Floor save(Floor floor);
}
