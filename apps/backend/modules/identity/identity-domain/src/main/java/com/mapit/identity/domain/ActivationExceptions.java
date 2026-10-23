package com.mapit.identity.domain;

/** Excepciones del onboarding del primer ADMIN (CU-25). Los tipos Problem se asignan en el controlador. */
public final class ActivationExceptions {

  private ActivationExceptions() {}

  /** El token no existe o está mal formado (o el tenant del enlace no coincide). */
  public static final class Invalid extends RuntimeException {
    public Invalid() {
      super("El enlace de activación no es válido.");
    }
  }

  /** El token existe pero ya caducó (24 h). */
  public static final class Expired extends RuntimeException {
    public Expired() {
      super("El enlace de activación caducó.");
    }
  }

  /** El token ya se utilizó. */
  public static final class Used extends RuntimeException {
    public Used() {
      super("El enlace de activación ya se utilizó.");
    }
  }

  /** La contraseña no cumple las reglas mínimas del dominio. */
  public static final class WeakPassword extends RuntimeException {
    public WeakPassword(String reason) {
      super(reason);
    }
  }

  /** La confirmación no coincide con la contraseña. */
  public static final class PasswordMismatch extends RuntimeException {
    public PasswordMismatch() {
      super("La contraseña y su confirmación no coinciden.");
    }
  }

  /** Ya existe una cuenta con ese correo en el tenant. */
  public static final class EmailAlreadyRegistered extends RuntimeException {
    public EmailAlreadyRegistered() {
      super("Ya existe una cuenta con este correo.");
    }
  }
}
