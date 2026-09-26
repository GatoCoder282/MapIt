package com.mapit.operations.application.state;

import java.time.Clock;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.mapit.operations.domain.state.OperationalSpaceElement;
import com.mapit.operations.domain.state.SpaceElementStateRepository;
import com.mapit.shared.tenant.TenantContext;
import com.mapit.shared.tenant.TenantId;

/** Caso de uso transaccional de MAP-124. */
@Service
public class UpdateSpaceElementState {

  private final SpaceElementStateRepository repository;
  private final TenantContext tenantContext;
  private final Clock clock;

  public UpdateSpaceElementState(
      SpaceElementStateRepository repository, TenantContext tenantContext, Clock clock) {
    this.repository = repository;
    this.tenantContext = tenantContext;
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
    OperationalSpaceElement persisted = changed == current ? current : repository.save(changed);
    return SpaceElementStateResult.from(persisted);
  }
}
