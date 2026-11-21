package com.mapit.platform.domain;

import java.time.Instant;

/** Persistencia de solicitudes previas a la creación de un tenant. */
public interface BusinessApplicationRepository {

  /** Inserta o renueva una solicitud pendiente sin verificar; devuelve si debe enviarse correo. */
  boolean savePending(BusinessApplication application, String tokenHash, Instant expiresAt);

  /** Consume atómicamente un token vigente; nunca devuelve datos del solicitante. */
  boolean verifyContact(String tokenHash, Instant now);
}
