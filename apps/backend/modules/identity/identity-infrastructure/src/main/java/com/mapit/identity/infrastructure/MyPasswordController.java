package com.mapit.identity.infrastructure;

import java.util.Map;

import jakarta.servlet.http.HttpServletRequest;

import org.jspecify.annotations.Nullable;
import org.springframework.dao.DataAccessException;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.transaction.TransactionException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import com.mapit.identity.application.ChangeOwnPassword;
import com.mapit.identity.application.OwnPasswordChangeFailure;
import com.mapit.identity.application.OwnProfileFailure;
import com.mapit.identity.domain.OwnPasswordRateLimited;

@RestController
public class MyPasswordController {
    private final ChangeOwnPassword passwords;

    public MyPasswordController(ChangeOwnPassword passwords) {
        this.passwords = passwords;
    }

    @PostMapping("/api/v1/me/password")
    public ResponseEntity<Void> change(HttpServletRequest request, @RequestBody Map<String, @Nullable Object> body) {
        var actor = MyAccountController.actor(request);
        passwords.execute(actor, OwnPasswordChangePayload.read(body), request.getRemoteAddr());
        return ResponseEntity.noContent().cacheControl(CacheControl.noStore()).build();
    }

    @ExceptionHandler(OwnProfileFailure.class)
    ResponseEntity<ProblemDetail> identity(OwnProfileFailure failure) {
        return MyAccountController.profileFailure(failure);
    }

    @ExceptionHandler({OwnPasswordChangeFailure.class, HttpMessageNotReadableException.class})
    ResponseEntity<ProblemDetail> invalid() {
        return MyAccountController.problem(HttpStatus.BAD_REQUEST, "invalid-request", "No se pudo validar el cambio de contraseña.");
    }

    @ExceptionHandler(OwnPasswordRateLimited.class)
    ResponseEntity<ProblemDetail> limited(OwnPasswordRateLimited failure) {
        var problem = MyAccountController.problem(HttpStatus.TOO_MANY_REQUESTS, "auth-rate-limited", "Demasiados intentos. Intente más tarde.");
        return ResponseEntity.status(429).headers(problem.getHeaders())
                .header("Retry-After", Integer.toString(failure.retryAfterSeconds())).body(problem.getBody());
    }

    @ExceptionHandler({DataAccessException.class, TransactionException.class})
    ResponseEntity<ProblemDetail> unavailable() {
        return MyAccountController.problem(HttpStatus.SERVICE_UNAVAILABLE, "password-change-unavailable",
                "No se pudo confirmar el cambio. Vuelva a autenticar su cuenta antes de reintentar.");
    }
}
