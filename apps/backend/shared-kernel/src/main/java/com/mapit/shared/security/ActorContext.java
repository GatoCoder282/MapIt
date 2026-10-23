package com.mapit.shared.security;

import java.util.Optional;
import java.util.UUID;

/** Puerto transversal para identificar al usuario autenticado sin depender de Spring Security. */
public interface ActorContext {

  Optional<UUID> currentUserId();

  default UUID requireUserId() {
    return currentUserId()
        .orElseThrow(() -> new IllegalStateException("No hay un usuario autenticado en el contexto"));
  }
}
