import { Injectable, Injector, effect, inject, isDevMode } from '@angular/core';
import { FeatureFlagService } from '@mapit/feature-flags';
import {
  PublicPaymentsService,
  ReceiptsService,
  type SimulatePaymentRequest,
  type PaymentAttempt,
  type PaymentReceipt,
  type PublicCheckout,
} from '@mapit/api-client';
import { Client } from '@stomp/stompjs';
import type { Observable } from 'rxjs';
import { ReservationAccess } from '../../../core/reservation-access';
import { PublicRuntimeConfig } from '../../../core/runtime-config';
import type { CheckoutScope } from './payment-preview-api';
export class MissingReservationAccessError extends Error {}

@Injectable({ providedIn: 'root' })
export class PublicPaymentApi {
  private readonly client = inject(PublicPaymentsService);
  private readonly receipts = inject(ReceiptsService);
  private readonly access = inject(ReservationAccess);
  private readonly runtime = inject(PublicRuntimeConfig);
  private readonly injector = inject(Injector);
  readonly simulationAllowed = (): boolean =>
    isDevMode() && ['development', 'test'].includes(this.runtime.config().environment);

  checkout(scope: CheckoutScope): Observable<PublicCheckout> {
    return this.client.getPublicCheckout(this.params(scope));
  }
  start(scope: CheckoutScope, methodId: string, requestId: string): Observable<PaymentAttempt> {
    return this.client.startPublicPayment({
      ...this.params(scope),
      startPaymentRequest: { methodId, requestId },
    });
  }
  simulate(
    scope: CheckoutScope,
    paymentId: string,
    outcome: SimulatePaymentRequest.OutcomeEnum,
  ): Observable<PaymentAttempt> {
    return this.client.simulatePublicPayment({
      ...this.params(scope),
      paymentId,
      simulatePaymentRequest: { outcome },
    });
  }
  issueReceipt(scope: CheckoutScope): Observable<PaymentReceipt> {
    return this.receipts.issuePaymentReceipt(this.params(scope));
  }
  receipt(
    tenantSlug: string,
    establishmentSlug: string,
    token: string,
  ): Observable<PaymentReceipt> {
    return this.receipts.getPaymentReceipt({ tenantSlug, establishmentSlug, token });
  }

  /** Reutiliza el servidor STOMP existente, limitado exclusivamente a esta reserva. */
  watch(
    scope: CheckoutScope,
    refresh: () => void,
    connection: (connected: boolean) => void,
  ): () => void {
    const token = this.access.read(scope);
    if (!token) return () => undefined;
    let disposed = false;
    const client = new Client({
      brokerURL: this.runtime.config().wsUrl,
      connectHeaders: {
        'X-Reservation-Access': token,
        tenantSlug: scope.tenantSlug,
        establishmentSlug: scope.establishmentSlug,
        reservationId: scope.reservationId,
      },
      reconnectDelay: 2000,
      onConnect: () => {
        if (disposed) return;
        client.subscribe('/topic/reservations/' + scope.reservationId + '/payments', (frame) => {
          try {
            const event: unknown = JSON.parse(frame.body);
            if (
              event &&
              typeof event === 'object' &&
              'reservationId' in event &&
              event.reservationId === scope.reservationId &&
              'eventType' in event &&
              ['payment.status.changed', 'reservation.checked_in'].includes(String(event.eventType))
            )
              refresh();
          } catch {
            /* Un mensaje inválido no sustituye el estado persistido. */
          }
        });
        connection(true);
        refresh();
      },
      onWebSocketClose: () => {
        if (!disposed) connection(false);
      },
      onStompError: () => {
        if (!disposed) connection(false);
      },
    });
    const enabled = this.injector.get(FeatureFlagService).isEnabled('realtime.websocket');
    const lifecycle = effect(
      () => {
        if (disposed) return;
        if (enabled()) client.activate();
        else {
          connection(false);
          void client.deactivate();
        }
      },
      { injector: this.injector },
    );
    return () => {
      disposed = true;
      lifecycle.destroy();
      void client.deactivate();
    };
  }

  private params(scope: CheckoutScope) {
    const token = this.access.read(scope);
    if (!token) throw new MissingReservationAccessError('reservation-access-required');
    return { ...scope, xReservationAccess: token };
  }
}
