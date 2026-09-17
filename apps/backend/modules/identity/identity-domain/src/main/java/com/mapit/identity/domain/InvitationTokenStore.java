package com.mapit.identity.domain;

import java.util.Optional;

import com.mapit.shared.tenant.TenantId;

/**
 * Puerto de acceso a las invitaciones del primer ADMIN. La activación es
 * pública: el par (tenantSlug, token) del enlace acota la búsqueda y el consumo
 * a un solo tenant, con SET LOCAL bajo la misma transacción.
 */
public interface InvitationTokenStore {

  /** Resuelve el tenant por su slug público del enlace; vacío si no existe. */
  Optional<TenantId> findTenantBySlug(String slug);

  /** Busca la invitación pendiente del tenant por hash del token. */
  Optional<StoredInvitation> findByTokenHash(TenantId tenantId, String tokenHash);

  /**
   * Consume la invitación de forma atómica: solo si sigue pendiente.
   * Devuelve false si ya estaba consumida (una segunda utilización falla).
   */
  boolean markConsumed(java.util.UUID invitationId, java.util.UUID userId);
}
