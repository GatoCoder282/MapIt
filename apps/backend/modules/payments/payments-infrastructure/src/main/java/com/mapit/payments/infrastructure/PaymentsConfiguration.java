package com.mapit.payments.infrastructure;

import java.time.Clock;
import java.util.Arrays;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.env.Environment;

import com.mapit.payments.application.MockQrConfigurationService;
import com.mapit.payments.application.PaymentMethodService;
import com.mapit.payments.application.PaymentPolicyService;
import com.mapit.payments.application.PaymentService;
import com.mapit.payments.domain.MockQrConfigurationRepository;
import com.mapit.payments.domain.PaymentConfigurationRepository;
import com.mapit.payments.domain.PaymentEventPublisherPort;
import com.mapit.payments.domain.PaymentGatewayPort;
import com.mapit.payments.domain.PaymentMethodRepository;
import com.mapit.payments.domain.PaymentRepository;
import com.mapit.payments.domain.PaymentReservationAccessPort;
import com.mapit.payments.domain.ReservationPaymentPort;
import com.mapit.shared.security.ActorContext;
import com.mapit.shared.tenant.TenantContext;

@Configuration
public class PaymentsConfiguration {
  @Bean
  com.mapit.payments.application.PaymentReadinessService paymentReadinessService(PaymentConfigurationRepository configuration,
      MockQrConfigurationRepository qr, PaymentMethodRepository methods, PaymentGatewayPort gateway, TenantContext tenants) {
    return new com.mapit.payments.application.PaymentReadinessService(configuration,qr,methods,gateway,tenants);
  }
  @Bean
  MockPaymentSettings mockPaymentSettings(Environment environment, Clock clock) { return new MockPaymentSettings(environment, clock); }

  @Bean
  MockQrConfigurationService mockQrConfigurationService(MockQrConfigurationRepository repository,
      PaymentConfigurationRepository configuration, PaymentMethodRepository methods,
      TenantContext tenants, ActorContext actors, Clock clock, MockPaymentSettings settings) {
    return new MockQrConfigurationService(repository, configuration, methods, tenants, actors, clock, settings.allowed());
  }

  @Bean
  PaymentGatewayPort paymentGatewayPort(MockPaymentSettings settings, Environment environment, Clock clock) {
    return settings.allowed() ? new MockPaymentGateway(true, java.util.Set.of(environment.getActiveProfiles()), clock)
        : new UnavailablePaymentGateway();
  }

  @Bean
  PaymentService paymentService(PaymentRepository repository, PaymentMethodRepository methods,
      ReservationPaymentPort reservations, PaymentGatewayPort gateway, TenantContext tenants, ActorContext actors,
      Clock clock, PaymentReservationAccessPort access, PaymentEventPublisherPort publisher) {
    return new PaymentService(repository, methods, reservations, gateway, tenants, actors, clock, access, publisher);
  }
  @Bean
  PaymentMethodService paymentMethodService(PaymentMethodRepository methods, TenantContext tenants,
      ActorContext actors, Clock clock, Environment environment,
      @Value("${mapit.payments.mock.enabled:false}") boolean enabled) {
    String[] profiles = environment.getActiveProfiles();
    boolean development = profiles.length > 0
        && Arrays.stream(profiles).allMatch(p -> p.equals("dev") || p.equals("test"));
    return new PaymentMethodService(methods, tenants, actors, clock, enabled && development);
  }

  @Bean
  PaymentPolicyService paymentPolicyService(PaymentConfigurationRepository configuration, PaymentMethodRepository methods,
      MockQrConfigurationService mockQrConfigurations, TenantContext tenants, ActorContext actors, Clock clock) {
    return new PaymentPolicyService(configuration, methods, mockQrConfigurations, tenants, actors, clock);
  }
}
