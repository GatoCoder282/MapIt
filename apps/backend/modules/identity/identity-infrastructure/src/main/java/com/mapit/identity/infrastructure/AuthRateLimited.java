package com.mapit.identity.infrastructure;

final class AuthRateLimited extends RuntimeException {
  private final int retryAfter;

  AuthRateLimited(int retryAfter) {
    super("Demasiados intentos. Intenta nuevamente más tarde.");
    this.retryAfter = retryAfter;
  }

  int retryAfter() {
    return retryAfter;
  }
}
