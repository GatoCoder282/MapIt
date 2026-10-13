package com.mapit.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import com.mapit.reservations.domain.reservation.ReservationAvailabilityRepository;
import com.mapit.spaces.domain.spaceelement.SpaceElementReservationLookup;

/**
 * Wiring entre módulos (regla: los módulos no se importan entre sí; solo bootstrap
 * los conoce a todos). Aquí el puerto de {@code spaces} que necesita saber si un
 * elemento tiene reservas activas lo implementa el puerto de {@code reservations}.
 */
@Configuration
public class SpacesWiring {

  @Bean
  SpaceElementReservationLookup spaceElementReservationLookup(
      ReservationAvailabilityRepository availability) {
    return (tenantId, elementId) ->
        availability.existsActiveForSpaceElement(tenantId, elementId.value());
  }
}
