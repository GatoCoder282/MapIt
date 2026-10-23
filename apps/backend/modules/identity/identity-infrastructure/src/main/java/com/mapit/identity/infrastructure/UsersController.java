package com.mapit.identity.infrastructure;

import java.net.URI;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import com.mapit.identity.application.CreateUser;
import com.mapit.identity.application.CreateUser.BadRequest;
import com.mapit.identity.application.CreateUser.Conflict;
import com.mapit.identity.application.CreateUser.CreatedUser;
import com.mapit.identity.application.CreateUser.Forbidden;
import com.mapit.identity.domain.AuthenticatedPrincipal;

/** Alta de usuarios de staff (CU-25). La autorización real vive en CreateUser. */
@RestController
@RequestMapping("/api/v1/users")
public class UsersController {

  private static final String SLUG_PATTERN = "^[a-z0-9][a-z0-9-]{1,62}$";

  private final CreateUser createUser;

  public UsersController(CreateUser createUser) {
    this.createUser = createUser;
  }

  @PostMapping
  @ResponseStatus(HttpStatus.CREATED)
  public UserResponse create(@Valid @RequestBody CreateUserRequest request) {
    Object principal = SecurityContextHolder.getContext().getAuthentication().getPrincipal();
    if (!(principal instanceof AuthenticatedPrincipal actor)) {
      // No debería ocurrir: la cadena de seguridad ya intercepta la falta de JWT.
      throw new Forbidden("Sesión no identificada.");
    }
    CreatedUser created =
        createUser.execute(
            actor,
            new CreateUser.CreateUserCommand(
                request.tenantSlug(), request.email(), request.fullName(), request.password(), request.role()));
    return new UserResponse(
        created.id(), created.tenantId(), created.email(), created.fullName(), created.role());
  }

  @ExceptionHandler(Forbidden.class)
  ResponseEntity<ProblemDetail> handleForbidden(Forbidden exception) {
    return problem(HttpStatus.FORBIDDEN, exception.getMessage(), "Sin permiso", "forbidden");
  }

  @ExceptionHandler(BadRequest.class)
  ResponseEntity<ProblemDetail> handleBadRequest(BadRequest exception) {
    return problem(HttpStatus.BAD_REQUEST, exception.getMessage(), "Solicitud inválida", "invalid-request");
  }

  @ExceptionHandler(Conflict.class)
  ResponseEntity<ProblemDetail> handleConflict(Conflict exception) {
    return problem(HttpStatus.CONFLICT, exception.getMessage(), "Correo duplicado", "email-already-registered");
  }

  private static ResponseEntity<ProblemDetail> problem(
      HttpStatus status, String detail, String title, String type) {
    ProblemDetail problem = ProblemDetail.forStatusAndDetail(status, detail);
    problem.setTitle(title);
    problem.setType(URI.create(LoginProblemTypes.BASE + type));
    return ResponseEntity.status(status).body(problem);
  }

  /** Body del alta; el tenant_slug es opcional y solo lo usa SUPER_ADMIN. */
  public record CreateUserRequest(
      @Pattern(regexp = SLUG_PATTERN) @Size(min = 2, max = 63) String tenantSlug,
      @NotBlank @Email @Size(max = 254) String email,
      @NotBlank @Size(min = 1, max = 120) String fullName,
      @NotBlank @Size(min = 8, max = 128) String password,
      @NotBlank String role) {}

  /** Nunca devuelve password_hash ni datos ajenos. */
  public record UserResponse(java.util.UUID id, String tenantId, String email, String fullName, String role) {}
}
