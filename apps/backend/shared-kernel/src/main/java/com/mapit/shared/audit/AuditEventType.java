package com.mapit.shared.audit;

import java.util.Set;

/** Catálogo cerrado de eventos y de los detalles mínimos permitidos para cada uno. */
public enum AuditEventType {
  RESERVATION_CREATED(
      AuditResourceType.RESERVATION, Set.of("status", "establishmentId")),
  RESERVATION_STATUS_CHANGED(
      AuditResourceType.RESERVATION, Set.of("previousStatus", "newStatus")),
  SPACE_ELEMENT_STATE_CHANGED(
      AuditResourceType.SPACE_ELEMENT, Set.of("previousState", "newState", "sectorId"));

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
