package com.mapit.identity.infrastructure;

import java.net.URI;

import org.springframework.http.CacheControl;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice
class AuthRateLimitAdvice {
  @ExceptionHandler(AuthRateLimited.class)
  ResponseEntity<ProblemDetail> handle(AuthRateLimited exception) {
    ProblemDetail problem = ProblemDetail.forStatusAndDetail(
        HttpStatus.TOO_MANY_REQUESTS, exception.getMessage());
    problem.setType(URI.create("https://mapit.local/problems/auth-rate-limited"));
    return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS)
        .header(HttpHeaders.RETRY_AFTER, Integer.toString(exception.retryAfter()))
        .cacheControl(CacheControl.noStore())
        .body(problem);
  }
}
