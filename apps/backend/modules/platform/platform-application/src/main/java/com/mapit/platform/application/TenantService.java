package com.mapit.platform.application;

import java.time.Clock;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.mapit.platform.domain.Tenant;
import com.mapit.platform.domain.TenantConfirmationEmailPort;
import com.mapit.platform.domain.TenantRepository;
import com.mapit.shared.tenant.TenantId;

/** Caso de uso de registro de empresas de la plataforma. */
@Service
public class TenantService {

  private final TenantRepository repository;
  private final TenantConfirmationEmailPort confirmationEmail;
  private final Clock clock;

  public TenantService(
      TenantRepository repository, TenantConfirmationEmailPort confirmationEmail, Clock clock) {
    this.repository = repository;
    this.confirmationEmail = confirmationEmail;
    this.clock = clock;
  }

  /** Genera el identificador y registra un tenant activo. */
  @Transactional
  public Tenant register(RegisterTenantCommand command) {
    String slug = command.slug().trim();
    if (repository.existsBySlug(slug)) {
      throw new TenantSlugAlreadyExistsException(slug);
    }

    Tenant tenant = repository.save(
        Tenant.register(
            TenantId.generate(), command.name(), slug, command.vertical(), clock.instant()));
    try {
      confirmationEmail.send(tenant, command.administratorEmail());
    } catch (RuntimeException exception) {
      throw new TenantConfirmationEmailException(exception);
    }
    return tenant;
  }
}
