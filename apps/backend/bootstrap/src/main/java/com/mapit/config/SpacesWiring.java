package com.mapit.config;

import java.util.Set;
import java.util.UUID;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import com.mapit.reservations.domain.reservation.ReservationAvailabilityRepository;
import com.mapit.reservations.domain.reservation.ReservationConcurrencyGuard;
import com.mapit.shared.tenant.TenantId;
import com.mapit.spaces.domain.spaceelement.SpaceElementId;
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
      ReservationAvailabilityRepository availability, ReservationConcurrencyGuard reservations) {
    return new SpaceElementReservationLookup() {
      @Override
      public void lockResources(TenantId tenantId, Set<UUID> elementIds) {
        reservations.lockResources(tenantId, elementIds);
      }

      @Override
      public boolean hasActiveReservations(TenantId tenantId, SpaceElementId elementId) {
        return availability.existsActiveForSpaceElement(tenantId, elementId.value());
      }
    };
  }
}
