package com.mapit.spaces.infrastructure.establishment;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.mapit.spaces.domain.establishment.EstablishmentAccessRepository.AccessibleEstablishment;

import tools.jackson.databind.module.SimpleModule;

@Configuration
public class EstablishmentAccessJsonConfiguration {
  @Bean SimpleModule establishmentAccessJsonModule(){
    SimpleModule module=new SimpleModule("mapit-establishment-access");
    module.setMixInAnnotation(AccessibleEstablishment.class,NullableAddress.class);
    return module;
  }
  @JsonInclude(JsonInclude.Include.ALWAYS)
  private abstract static class NullableAddress{}
}
