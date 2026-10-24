package com.mapit.operations.application.state;

import java.time.Clock;
import java.util.Map;
import java.util.UUID;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.mapit.operations.domain.state.OperationalSpaceElement;
import com.mapit.operations.domain.state.SpaceElementStateRepository;
import com.mapit.shared.audit.AuditEvent;
import com.mapit.shared.audit.AuditEventRecorder;
import com.mapit.shared.audit.AuditEventType;
import com.mapit.shared.audit.AuditResourceType;
import com.mapit.shared.security.ActorContext;
import com.mapit.shared.tenant.TenantContext;
import com.mapit.shared.tenant.TenantId;

/** Caso de uso transaccional de MAP-124. */
@Service
public class UpdateSpaceElementState {

  private final SpaceElementStateRepository repository;
  private final AuditEventRecorder auditEvents;
  private final TenantContext tenantContext;
  private final ActorContext actorContext;
  private final Clock clock;

  public UpdateSpaceElementState(
      SpaceElementStateRepository repository,
      AuditEventRecorder auditEvents,
      TenantContext tenantContext,
      ActorContext actorContext,
      Clock clock) {
    this.repository = repository;
    this.auditEvents = auditEvents;
    this.tenantContext = tenantContext;
    this.actorContext = actorContext;
    this.clock = clock;
  }

  @Transactional
  public SpaceElementStateResult execute(UpdateSpaceElementStateCommand command) {
    TenantId tenantId = tenantContext.require();
    OperationalSpaceElement current =
        repository
            .findAliveById(tenantId, command.sectorId(), command.elementId())
            .orElseThrow(() -> new OperationalSpaceElementNotFoundException(command.elementId()));

    OperationalSpaceElement changed = current.changeState(command.state(), clock.instant());
    if (changed == current) {
      return SpaceElementStateResult.from(current);
    }

    OperationalSpaceElement persisted = repository.save(changed);
    UUID actorId = actorContext.requireUserId();
    auditEvents.record(
        new AuditEvent(
            UUID.randomUUID(),
            tenantId,
            actorId,
            persisted.updatedAt(),
            AuditResourceType.SPACE_ELEMENT,
            command.elementId(),
            AuditEventType.SPACE_ELEMENT_STATE_CHANGED,
            Map.of(
                "previousState", current.state().name(),
                "newState", persisted.state().name(),
                "sectorId", command.sectorId().toString())));
    return SpaceElementStateResult.from(persisted);
  }
}
