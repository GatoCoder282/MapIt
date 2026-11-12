package com.mapit.identity.infrastructure;

import java.net.URI;
import java.time.Instant;
import java.util.UUID;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.mapit.identity.application.AuthenticateUser;
import com.mapit.identity.application.AuthenticateUserCommand;
import com.mapit.identity.application.IssueAccessToken;
import com.mapit.identity.domain.AuthenticatedUser;
import com.mapit.identity.domain.InvalidCredentialsException;
import com.mapit.identity.domain.IssuedAccessToken;
import com.mapit.identity.domain.UserRole;

/** MAP-48: entrada HTTP para autenticar al staff y emitir su access token. */
@RestController
@RequestMapping("/api/v1/auth")
public class LoginController {
  private final AuthenticateUser authenticateUser;
  private final IssueAccessToken issueAccessToken;
  private final AuthAttemptLimiter limiter;

  public LoginController(
      AuthenticateUser authenticateUser, IssueAccessToken issueAccessToken,
      AuthAttemptLimiter limiter) {
    this.authenticateUser = authenticateUser;
    this.issueAccessToken = issueAccessToken;
    this.limiter = limiter;
  }

  @PostMapping("/global-login")
  public ResponseEntity<LoginResponse> globalLogin(
      @Valid @RequestBody GlobalLoginRequest request, HttpServletRequest http) {
    limiter.check(http.getRemoteAddr(), request.email());
    var user = authenticateUser.execute(new AuthenticateUserCommand(request.email(), request.password()));
    var session = LoginResponse.from(user, issueAccessToken.execute(user));
    return ResponseEntity.ok().cacheControl(CacheControl.noStore())
        .body(session);
  }

  public record GlobalLoginRequest(
      @NotBlank @Email @Size(max = 254) String email, @NotBlank String password) {
    @Override
    public String toString() {
      return "GlobalLoginRequest[REDACTED]";
    }
  }

  @ExceptionHandler(InvalidCredentialsException.class)
  ResponseEntity<ProblemDetail> handleInvalidCredentials(InvalidCredentialsException exception) {
    ProblemDetail problem =
        ProblemDetail.forStatusAndDetail(HttpStatus.UNAUTHORIZED, exception.getMessage());
    problem.setTitle("Credenciales inválidas");
    problem.setType(URI.create(LoginProblemTypes.INVALID_CREDENTIALS));
    return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(problem);
  }

  @ExceptionHandler({
    MethodArgumentNotValidException.class,
    HttpMessageNotReadableException.class
  })
  ResponseEntity<ProblemDetail> handleInvalidRequest() {
    ProblemDetail problem =
        ProblemDetail.forStatusAndDetail(
            HttpStatus.BAD_REQUEST, "El cuerpo de la solicitud no es válido.");
    problem.setTitle("Solicitud inválida");
    problem.setType(URI.create(LoginProblemTypes.INVALID_REQUEST));
    return ResponseEntity.badRequest().body(problem);
  }

  /** Respuesta de login sin contraseña ni hash. */
  public record LoginResponse(
      String accessToken, String tokenType, Instant expiresAt, UserResponse user) {
    static LoginResponse from(AuthenticatedUser user, IssuedAccessToken token) {
      return new LoginResponse(token.value(), "Bearer", token.expiresAt(), UserResponse.from(user));
    }
  }

  /** Identidad pública que puede conservar el cliente. */
  public record UserResponse(
      UUID id, String tenantId, String email, String fullName, UserRole role) {
    static UserResponse from(AuthenticatedUser user) {
      return new UserResponse(
          user.id(), user.tenantId().value(), user.email(), user.fullName(), user.role());
    }
  }
}
