package com.mapit.operations.application.state;

import java.time.Clock;
import java.util.Optional;
import java.util.UUID;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.mapit.operations.domain.state.OperationalSpaceElement;
import com.mapit.operations.domain.state.SpaceElementRealtimeContextRepository;
import com.mapit.operations.domain.state.SpaceElementRealtimeContextRepository.SpaceElementRealtimeContext;
import com.mapit.operations.domain.state.SpaceElementStateChange;
import com.mapit.operations.domain.state.SpaceElementStateChangeRepository;
import com.mapit.operations.domain.state.SpaceElementStateRepository;
import com.mapit.shared.realtime.RealtimeEvent;
import com.mapit.shared.realtime.RealtimeEventPublisher;
import com.mapit.shared.security.ActorContext;
import com.mapit.shared.tenant.TenantContext;
import com.mapit.shared.tenant.TenantId;

/**
 * Caso de uso transaccional de MAP-124.
 *
 * <p>Desde HU-3.02 (MAP-146) también publica {@code space-element.state.changed.v1}: el evento se
 * escribe en el outbox dentro de la misma transacción, así que no hay evento sin cambio ni cambio
 * sin evento.
 */
@Service
public class UpdateSpaceElementState {

  private final SpaceElementStateRepository repository;
  private final SpaceElementStateChangeRepository changes;
  private final SpaceElementRealtimeContextRepository realtimeContext;
  private final RealtimeEventPublisher events;
  private final TenantContext tenantContext;
  private final ActorContext actorContext;
  private final Clock clock;

  public UpdateSpaceElementState(
      SpaceElementStateRepository repository,
      SpaceElementStateChangeRepository changes,
      SpaceElementRealtimeContextRepository realtimeContext,
      RealtimeEventPublisher events,
      TenantContext tenantContext,
      ActorContext actorContext,
      Clock clock) {
    this.repository = repository;
    this.changes = changes;
    this.realtimeContext = realtimeContext;
    this.events = events;
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
    publishStateChanged(tenantId, current, persisted);
    return SpaceElementStateResult.from(persisted);
  }

  private void publishStateChanged(
      TenantId tenantId, OperationalSpaceElement previous, OperationalSpaceElement persisted) {
    SpaceElementRealtimeContext context =
        realtimeContext.resolve(tenantId, persisted.sectorId(), persisted.id());
    events.publish(
        RealtimeEvent.spaceElementStateChanged(
            UUID.randomUUID(),
            persisted.updatedAt(),
            tenantId,
            context.establishmentId(),
            Optional.of(persisted.sectorId()),
            persisted.id(),
            Optional.of(previous.state()),
            persisted.state(),
            context.aggregateVersion()));
  }
}
