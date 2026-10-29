package com.mapit.reservations.infrastructure.history;

import java.time.Instant;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.mapit.reservations.application.history.CustomerHistory;
import com.mapit.reservations.application.history.CustomerHistoryLinks;
import com.mapit.reservations.application.history.HistoryIpLimiter;
import com.mapit.reservations.application.history.InvalidHistoryCredentialException;

@Validated
@RestController
@RequestMapping("/api/v1/public/tenants/{tenantSlug}")
public class CustomerHistoryController {
  private final CustomerHistoryLinks links;
  private final HistoryIpLimiter limiter;
  private final CustomerHistory history;

  public CustomerHistoryController(CustomerHistoryLinks links, HistoryIpLimiter limiter, CustomerHistory history) {
    this.links = links;
    this.limiter = limiter;
    this.history = history;
  }

  @PostMapping("/history-access-requests")
  public ResponseEntity<?> requestCustomerHistoryAccess(
      @PathVariable @Pattern(regexp = "^[a-z0-9][a-z0-9-]{1,62}$") String tenantSlug,
      @Valid @RequestBody AccessRequest body, HttpServletRequest request) {
    if (!limiter.allow(request.getRemoteAddr())) return rateLimited();
    links.request(tenantSlug, body.email());
    return ResponseEntity.accepted().cacheControl(CacheControl.noStore()).build();
  }

  @PostMapping("/history-sessions")
  public ResponseEntity<?> exchangeCustomerHistoryLink(
      @PathVariable @Pattern(regexp = "^[a-z0-9][a-z0-9-]{1,62}$") String tenantSlug,
      @Valid @RequestBody ExchangeRequest body, HttpServletRequest request) {
    if (!limiter.allow(request.getRemoteAddr())) return rateLimited();
    return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(links.exchange(tenantSlug, body.token()));
  }

  @GetMapping("/my-reservations")
  public ResponseEntity<CustomerHistory.Page> listMyReservations(
      @PathVariable @Pattern(regexp = "^[a-z0-9][a-z0-9-]{1,62}$") String tenantSlug,
      @RequestHeader(value = "X-Customer-History-Session", required = false) String session,
      @RequestHeader(value = "Authorization", required = false) String authorization,
      @RequestParam String period,
      @RequestParam(defaultValue = "20") int limit,
      @RequestParam(defaultValue = "0") int offset,
      @RequestParam(required = false) Instant asOf) {
    return ResponseEntity.ok().cacheControl(CacheControl.noStore())
        .body(history.list(tenantSlug, session, authorization, period, limit, offset, asOf));
  }

  @PostMapping("/history-sessions/revoke")
  public ResponseEntity<Void> revokeCustomerHistorySession(
      @PathVariable @Pattern(regexp = "^[a-z0-9][a-z0-9-]{1,62}$") String tenantSlug,
      @RequestHeader(value = "X-Customer-History-Session", required = false) String session,
      @RequestHeader(value = "Authorization", required = false) String authorization) {
    history.revoke(tenantSlug, session, authorization);
    return ResponseEntity.noContent().cacheControl(CacheControl.noStore()).build();
  }

  @ExceptionHandler(IllegalArgumentException.class)
  ResponseEntity<ProblemDetail> badArguments(IllegalArgumentException exception) {
    ProblemDetail problem = ProblemDetail.forStatus(HttpStatus.BAD_REQUEST);
    problem.setTitle("Parámetros de historial inválidos");
    return ResponseEntity.badRequest().cacheControl(CacheControl.noStore()).body(problem);
  }

  @ExceptionHandler(InvalidHistoryCredentialException.class)
  ResponseEntity<ProblemDetail> invalid(InvalidHistoryCredentialException exception) {
    ProblemDetail problem = ProblemDetail.forStatus(HttpStatus.UNAUTHORIZED);
    problem.setTitle("Credencial de historial no válida");
    return ResponseEntity.status(HttpStatus.UNAUTHORIZED).cacheControl(CacheControl.noStore()).body(problem);
  }

  private ResponseEntity<ProblemDetail> rateLimited() {
    ProblemDetail problem = ProblemDetail.forStatus(HttpStatus.TOO_MANY_REQUESTS);
    problem.setTitle("Demasiadas solicitudes");
    return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS)
        .cacheControl(CacheControl.noStore()).body(problem);
  }

  public record AccessRequest(@NotBlank @Email @Size(max = 254) String email) {}
  public record ExchangeRequest(@NotBlank @Size(min = 32, max = 200) String token) {}
}
