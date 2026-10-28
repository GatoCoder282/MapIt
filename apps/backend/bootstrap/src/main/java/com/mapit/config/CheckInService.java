package com.mapit.config;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import org.jspecify.annotations.Nullable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.mapit.operations.application.state.UpdateSpaceElementState;
import com.mapit.operations.application.state.UpdateSpaceElementStateCommand;
import com.mapit.payments.application.PaymentReceiptService;
import com.mapit.payments.application.PaymentViews;
import com.mapit.reservations.application.reservation.PublicReservationAccessService;
import com.mapit.reservations.domain.booking.ReservationAccessView;
import com.mapit.shared.realtime.SpaceElementState;
import com.mapit.shared.security.ActorContext;
import com.mapit.shared.security.EstablishmentAuthorizationPort;
import com.mapit.shared.tenant.TenantContext;

/** Orquesta contextos en una sola transacción; ningún módulo importa otro módulo. */
@Service
public class CheckInService {
  private final PaymentReceiptService receipts;
  private final PublicReservationAccessService reservations;
  private final UpdateSpaceElementState operations;
  private final TenantContext tenants;
  private final ActorContext actors;
  private final PaymentOutboxPublisher realtime;
  private final EstablishmentAuthorizationPort authorization;

  public CheckInService(PaymentReceiptService receipts, PublicReservationAccessService reservations,
      UpdateSpaceElementState operations, TenantContext tenants, ActorContext actors, PaymentOutboxPublisher realtime,
      EstablishmentAuthorizationPort authorization) {
    this.receipts = receipts; this.reservations = reservations; this.operations = operations;
    this.tenants = tenants; this.actors = actors;
    this.realtime = realtime;
    this.authorization = authorization;
  }

  @Transactional(readOnly = true)
  public Details lookup(UUID establishmentId, String token) {
    requireAccess(establishmentId);
    PaymentViews.PaymentReceipt receipt = receipts.readForOperator(tenants.require(), establishmentId, token);
    ReservationAccessView view = reservations.read(tenants.require(), receipt.reservation().id());
    return details(receipt, view);
  }

  @Transactional
  public Details register(UUID establishmentId, String token) {
    requireAccess(establishmentId);
    PaymentViews.PaymentReceipt receipt = receipts.readForOperator(tenants.require(), establishmentId, token);
    ReservationAccessView previous = reservations.lock(tenants.require(), receipt.reservation().id());
    if (!receipt.payment().id().equals(previous.confirmedPaymentId())) {
      throw new PublicReservationAccessService.Conflict();
    }
    ReservationAccessView arrived = reservations.checkIn(tenants.require(), previous.id(), establishmentId, actors.requireUserId());
    if (previous.checkedInAt() == null) {
      arrived.spaces().stream().sorted(java.util.Comparator.comparing(ReservationAccessView.Space::id))
          .forEach(space -> operations.execute(new UpdateSpaceElementStateCommand(space.sectorId(), space.id(), SpaceElementState.OCCUPIED)));
      realtime.publishArrival(tenants.require(), establishmentId, arrived.id(), receipt.payment().id());
    }
    return details(receipts.readForOperator(tenants.require(), establishmentId, token), arrived);
  }

  private Details details(PaymentViews.PaymentReceipt receipt, ReservationAccessView view) {
    Audit audit = view.checkedInAt() == null || view.checkedInBy() == null ? null :
        new Audit(view.checkedInBy(), view.checkedInAt(), view.establishmentId(), view.spaces().stream().map(ReservationAccessView.Space::id).toList());
    return new Details(receipt, audit);
  }
  private void requireAccess(UUID establishmentId) {
    if (!authorization.canCheckIn(tenants.require(), actors.requireUserId(), establishmentId)) {
      throw new org.springframework.security.access.AccessDeniedException("Operación no autorizada para este establecimiento");
    }
  }

  public record Details(PaymentViews.PaymentReceipt receipt, @Nullable Audit audit) {}
  public record Audit(UUID actorId, Instant occurredAt, UUID establishmentId, List<UUID> spaceIds) {}
}
