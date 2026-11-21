package com.mapit.identity.infrastructure;

import java.net.URI;
import java.util.Collections;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;

import jakarta.servlet.http.HttpServletRequest;

import org.jspecify.annotations.Nullable;
import org.springframework.dao.DataAccessException;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.transaction.TransactionException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import com.mapit.identity.application.OwnProfileFailure;
import com.mapit.identity.application.OwnProfileFailure.Reason;
import com.mapit.identity.application.OwnProfileService;
import com.mapit.identity.domain.AuthenticatedPrincipal;
import com.mapit.identity.domain.PersonalProfile;

/** API personal parcial: nombre/correo reales; contacto e idioma esperan migración. */
@RestController
public class MyAccountController {
    private static final Set<String> FIELDS = Set.of("fullName", "contactPhone", "preferredLanguage");
    private static final Set<String> LANGUAGES = Set.of("es", "en", "ja-JP");
    private static final Set<String> IDENTITY_HEADERS = Set.of(
            "x-tenant-id", "x-user-id", "x-tenant-slug", "tenantid", "userid", "tenantslug", "x-role");
    private static final Pattern PHONE = Pattern.compile("^[+0-9() ./-]*[0-9][+0-9() ./-]*$");
    private final OwnProfileService profiles;

    public MyAccountController(OwnProfileService profiles) {
        this.profiles = profiles;
    }

    @GetMapping("/api/v1/me")
    public ResponseEntity<PersonalProfile> read(HttpServletRequest request) {
        return ok(profiles.read(actor(request)));
    }

    @PatchMapping("/api/v1/me")
    public ResponseEntity<PersonalProfile> update(HttpServletRequest request,
            @RequestBody Map<String, @Nullable Object> body) {
        var actor = actor(request);
        if (body.isEmpty() || !FIELDS.containsAll(body.keySet())) invalid();
        @Nullable String name = null;
        if (body.containsKey("fullName")) {
            if (!(body.get("fullName") instanceof String)) invalid();
            name = (String) body.get("fullName");
            OwnProfileService.validateFullName(name);
        }
        Object phone = body.get("contactPhone");
        if (phone != null && (!(phone instanceof String text) || text.length() > 32 || !PHONE.matcher(text).matches())) invalid();
        Object language = body.get("preferredLanguage");
        if (language != null && (!(language instanceof String text) || !LANGUAGES.contains(text))) invalid();
        if (body.containsKey("contactPhone") || body.containsKey("preferredLanguage")) {
            profiles.read(actor); // Identidad/permiso y flag antes del error de disponibilidad.
            throw new OwnProfileFailure(Reason.FIELDS_UNAVAILABLE);
        }
        return ok(profiles.updateFullName(actor, name));
    }

    private static AuthenticatedPrincipal actor(HttpServletRequest request) {
        var authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !authentication.isAuthenticated()
                || !(authentication.getPrincipal() instanceof AuthenticatedPrincipal)) {
            throw new OwnProfileFailure(Reason.UNAUTHENTICATED);
        }
        if (!request.getParameterMap().isEmpty() || Collections.list(request.getHeaderNames()).stream()
                .map(name -> name.toLowerCase(Locale.ROOT)).anyMatch(IDENTITY_HEADERS::contains)) invalid();
        return (AuthenticatedPrincipal) authentication.getPrincipal();
    }

    private static void invalid() { throw new OwnProfileFailure(Reason.INVALID_REQUEST); }

    private static ResponseEntity<PersonalProfile> ok(PersonalProfile profile) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(profile);
    }

    @ExceptionHandler(OwnProfileFailure.class)
    ResponseEntity<ProblemDetail> failure(OwnProfileFailure failure) {
        HttpStatus status = switch (failure.reason()) {
            case UNAUTHENTICATED -> HttpStatus.UNAUTHORIZED;
            case FORBIDDEN -> HttpStatus.FORBIDDEN;
            case DISABLED -> HttpStatus.NOT_FOUND;
            case INVALID_REQUEST -> HttpStatus.BAD_REQUEST;
            case FIELDS_UNAVAILABLE -> HttpStatus.SERVICE_UNAVAILABLE;
            case CONFLICT -> HttpStatus.CONFLICT;
        };
        String code = switch (failure.reason()) {
            case UNAUTHENTICATED -> "profile-session-invalid";
            case FORBIDDEN -> "profile-forbidden";
            case DISABLED -> "my-account-disabled";
            case INVALID_REQUEST -> "invalid-request";
            case FIELDS_UNAVAILABLE -> "profile-fields-unavailable";
            case CONFLICT -> "profile-conflict";
        };
        return problem(status, code, failure.getMessage());
    }

    @ExceptionHandler(HttpMessageNotReadableException.class)
    ResponseEntity<ProblemDetail> malformedBody() {
        return failure(new OwnProfileFailure(Reason.INVALID_REQUEST));
    }

    @ExceptionHandler({DataAccessException.class, TransactionException.class})
    ResponseEntity<ProblemDetail> persistenceUnavailable() {
        return problem(HttpStatus.SERVICE_UNAVAILABLE, "profile-unavailable", "No se pudo acceder al perfil; no se confirmó ningún cambio.");
    }

    private static ResponseEntity<ProblemDetail> problem(HttpStatus status, String code, String detail) {
        var problem = ProblemDetail.forStatusAndDetail(status, detail);
        problem.setTitle(status.getReasonPhrase());
        problem.setType(URI.create(LoginProblemTypes.BASE + code));
        return ResponseEntity.status(status).cacheControl(CacheControl.noStore()).body(problem);
    }
}
