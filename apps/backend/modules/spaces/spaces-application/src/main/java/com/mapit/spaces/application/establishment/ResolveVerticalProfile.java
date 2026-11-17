package com.mapit.spaces.application.establishment;

import java.util.UUID;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.mapit.shared.tenant.TenantContext;
import com.mapit.shared.tenant.TenantId;
import com.mapit.shared.vertical.Vertical;
import com.mapit.shared.vertical.VerticalCatalog;
import com.mapit.shared.vertical.VerticalGate;
import com.mapit.shared.vertical.VerticalProfile;
import com.mapit.spaces.application.spaceelement.SpaceElementSupport;
import com.mapit.spaces.domain.establishment.EstablishmentRepository;
import com.mapit.spaces.domain.establishment.EstablishmentType;
import com.mapit.spaces.domain.sector.SectorId;

/**
 * Resuelve la vertical operativa de un establecimiento (HU-7.01/7.02, spec D1).
 *
 * <p>La vertical es siempre el {@code type} persistido del establecimiento leído con el tenant
 * del contexto; la de tenant no interviene. Unleash solo aporta {@code enabled}.
 */
@Service
public class ResolveVerticalProfile {

  private final EstablishmentRepository establishments;
  private final SpaceElementSupport support;
  private final TenantContext tenantContext;
  private final VerticalGate gate;

  public ResolveVerticalProfile(
      EstablishmentRepository establishments,
      SpaceElementSupport support,
      TenantContext tenantContext,
      VerticalGate gate) {
    this.establishments = establishments;
    this.support = support;
    this.tenantContext = tenantContext;
    this.gate = gate;
  }

  /**
   * @throws EstablishmentNotFoundException si no existe o es de otro tenant
   */
  @Transactional(readOnly = true)
  public Resolved forEstablishment(UUID establishmentId) {
    TenantId tenantId = tenantContext.require();
    EstablishmentType type =
        establishments
            .findAliveById(tenantId, establishmentId)
            .orElseThrow(() -> new EstablishmentNotFoundException(establishmentId))
            .type();
    return resolve(type, tenantId);
  }

  /**
   * @throws com.mapit.spaces.application.sector.SectorNotFoundException si el sector no existe
   *     o es de otro tenant
   */
  @Transactional(readOnly = true)
  public Resolved forSector(UUID sectorId) {
    TenantId tenantId = tenantContext.require();
    return resolve(support.verticalDelSector(tenantId, SectorId.of(sectorId)), tenantId);
  }

  private Resolved resolve(EstablishmentType type, TenantId tenantId) {
    Vertical vertical = Vertical.of(type.name());
    return new Resolved(VerticalCatalog.of(vertical), gate.isEnabled(vertical, tenantId));
  }

  /** Perfil del catálogo más el estado de la flag para el tenant. */
  public record Resolved(VerticalProfile profile, boolean enabled) {}
}
