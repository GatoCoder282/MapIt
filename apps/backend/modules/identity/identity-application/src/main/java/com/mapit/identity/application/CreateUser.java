package com.mapit.identity.application;

import java.util.UUID;

import org.springframework.dao.DuplicateKeyException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.mapit.identity.domain.AppUserCreator;
import com.mapit.identity.domain.AuthenticatedPrincipal;
import com.mapit.identity.domain.PasswordHasher;
import com.mapit.identity.domain.TenantDirectory;
import com.mapit.identity.domain.UserRole;
import com.mapit.shared.tenant.TenantId;

/**
 * Alta de usuarios de staff (CU-25 / MAP-185).
 *
 * <p>Matriz de autorización, aplicada aquí en Java y reforzada por la
 * configuración de seguridad:
 *
 * <ul>
 *   <li><b>SUPER_ADMIN</b> → puede crear ADMIN/MANAGER/STAFF; exige
 *       {@code tenantSlug} destino (la plataforma no es un tenant de negocio).
 *       Jamás puede crear otro SUPER_ADMIN por API.
 *   <li><b>ADMIN</b> → solo STAFF, siempre dentro de su tenant; un
 *       {@code tenantSlug} ajeno a su JWT devuelve 403.
 *   <li><b>MANAGER / STAFF</b> → 403 sin consultar la base.
 * </ul>
 *
 * El tenant jamás entra suelto por el body de un usuario normal: se deriva del
 * JWT, salvo el caso explícito del SUPER_ADMIN. El correo es único por tenant
 * (duplicado → conflicto). La contraseña viaja una vez y solo se persiste su
 * hash BCrypt.
 */
@Service
public class CreateUser {

  private final TenantDirectory tenants;
  private final AppUserCreator users;
  private final PasswordHasher passwordHasher;

  public CreateUser(TenantDirectory tenants, AppUserCreator users, PasswordHasher passwordHasher) {
    this.tenants = tenants;
    this.users = users;
    this.passwordHasher = passwordHasher;
  }

  @Transactional
  public CreatedUser execute(AuthenticatedPrincipal actor, CreateUserCommand command) {
    UserRole targetRole = UserRole.valueOf(command.role());
    if (targetRole == UserRole.SUPER_ADMIN) {
      throw new Forbidden("Crear un SUPER_ADMIN por API no está permitido.");
    }

    TenantId targetTenant;
    switch (actor.role()) {
      case SUPER_ADMIN -> {
        String slug = command.tenantSlug();
        if (slug == null || slug.isBlank()) {
          throw new BadRequest("El SUPER_ADMIN debe indicar el tenantSlug destino.");
        }
        targetTenant =
            tenants
                .findIdBySlug(slug.trim())
                .orElseThrow(() -> new BadRequest("No existe un tenant con ese slug."));
      }
      case ADMIN -> {
        if (targetRole != UserRole.STAFF) {
          throw new Forbidden("Un ADMIN solo puede crear usuarios STAFF.");
        }
        if (command.tenantSlug() != null && !command.tenantSlug().isBlank()) {
          // Solo se permite si indica explícitamente el suyo (idempotente).
          TenantId own = tenants.findIdBySlug(command.tenantSlug().trim())
              .orElseThrow(() -> new Forbidden("El tenant del cliente no es el tuyo."));
          if (!own.equals(actor.tenantId())) {
            throw new Forbidden("El tenant del cliente no es el tuyo.");
          }
        }
        targetTenant = actor.tenantId();
      }
      default -> throw new Forbidden("Este rol no puede crear usuarios.");
    }

    String email = command.email().trim().toLowerCase();
    String weakness = PasswordPolicy.validate(command.password());
    if (weakness != null) {
      throw new BadRequest(weakness);
    }

    UUID id;
    try {
      id =
          users.create(
              targetTenant,
              email,
              command.fullName().trim(),
              passwordHasher.hash(command.password()),
              targetRole);
    } catch (DuplicateKeyException duplicate) {
      throw new Conflict("Ya existe un usuario con ese correo en el tenant.");
    }
    return new CreatedUser(id, targetTenant.value(), email, command.fullName().trim(), targetRole.name());
  }

  /** Comando de entrada; role se valida contra el enum de dominio. */
  public record CreateUserCommand(
      String tenantSlug, String email, String fullName, String password, String role) {}

  /** Respuesta mínima, sin nada de la contraseña. */
  public record CreatedUser(UUID id, String tenantId, String email, String fullName, String role) {}

  /** Errores de dominio de la creación de usuarios. */
  public static class Forbidden extends RuntimeException {
    public Forbidden(String message) {
      super(message);
    }
  }

  public static class BadRequest extends RuntimeException {
    public BadRequest(String message) {
      super(message);
    }
  }

  public static class Conflict extends RuntimeException {
    public Conflict(String message) {
      super(message);
    }
  }
}
