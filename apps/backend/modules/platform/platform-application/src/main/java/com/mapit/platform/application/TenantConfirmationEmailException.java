package com.mapit.platform.application;

/** Error controlado al entregar la confirmación del registro. */
public class TenantConfirmationEmailException extends RuntimeException {

  public TenantConfirmationEmailException(Throwable cause) {
    super("No se pudo enviar el correo de confirmación del tenant", cause);
  }
}
