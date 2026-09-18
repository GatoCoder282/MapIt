package com.mapit.platform.infrastructure.flags;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import io.getunleash.DefaultUnleash;
import io.getunleash.Unleash;
import io.getunleash.util.UnleashConfig;

/** Construye el SDK externo detrás del adaptador de feature flags. */
@Configuration
@ConditionalOnProperty(
    prefix = "mapit.unleash", name = "enabled", havingValue = "true", matchIfMissing = true)
public class UnleashFeatureFlagConfiguration {

  @Bean(destroyMethod = "shutdown")
  Unleash unleash(
      @Value("${mapit.unleash.url}") String url,
      @Value("${mapit.unleash.api-token}") String apiToken,
      @Value("${mapit.unleash.app-name}") String appName,
      @Value("${mapit.unleash.environment}") String environment) {
    UnleashConfig config =
        UnleashConfig.builder()
            .unleashAPI(url)
            .apiKey(apiToken)
            .appName(appName)
            .environment(environment)
            .synchronousFetchOnInitialisation(false)
            .build();
    return new DefaultUnleash(config);
  }
}
