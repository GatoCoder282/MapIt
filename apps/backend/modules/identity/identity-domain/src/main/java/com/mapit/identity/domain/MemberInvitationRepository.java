package com.mapit.identity.domain;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import com.mapit.shared.tenant.TenantId;

/** Extensión de la misma tabla invitation_tokens que usa CU-25. */
public interface MemberInvitationRepository {
  record TenantInfo(String name, String slug) {}

  TenantInfo tenantInfo(TenantId tenant);

  boolean userExists(TenantId tenant, String email);

  Optional<MemberInvitation> pending(TenantId tenant, String email);

  Optional<MemberInvitation> byId(TenantId tenant, UUID id);

  long countRecoverable(TenantId tenant);

  List<MemberInvitation> listRecoverable(TenantId tenant, int size, long offset);

  boolean revoke(TenantId tenant, UUID id);

  MemberInvitation insert(TenantId tenant, UUID id, String email, UserRole role,
      UUID invitedBy, String hash);
}
