package com.mapit.identity.application;

import org.springframework.stereotype.Service;

import com.mapit.identity.domain.AccessTokenVerifier;
import com.mapit.identity.domain.AuthenticatedPrincipal;
import com.mapit.identity.domain.CurrentStaffIdentity;
import com.mapit.identity.domain.UserRole;

/** Verifica un JWT real y reconsulta la cuenta. Debe repetirse al ejecutar el rescate. */
@Service
public final class AdminRecoveryActorVerifier {
  private final AccessTokenVerifier tokens;
  private final CurrentStaffIdentity identities;

  public AdminRecoveryActorVerifier(AccessTokenVerifier tokens, CurrentStaffIdentity identities) {
    this.tokens = tokens;
    this.identities = identities;
  }

  public AuthenticatedPrincipal verify(String bearerToken) {
    if (bearerToken == null || bearerToken.isBlank()) {
      throw new SecurityException("Credencial de plataforma ausente");
    }
    try {
      AuthenticatedPrincipal signed = tokens.verify(bearerToken)
          .orElseThrow(() -> new SecurityException("Credencial de plataforma inválida"));
      AuthenticatedPrincipal current = identities.resolve(signed)
          .orElseThrow(() -> new SecurityException("Operador de plataforma no vigente"));
      if (!current.id().equals(signed.id()) || !current.tenantId().equals(signed.tenantId())
          || current.role() != signed.role() || current.role() != UserRole.SUPER_ADMIN
          || !"platform".equals(current.tenantId().value())) {
        throw new SecurityException("Operador de plataforma no autorizado");
      }
      return current;
    } catch (RuntimeException failure) {
      throw new SecurityException("No se pudo verificar al operador de plataforma");
    }
  }
}
