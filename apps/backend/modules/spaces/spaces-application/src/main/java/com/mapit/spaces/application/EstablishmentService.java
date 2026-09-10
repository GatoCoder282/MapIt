package com.mapit.spaces.application;

import java.time.Clock;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.mapit.shared.tenant.TenantContext;
import com.mapit.shared.tenant.TenantId;
import com.mapit.spaces.domain.Establishment;
import com.mapit.spaces.domain.EstablishmentRepository;
import com.mapit.spaces.domain.EstablishmentType;
import com.mapit.spaces.domain.Slug;

/**
 * Casos de uso de gestión de establecimientos (CU-04).
 *
 * <p>El {@code tenantId} sale siempre del {@link TenantContext} del servidor y nunca del
 * cuerpo de la petición (RN-2): si el cliente lo enviara, se ignora.
 *
 * <p>El {@link Clock} se inyecta en vez de llamar a {@code Instant.now()} para que los
 * tests puedan congelar el tiempo y verificar las marcas de auditoría.
 */
@Service
public class EstablishmentService {

  private final EstablishmentRepository repository;
  private final TenantContext tenantContext;
  private final Clock clock;

  public EstablishmentService(
      EstablishmentRepository repository, TenantContext tenantContext, Clock clock) {
    this.repository = repository;
    this.tenantContext = tenantContext;
    this.clock = clock;
  }

  @Transactional(readOnly = true)
  public List<Establishment> findAll() {
    return repository.findAllAlive(tenantContext.require());
  }

  @Transactional(readOnly = true)
  public Establishment findById(UUID id) {
    return repository
        .findAliveById(tenantContext.require(), id)
        .orElseThrow(() -> new EstablishmentNotFoundException(id));
  }

  @Transactional
  public Establishment create(String name, EstablishmentType type, Slug slug, String timezone) {
    TenantId tenantId = tenantContext.require();
    requireSlugLibre(tenantId, slug, null);

    Instant now = clock.instant();
    Establishment establishment =
        Establishment.register(
            UUID.randomUUID(), tenantId, name, type, slug, timezone, now, autorActual());
    return repository.save(establishment);
  }

  /**
   * Actualiza los datos editables. El tipo no se toca: es inmutable tras la creación (RN-3)
   * y por eso ni siquiera es parámetro.
   */
  @Transactional
  public Establishment update(UUID id, String name, Slug slug, String timezone) {
    TenantId tenantId = tenantContext.require();
    Establishment actual =
        repository
            .findAliveById(tenantId, id)
            .orElseThrow(() -> new EstablishmentNotFoundException(id));

    requireSlugLibre(tenantId, slug, id);

    return repository.save(
        actual.update(name, slug, timezone, clock.instant(), autorActual()));
  }

  /** Da de baja lógicamente. La fila se conserva; deja de aparecer y libera su slug. */
  @Transactional
  public void softDelete(UUID id) {
    TenantId tenantId = tenantContext.require();
    Establishment actual =
        repository
            .findAliveById(tenantId, id)
            .orElseThrow(() -> new EstablishmentNotFoundException(id));

    repository.save(actual.softDelete(clock.instant(), autorActual()));
  }

  /**
   * Comprueba que el slug esté libre entre las filas vivas del tenant.
   *
   * @param idPropio identificador que se está actualizando, o {@code null} al crear. Sirve
   *     para no dar conflicto cuando un establecimiento conserva su propio slug.
   */
  private void requireSlugLibre(TenantId tenantId, Slug slug, UUID idPropio) {
    Optional<Establishment> duenio = repository.findAliveBySlug(tenantId, slug);
    if (duenio.isPresent() && !duenio.get().id().equals(idPropio)) {
      throw new EstablishmentSlugAlreadyExistsException(slug.value());
    }
  }

  /**
   * Autor de la operación.
   *
   * <p>Devuelve {@code null} hasta CU-23/CU-24: sin autenticación no hay usuario que
   * registrar. Cuando exista {@code app_user}, este método leerá el identificador del
   * usuario autenticado y las columnas de auditoría dejarán de ser nulas.
   */
  private UUID autorActual() {
    return null;
  }
}
