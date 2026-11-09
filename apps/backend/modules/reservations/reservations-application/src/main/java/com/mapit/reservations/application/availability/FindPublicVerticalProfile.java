package com.mapit.reservations.application.availability;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.mapit.reservations.domain.booking.PublicEstablishment;
import com.mapit.reservations.domain.booking.PublicReservationRepository;
import com.mapit.shared.vertical.Vertical;
import com.mapit.shared.vertical.VerticalCatalog;
import com.mapit.shared.vertical.VerticalGate;
import com.mapit.shared.vertical.VerticalProfileView;

/**
 * Perfil de vertical de un establecimiento público, resuelto solo por sus slugs (HU-7.01/7.02).
 *
 * <p>El portal lo necesita antes de buscar disponibilidad: un hotel pide llegada y salida, una
 * discoteca una noche. El tenant sale del slug validado, nunca de un parámetro del cliente.
 */
@Service
public class FindPublicVerticalProfile {

  private final PublicReservationRepository establishments;
  private final VerticalGate gate;

  public FindPublicVerticalProfile(PublicReservationRepository establishments, VerticalGate gate) {
    this.establishments = establishments;
    this.gate = gate;
  }

  /**
   * @throws PublicAvailabilityNotFoundException si el tenant no está activo o el establecimiento
   *     no existe en él
   */
  @Transactional(readOnly = true)
  public VerticalProfileView execute(String tenantSlug, String establishmentSlug) {
    PublicEstablishment establishment =
        establishments
            .findActiveEstablishment(tenantSlug, establishmentSlug)
            .orElseThrow(PublicAvailabilityNotFoundException::new);
    Vertical vertical = Vertical.of(establishment.vertical());
    return VerticalProfileView.of(
        VerticalCatalog.of(vertical), gate.isEnabled(vertical, establishment.tenantId()));
  }
}
