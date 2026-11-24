package com.mapit.platform.application;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.UUID;

import org.jspecify.annotations.Nullable;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import com.mapit.platform.domain.BusinessApplication;
import com.mapit.platform.domain.BusinessApplicationRateLimitPort;
import com.mapit.platform.domain.BusinessApplicationRepository;
import com.mapit.platform.domain.BusinessApplicationVerificationEmailPort;
import com.mapit.platform.domain.BusinessVertical;
import com.mapit.platform.domain.PlatformApplicationScope;
import com.mapit.shared.flags.FeatureFlag;
import com.mapit.shared.flags.FeatureFlagPort;

/** Recibe solicitudes anónimas sin crear tenant ni exponer duplicados. */
@Service
public class SubmitBusinessApplication {

  private static final Duration VERIFICATION_TTL = Duration.ofHours(24);

  private final FeatureFlagPort flags;
  private final BusinessApplicationRateLimitPort limiter;
  private final PlatformApplicationScope scope;
  private final BusinessApplicationRepository repository;
  private final BusinessApplicationVerificationEmailPort email;
  private final SecureTokenGenerator tokens;
  private final Clock clock;
  private final String publicWebBaseUrl;

  public SubmitBusinessApplication(
      FeatureFlagPort flags,
      BusinessApplicationRateLimitPort limiter,
      PlatformApplicationScope scope,
      BusinessApplicationRepository repository,
      BusinessApplicationVerificationEmailPort email,
      SecureTokenGenerator tokens,
      Clock clock,
      @Value("${mapit.public-web-url:http://localhost:4300}") String publicWebBaseUrl) {
    this.flags = flags;
    this.limiter = limiter;
    this.scope = scope;
    this.repository = repository;
    this.email = email;
    this.tokens = tokens;
    this.clock = clock;
    this.publicWebBaseUrl = publicWebBaseUrl;
  }

  @Transactional
  public void submit(
      String businessName,
      BusinessVertical vertical,
      String location,
      String contactName,
      String contactEmail,
      @Nullable String contactPhone,
      String remoteAddress) {
    if (!flags.isEnabled(FeatureFlag.BUSINESS_APPLICATIONS)) {
      throw new BusinessApplicationsDisabled();
    }
    String normalizedEmail = contactEmail.strip().toLowerCase(java.util.Locale.ROOT);
    limiter.checkSubmission(remoteAddress, normalizedEmail);
    scope.enter();

    Instant now = clock.instant();
    BusinessApplication application = BusinessApplication.pending(
        UUID.randomUUID(), businessName, vertical, location, contactName, normalizedEmail,
        contactPhone, now);
    String rawToken = tokens.newToken();
    boolean sendEmail = repository.savePending(
        application, tokens.hash(rawToken), now.plus(VERIFICATION_TTL));
    if (sendEmail) {
      String url = publicWebBaseUrl + "/incorporacion/verificar#token=" + rawToken;
      if (TransactionSynchronizationManager.isSynchronizationActive()) {
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
          @Override
          public void afterCommit() {
            email.send(application.contactEmail(), application.businessName(), url);
          }
        });
      } else {
        email.send(application.contactEmail(), application.businessName(), url);
      }
    }
  }

  @Transactional
  public void verifyContact(String token, String remoteAddress) {
    limiter.checkVerification(remoteAddress);
    scope.enter();
    repository.verifyContact(tokens.hash(token), clock.instant());
  }
}
