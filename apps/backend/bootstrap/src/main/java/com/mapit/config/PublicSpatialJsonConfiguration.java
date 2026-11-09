package com.mapit.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.mapit.reservations.domain.availability.PublicAvailabilityMap;
import com.mapit.spaces.application.spaceelement.SpaceElementResponse;

import tools.jackson.databind.module.SimpleModule;

/** Null explícito del contrato, sin cambiar la política global de serialización. */
@Configuration
public class PublicSpatialJsonConfiguration {
  @Bean
  SimpleModule publicSpatialJsonModule() {
    var module = new SimpleModule("mapit-spatial-contract");
    module.setMixInAnnotation(SpaceElementResponse.class, NullableFields.class);
    module.setMixInAnnotation(PublicAvailabilityMap.class, NullableFields.class);
    module.setMixInAnnotation(PublicAvailabilityMap.Element.class, NullableFields.class);
    // HU-7.01/7.02: el perfil declara obligatorios los campos que son nulos según el modo.
    module.setMixInAnnotation(com.mapit.shared.vertical.VerticalProfileView.class, NullableFields.class);
    module.setMixInAnnotation(com.mapit.reservations.domain.booking.ReservationAccessView.Space.class, NullableFields.class);
    return module;
  }
  @JsonInclude(JsonInclude.Include.ALWAYS)
  private abstract static class NullableFields {}
}
