package com.mapit.identity.infrastructure;

import java.net.URI;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.mapit.identity.application.ActivateAdmin;
import com.mapit.identity.domain.ActivationExceptions.EmailAlreadyRegistered;
import com.mapit.identity.domain.ActivationExceptions.Expired;
import com.mapit.identity.domain.ActivationExceptions.Invalid;
import com.mapit.identity.domain.ActivationExceptions.PasswordMismatch;
import com.mapit.identity.domain.ActivationExceptions.Used;
import com.mapit.identity.domain.ActivationExceptions.WeakPassword;

/** Activación pública del primer ADMIN (CU-25). Público, stateless y sin cookies. */
@RestController
@RequestMapping("/api/v1/auth")
public class ActivationController {

  private static final String SLUG_PATTERN = "^[a-z0-9][a-z0-9-]{1,62}$";

  private final ActivateAdmin activateAdmin;

  public ActivationController(ActivateAdmin activateAdmin) {
    this.activateAdmin = activateAdmin;
  }

  @PostMapping("/activate")
  public ActivationResponse activate(@Valid @RequestBody ActivationRequest request) {
    String email =
        activateAdmin.execute(
            request.tenantSlug(), request.token(), request.password(), request.passwordConfirm());
    return new ActivationResponse(request.tenantSlug(), email);
  }

  @ExceptionHandler(Invalid.class)
  ResponseEntity<ProblemDetail> handleInvalid(Invalid exception) {
    return problem(HttpStatus.BAD_REQUEST, exception.getMessage(), "El enlace no es válido",
        "invitation-invalid");
  }

  @ExceptionHandler(Expired.class)
  ResponseEntity<ProblemDetail> handleExpired(Expired exception) {
    return problem(HttpStatus.BAD_REQUEST, exception.getMessage(), "El enlace caducó",
        "invitation-expired");
  }

  @ExceptionHandler(Used.class)
  ResponseEntity<ProblemDetail> handleUsed(Used exception) {
    return problem(HttpStatus.BAD_REQUEST, exception.getMessage(), "El enlace ya se utilizó",
        "invitation-used");
  }

  @ExceptionHandler(PasswordMismatch.class)
  ResponseEntity<ProblemDetail> handleMismatch(PasswordMismatch exception) {
    return problem(HttpStatus.BAD_REQUEST, exception.getMessage(), "Las contraseñas no coinciden",
        "password-mismatch");
  }

  @ExceptionHandler(WeakPassword.class)
  ResponseEntity<ProblemDetail> handleWeak(WeakPassword exception) {
    return problem(HttpStatus.BAD_REQUEST, exception.getMessage(), "Contraseña débil",
        "password-weak");
  }

  @ExceptionHandler(EmailAlreadyRegistered.class)
  ResponseEntity<ProblemDetail> handleDuplicate(EmailAlreadyRegistered exception) {
    return problem(HttpStatus.CONFLICT, exception.getMessage(), "Cuenta ya registrada",
        "email-already-registered");
  }

  private static ResponseEntity<ProblemDetail> problem(
      HttpStatus status, String detail, String title, String type) {
    ProblemDetail problem = ProblemDetail.forStatusAndDetail(status, detail);
    problem.setTitle(title);
    problem.setType(URI.create(LoginProblemTypes.BASE + type));
    return ResponseEntity.status(status).body(problem);
  }

  /** Body de activación; el token solo vive en memoria hasta el hash. */
  public record ActivationRequest(
      @NotBlank @Pattern(regexp = SLUG_PATTERN) @Size(min = 2, max = 63) String tenantSlug,
      @NotBlank @Size(min = 32, max = 200) String token,
      @NotBlank @Size(min = 8, max = 128) String password,
      @NotBlank @Size(min = 8, max = 128) String passwordConfirm) {}

  /** Respuesta de la activación: lo justo para redirigir al login del tenant. */
  public record ActivationResponse(String tenantSlug, String email) {}
}
