package com.mapit.operations.application.state;

import java.time.Clock;
import java.util.UUID;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.mapit.operations.domain.state.OperationalSpaceElement;
import com.mapit.operations.domain.state.SpaceElementStateChange;
import com.mapit.operations.domain.state.SpaceElementStateChangeRepository;
import com.mapit.operations.domain.state.SpaceElementStateRepository;
import com.mapit.shared.security.ActorContext;
import com.mapit.shared.tenant.TenantContext;
import com.mapit.shared.tenant.TenantId;

/** Caso de uso transaccional de MAP-124. */
@Service
public class UpdateSpaceElementState {

  private final SpaceElementStateRepository repository;
  private final SpaceElementStateChangeRepository changes;
  private final TenantContext tenantContext;
  private final ActorContext actorContext;
  private final Clock clock;

  public UpdateSpaceElementState(
      SpaceElementStateRepository repository,
      SpaceElementStateChangeRepository changes,
      TenantContext tenantContext,
      ActorContext actorContext,
      Clock clock) {
    this.repository = repository;
    this.changes = changes;
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
    changes.append(
        new SpaceElementStateChange(
            UUID.randomUUID(),
            tenantId,
            command.sectorId(),
            command.elementId(),
            current.state(),
            persisted.state(),
            actorContext.requireUserId(),
            persisted.updatedAt()));
    return SpaceElementStateResult.from(persisted);
  }
}
