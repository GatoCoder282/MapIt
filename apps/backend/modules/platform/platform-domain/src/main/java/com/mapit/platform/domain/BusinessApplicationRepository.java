package com.mapit.platform.domain;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

import org.jspecify.annotations.Nullable;

/** Persistencia de solicitudes previas a la creación de un tenant. */
public interface BusinessApplicationRepository {

  /** Inserta o renueva una solicitud pendiente sin verificar; devuelve si debe enviarse correo. */
  boolean savePending(BusinessApplication application, String tokenHash, Instant expiresAt);

  /** Consume atómicamente un token vigente; nunca devuelve datos del solicitante. */
  boolean verifyContact(String tokenHash, Instant now);

  BusinessApplicationPage search(@Nullable String search, @Nullable BusinessApplicationStatus status, int page, int size);

  Optional<BusinessApplication> findById(UUID id);

  /** Bloquea una solicitud durante toda la transacción de decisión. */
  Optional<BusinessApplication> findByIdForUpdate(UUID id);

  void saveDecision(BusinessApplication application);
}
