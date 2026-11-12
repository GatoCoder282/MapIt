package com.mapit.identity.infrastructure;

import java.net.URI;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.mapit.identity.application.InviteTenantUser;
import com.mapit.identity.application.ManageTenantUsers;
import com.mapit.identity.domain.AuthenticatedPrincipal;
import com.mapit.identity.domain.MemberInvitation;
import com.mapit.identity.domain.TenantUser;
import com.mapit.identity.domain.UserRole;

/** API de gestión de cuentas del tenant e invitaciones MEMBER de CU-25. */
@RestController
public class UsersController {
  private final ManageTenantUsers users;
  private final InviteTenantUser invitations;

  public UsersController(ManageTenantUsers users, InviteTenantUser invitations) {
    this.users = users;
    this.invitations = invitations;
  }

  @GetMapping("/api/v1/users")
  public ResponseEntity<ManageTenantUsers.Page> list(
      @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "20") int size) {
    return noStore(users.list(actor(), page, size));
  }

  @GetMapping("/api/v1/users/{userId}")
  public ResponseEntity<TenantUser> get(@PathVariable UUID userId) {
    return noStore(users.get(actor(), userId));
  }

  @PatchMapping("/api/v1/users/{userId}/role")
  public ResponseEntity<TenantUser> changeRole(
      @PathVariable UUID userId, @RequestBody Map<String, Object> body) {
    fields(body, Set.of("role", "expectedRole"));
    UserRole role = memberRole(body.get("role"));
    UserRole expected = memberRole(body.get("expectedRole"));
    return noStore(users.changeRole(actor(), userId, expected, role));
  }

  @PatchMapping("/api/v1/users/{userId}/access")
  public ResponseEntity<TenantUser> deactivate(
      @PathVariable UUID userId, @RequestBody Map<String, Object> body) {
    fields(body, Set.of("active"));
    if (!Boolean.FALSE.equals(body.get("active"))) {
      throw new ManageTenantUsers.BadRequest("Solo se admite active=false.");
    }
    return noStore(users.deactivate(actor(), userId));
  }

  @PostMapping("/api/v1/users")
  public ResponseEntity<InvitationResponse> invite(@RequestBody Map<String, Object> body) {
    fields(body, Set.of("email", "role"));
    if (!(body.get("email") instanceof String email) || email.isBlank() || email.length() > 254 ||
        !email.trim().matches("^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$")) {
      throw new ManageTenantUsers.BadRequest("Correo inválido.");
    }
    return accepted(invitations.issue(actor(), email, memberRole(body.get("role"))));
  }

  @PostMapping("/api/v1/user-invitations/{invitationId}/resend")
  public ResponseEntity<InvitationResponse> resend(@PathVariable UUID invitationId) {
    return accepted(invitations.resend(actor(), invitationId));
  }

  @GetMapping("/api/v1/user-invitations")
  public ResponseEntity<InvitationPage> listInvitations(
      @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "20") int size) {
    InviteTenantUser.Page result = invitations.list(actor(), page, size);
    return noStore(new InvitationPage(result.content().stream()
        .map(invitation -> invitationView(invitation, result.asOf())).toList(),
        result.page(), result.size(), result.totalElements(), result.totalPages()));
  }

  public record InvitationPage(java.util.List<Map<String, Object>> content, int page, int size,
      long totalElements, int totalPages) {}

  private static Map<String, Object> invitationView(MemberInvitation invitation, Instant asOf) {
    // Proyección explícita: nunca serializar la fila ni sus metadatos internos.
    Map<String, Object> view = new LinkedHashMap<>();
    view.put("id", invitation.id());
    view.put("email", invitation.email());
    view.put("role", invitation.role());
    view.put("status", asOf.isBefore(invitation.expiresAt()) ? "PENDING" : "EXPIRED");
    view.put("dispatchStatus", invitation.dispatchStatus());
    view.put("expiresAt", invitation.expiresAt());
    if (invitation.dispatchAttemptedAt() != null) view.put("dispatchAttemptedAt", invitation.dispatchAttemptedAt());
    return view;
  }

  public record InvitationResponse(UUID id, String email, UserRole role, String status,
      String dispatchStatus, java.time.Instant expiresAt) {}

  private static ResponseEntity<InvitationResponse> accepted(InviteTenantUser.Receipt invitation) {
    return ResponseEntity.accepted().cacheControl(CacheControl.noStore()).body(
        new InvitationResponse(invitation.id(), invitation.email(), invitation.role(), "PENDING",
            invitation.dispatchStatus().name(), invitation.expiresAt()));
  }

  private AuthenticatedPrincipal actor() {
    var authentication = SecurityContextHolder.getContext().getAuthentication();
    if (authentication == null || !(authentication.getPrincipal() instanceof AuthenticatedPrincipal principal)) {
      throw new ManageTenantUsers.Unauthenticated("Sesión no identificada.");
    }
    return principal;
  }

  private static void fields(Map<String, Object> body, Set<String> expected) {
    if (!body.keySet().equals(expected)) {
      throw new ManageTenantUsers.BadRequest("Propiedades obligatorias o desconocidas.");
    }
  }

  private static UserRole memberRole(Object value) {
    if (!(value instanceof String name)) throw new ManageTenantUsers.BadRequest("Rol inválido.");
    if (name.equals("ADMIN") || name.equals("SUPER_ADMIN")) {
      throw new ManageTenantUsers.Forbidden("No se permite gestionar ADMIN ni SUPER_ADMIN.");
    }
    try {
      return UserRole.valueOf(name);
    } catch (IllegalArgumentException exception) {
      throw new ManageTenantUsers.BadRequest("Rol inválido.");
    }
  }

  private static <T> ResponseEntity<T> noStore(T value) {
    return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(value);
  }

  @ExceptionHandler(ManageTenantUsers.Unauthenticated.class)
  ResponseEntity<ProblemDetail> unauthenticated(ManageTenantUsers.Unauthenticated exception) {
    return problem(HttpStatus.UNAUTHORIZED, exception.getMessage(), "unauthorized");
  }

  @ExceptionHandler(ManageTenantUsers.Forbidden.class)
  ResponseEntity<ProblemDetail> forbidden(ManageTenantUsers.Forbidden exception) {
    return problem(HttpStatus.FORBIDDEN, exception.getMessage(), "forbidden");
  }

  @ExceptionHandler(ManageTenantUsers.BadRequest.class)
  ResponseEntity<ProblemDetail> badRequest(ManageTenantUsers.BadRequest exception) {
    return problem(HttpStatus.BAD_REQUEST, exception.getMessage(), "invalid-request");
  }

  @ExceptionHandler(ManageTenantUsers.NotFound.class)
  ResponseEntity<ProblemDetail> notFound(ManageTenantUsers.NotFound exception) {
    return problem(HttpStatus.NOT_FOUND, exception.getMessage(), "not-found");
  }

  @ExceptionHandler(ManageTenantUsers.Conflict.class)
  ResponseEntity<ProblemDetail> conflict(ManageTenantUsers.Conflict exception) {
    return problem(HttpStatus.CONFLICT, exception.getMessage(), "conflict");
  }

  private static ResponseEntity<ProblemDetail> problem(HttpStatus status, String detail, String type) {
    ProblemDetail problem = ProblemDetail.forStatusAndDetail(status, detail);
    problem.setType(URI.create(LoginProblemTypes.BASE + type));
    return ResponseEntity.status(status).cacheControl(CacheControl.noStore()).body(problem);
  }

}
