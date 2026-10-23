package com.mapit.operations.application.state;

import java.util.List;
import java.util.UUID;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.mapit.operations.domain.state.SpaceElementStateChangeRepository;
import com.mapit.operations.domain.state.SpaceElementStateRepository;
import com.mapit.shared.tenant.TenantContext;
import com.mapit.shared.tenant.TenantId;

/** Consulta el historial después de verificar que el elemento pertenece al alcance actual. */
@Service
public class ListSpaceElementStateChanges {

  private final SpaceElementStateRepository elements;
  private final SpaceElementStateChangeRepository changes;
  private final TenantContext tenantContext;

  public ListSpaceElementStateChanges(
      SpaceElementStateRepository elements,
      SpaceElementStateChangeRepository changes,
      TenantContext tenantContext) {
    this.elements = elements;
    this.changes = changes;
    this.tenantContext = tenantContext;
  }

  @Transactional(readOnly = true)
  public List<SpaceElementStateChangeResult> execute(UUID sectorId, UUID elementId) {
    TenantId tenantId = tenantContext.require();
    elements
        .findAliveById(tenantId, sectorId, elementId)
        .orElseThrow(() -> new OperationalSpaceElementNotFoundException(elementId));
    return changes.findByElement(tenantId, sectorId, elementId).stream()
        .map(SpaceElementStateChangeResult::from)
        .toList();
  }
}
