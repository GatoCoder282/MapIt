package com.mapit.identity.infrastructure;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.mapit.identity.domain.PersonalProfile;

import tools.jackson.databind.module.SimpleModule;

/** Nulls obligatorios de OpenAPI para este perfil; conserva NON_NULL para los demás DTOs. */
@Configuration
public class PersonalProfileJsonConfiguration {
    @Bean
    SimpleModule personalProfileJsonModule() {
        var module = new SimpleModule("mapit-personal-profile-contract");
        module.setMixInAnnotation(PersonalProfile.class, NullableFields.class);
        return module;
    }

    @JsonInclude(JsonInclude.Include.ALWAYS)
    private abstract static class NullableFields {}
}
