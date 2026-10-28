package com.mapit.reservations.domain.history;

/** Entrega el enlace al correo verificado sin acoplar el caso de uso a SMTP. */
public interface CustomerHistoryMail {
  void send(String email, String link);
}
