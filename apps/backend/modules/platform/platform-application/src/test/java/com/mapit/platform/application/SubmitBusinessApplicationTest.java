package com.mapit.platform.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;

import org.junit.jupiter.api.Test;

import com.mapit.platform.domain.BusinessApplication;
import com.mapit.platform.domain.BusinessApplicationRateLimitPort;
import com.mapit.platform.domain.BusinessApplicationRepository;
import com.mapit.platform.domain.BusinessVertical;
import com.mapit.platform.domain.PlatformApplicationScope;
import com.mapit.shared.flags.FeatureFlag;
import com.mapit.shared.flags.FeatureFlagPort;

class SubmitBusinessApplicationTest {
  private static final Instant NOW = Instant.parse("2026-11-21T12:00:00Z");

  @Test
  void flag_apagada_no_persiste_ni_envia_correo() {
    var fixture = new Fixture(false);

    assertThatThrownBy(fixture::submit).isInstanceOf(BusinessApplicationsDisabled.class);

    assertThat(fixture.repository.saves).isZero();
    assertThat(fixture.emails).isZero();
    assertThat(fixture.rateChecks).isZero();
  }

  @Test
  void registra_pendiente_y_envia_enlace_solo_al_contacto() {
    var fixture = new Fixture(true);

    fixture.submit();

    assertThat(fixture.repository.saves).isEqualTo(1);
    assertThat(fixture.repository.application.tenantId()).isEqualTo(BusinessApplication.PLATFORM);
    assertThat(fixture.repository.application.contactEmail()).isEqualTo("ana@example.com");
    assertThat(fixture.repository.application.approvedTenantId()).isNull();
    assertThat(fixture.repository.expiresAt).isEqualTo(NOW.plusSeconds(86400));
    assertThat(fixture.repository.tokenHash).hasSize(64);
    assertThat(fixture.emails).isEqualTo(1);
    assertThat(fixture.emailUrl).startsWith("https://mapit.test/incorporacion/verificar#token=");
  }

  @Test
  void solicitud_pendiente_ya_verificada_responde_sin_reenviar() {
    var fixture = new Fixture(true);
    fixture.repository.shouldSend = false;

    fixture.submit();

    assertThat(fixture.repository.saves).isEqualTo(1);
    assertThat(fixture.emails).isZero();
  }

  @Test
  void verificacion_invalida_mantiene_respuesta_neutra() {
    var fixture = new Fixture(true);

    fixture.service.verifyContact("token-invalido", "127.0.0.1");

    assertThat(fixture.repository.verifications).isEqualTo(1);
    assertThat(fixture.repository.verified).isFalse();
  }

  private static class Fixture {
    final MemoryRepository repository = new MemoryRepository();
    final SubmitBusinessApplication service;
    int emails;
    int rateChecks;
    String emailUrl;

    Fixture(boolean enabled) {
      FeatureFlagPort flags = new FeatureFlagPort() {
        @Override public boolean isEnabled(FeatureFlag flag) { return enabled; }
        @Override public boolean isEnabled(FeatureFlag flag, boolean fallback) { return enabled; }
      };
      BusinessApplicationRateLimitPort limiter = new BusinessApplicationRateLimitPort() {
        @Override public void checkSubmission(String address, String email) { rateChecks++; }
        @Override public void checkVerification(String address) { rateChecks++; }
      };
      PlatformApplicationScope scope = () -> {};
      service = new SubmitBusinessApplication(
          flags, limiter, scope, repository,
          (recipient, business, url) -> { emails++; emailUrl = url; },
          new SecureTokenGenerator(), Clock.fixed(NOW, ZoneOffset.UTC), "https://mapit.test");
    }

    void submit() {
      service.submit("Hotel Norte", BusinessVertical.HOTEL, "Cochabamba", "Ana Pérez",
          " ANA@EXAMPLE.COM ", null, "127.0.0.1");
    }
  }

  private static class MemoryRepository implements BusinessApplicationRepository {
    @Override
    public com.mapit.platform.domain.BusinessApplicationPage search(
        String search, com.mapit.platform.domain.BusinessApplicationStatus status, int page, int size) {
      throw new UnsupportedOperationException();
    }

    @Override
    public java.util.Optional<BusinessApplication> findById(java.util.UUID id) {
      return java.util.Optional.empty();
    }
    BusinessApplication application;
    Instant expiresAt;
    String tokenHash;
    boolean shouldSend = true;
    boolean verified;
    int saves;
    int verifications;

    @Override public boolean savePending(BusinessApplication value, String hash, Instant expiry) {
      saves++;
      application = value;
      tokenHash = hash;
      expiresAt = expiry;
      return shouldSend;
    }

    @Override public boolean verifyContact(String hash, Instant now) {
      verifications++;
      return verified;
    }
  }
}
