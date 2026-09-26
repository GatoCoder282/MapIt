package com.mapit.identity.infrastructure;

import java.util.Optional;
import java.util.UUID;

import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;

import com.mapit.identity.domain.AuthenticatedPrincipal;
import com.mapit.shared.security.ActorContext;

/** Obtiene el actor únicamente de la identidad reconstruida desde el JWT validado. */
@Component
public class SecurityActorContext implements ActorContext {

  @Override
  public Optional<UUID> currentUserId() {
    var authentication = SecurityContextHolder.getContext().getAuthentication();
    if (authentication != null
        && authentication.isAuthenticated()
        && authentication.getPrincipal() instanceof AuthenticatedPrincipal principal) {
      return Optional.of(principal.id());
    }
    return Optional.empty();
  }
}
