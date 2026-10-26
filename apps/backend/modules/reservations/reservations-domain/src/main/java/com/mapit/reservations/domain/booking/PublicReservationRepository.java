package com.mapit.reservations.domain.booking;

import java.util.Optional;

/** Puerto de lectura pública que resuelve el tenant y el establecimiento por sus slugs. */
public interface PublicReservationRepository {

  Optional<PublicEstablishment> findActiveEstablishment(
      String tenantSlug, String establishmentSlug);
}
