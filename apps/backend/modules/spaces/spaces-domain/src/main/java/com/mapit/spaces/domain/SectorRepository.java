package com.mapit.spaces.domain;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import com.mapit.shared.tenant.TenantId;

/** Puerto de persistencia de sectores.
 *
 * <p>Vive en el dominio porque es el dominio quien declara qué necesita guardar;
 * la infraestructura decide cómo. Inversión de dependencias de la arquitectura hexagonal.
 *
 * <p>Todas las operaciones son «vivas»: nunca devuelven sectores dados de baja.
 */
public interface SectorRepository {

  /** Sectores vivos de un piso, ordenados por nombre ascendente. */
  List<Sector> findAliveByFloorId(TenantId tenantId, UUID floorId);

  /** Busca un sector vivo por id. Vacío si no existe, está dado de baja o es de otro tenant. */
  Optional<Sector> findAliveById(TenantId tenantId, SectorId id);

  /** Busca un sector vivo por su slug para detectar conflictos. */
  Optional<Sector> findAliveBySlug(TenantId tenantId, UUID floorId, Slug slug);

  /** Inserta o actualiza. La baja lógica también pasa por aquí. */
  Sector save(Sector sector);
}
