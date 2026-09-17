package com.mapit.platform.application;

import java.time.Clock;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.mapit.platform.domain.AdminInvitationEmailPort;
import com.mapit.platform.domain.InvitationToken;
import com.mapit.platform.domain.InvitationTokenRepository;
import com.mapit.platform.domain.Tenant;
import com.mapit.platform.domain.TenantPage;
import com.mapit.platform.domain.TenantRepository;
import com.mapit.platform.domain.TenantStatus;
import com.mapit.shared.tenant.TenantId;

/** Casos de uso de administración de tenants (CU-01, CU-03, CU-25). */
@Service
public class TenantService {

  /** Tope de paginación alineado con el contrato (size <= 100). Público porque el controlador lo reutiliza en la validación de la petición. */
  public static final int MAX_PAGE_SIZE = 100;

  private final TenantRepository repository;
  private final InvitationTokenRepository invitations;
  private final AdminInvitationEmailPort invitationEmail;
  private final SecureTokenGenerator tokens;
  private final Clock clock;
  private final String publicWebBaseUrl;

  public TenantService(
      TenantRepository repository,
      InvitationTokenRepository invitations,
      AdminInvitationEmailPort invitationEmail,
      SecureTokenGenerator tokens,
      Clock clock,
      @Value("${mapit.public-web-url:http://localhost:4300}") String publicWebBaseUrl) {
    this.repository = repository;
    this.invitations = invitations;
    this.invitationEmail = invitationEmail;
    this.tokens = tokens;
    this.clock = clock;
    this.publicWebBaseUrl = publicWebBaseUrl;
  }

  /**
   * CU-01 + CU-25: registra el tenant y emite la invitación del primer ADMIN,
   * todo en la misma transacción. Si el correo falla, no queda ni tenant ni
   * invitación a medias.
   */
  @Transactional
  public Tenant register(RegisterTenantCommand command) {
    String slug = command.slug().trim();
    if (repository.existsBySlug(slug)) {
      throw new TenantSlugAlreadyExistsException(slug);
    }

    Tenant tenant = repository.save(
        Tenant.register(
            TenantId.generate(), command.name(), slug, command.vertical(), clock.instant()));

    // Invitación del primer ADMIN: token en claro solo para el enlace del correo;
    // en la base queda únicamente su hash.
    String rawToken = tokens.newToken();
    invitations.save(
        InvitationToken.issue(
            tenant.id(), command.administratorEmail(), tokens.hash(rawToken), clock.instant()));
    String activationUrl =
        publicWebBaseUrl + "/activar?tenant=" + slug + "&token=" + rawToken;
    try {
      invitationEmail.send(tenant, command.administratorEmail(), activationUrl);
    } catch (RuntimeException exception) {
      throw new TenantConfirmationEmailException(exception);
    }
    return tenant;
  }

  /** Listado paginado para la consola de plataforma (solo SUPER_ADMIN). */
  @Transactional(readOnly = true)
  public TenantPage search(String search, TenantStatus status, int page, int size) {
    if (page < 0) {
      throw new IllegalArgumentException("La página debe ser un entero mayor o igual a 0");
    }
    if (size < 1 || size > MAX_PAGE_SIZE) {
      throw new IllegalArgumentException("El tamaño de página debe estar entre 1 y 100");
    }
    return repository.search(search, status, page, size);
  }

  /** Detalle de un tenant; lanza 404 semántico si no existe. */
  @Transactional(readOnly = true)
  public Tenant detail(String id) {
    return repository.findById(TenantId.of(id)).orElseThrow(() -> new TenantNotFoundException(id));
  }

  /** Edición parcial: solo nombre y estado. Slug y vertical son inmutables. */
  @Transactional
  public Tenant update(UpdateTenantCommand command) {
    Tenant tenant =
        repository
            .findById(TenantId.of(command.id()))
            .orElseThrow(() -> new TenantNotFoundException(command.id()));
    if (command.name() != null) {
      tenant = tenant.rename(command.name(), clock.instant());
    }
    if (command.status() != null) {
      tenant = tenant.changeStatus(command.status(), clock.instant());
    }
    return repository.save(tenant);
  }
}
