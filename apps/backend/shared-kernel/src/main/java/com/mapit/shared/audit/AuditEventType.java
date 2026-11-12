package com.mapit.shared.audit;

import java.util.Set;

/** Catálogo cerrado de eventos y de los detalles mínimos permitidos para cada uno. */
public enum AuditEventType {
  RESERVATION_CREATED(
      AuditResourceType.RESERVATION, Set.of("status", "establishmentId")),
  RESERVATION_STATUS_CHANGED(
      AuditResourceType.RESERVATION, Set.of("previousStatus", "newStatus")),
  SPACE_ELEMENT_STATE_CHANGED(
      AuditResourceType.SPACE_ELEMENT, Set.of("previousState", "newState", "sectorId")),
  USER_INVITATION_ISSUED(AuditResourceType.USER_INVITATION, Set.of("targetRole")),
  USER_INVITATION_ACCEPTED(AuditResourceType.USER, Set.of("invitationId", "role")),
  USER_ROLE_CHANGED(AuditResourceType.USER, Set.of("previousRole", "newRole")),
  USER_DEACTIVATED(AuditResourceType.USER, Set.of("previousActive", "newActive")),
  USER_RECOVERED(AuditResourceType.USER, Set.of("targetTenantId", "ticket", "reason"));

  private final AuditResourceType resourceType;
  private final Set<String> allowedDetailKeys;

  AuditEventType(AuditResourceType resourceType, Set<String> allowedDetailKeys) {
    this.resourceType = resourceType;
    this.allowedDetailKeys = Set.copyOf(allowedDetailKeys);
  }

  public AuditResourceType resourceType() {
    return resourceType;
  }

  public Set<String> allowedDetailKeys() {
    return allowedDetailKeys;
  }
}
