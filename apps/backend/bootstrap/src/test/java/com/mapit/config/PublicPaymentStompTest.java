package com.mapit.config;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.Mockito.*;

import java.security.Principal;
import java.util.Optional;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.MessagingException;
import org.springframework.messaging.simp.SimpMessageHeaderAccessor;
import org.springframework.messaging.simp.SimpMessageType;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.MessageBuilder;

import com.mapit.identity.domain.AccessTokenVerifier;
import com.mapit.identity.domain.AuthenticatedPrincipal;
import com.mapit.identity.domain.UserRole;
import com.mapit.reservations.application.reservation.PublicReservationAccessService;
import com.mapit.shared.flags.FeatureFlag;
import com.mapit.shared.flags.FeatureFlagPort;
import com.mapit.shared.realtime.RealtimeRoomAccessPort;
import com.mapit.shared.tenant.TenantId;

class PublicPaymentStompTest {
  private final PublicReservationAccessService access = mock(PublicReservationAccessService.class);
  private final FeatureFlagPort flags = mock(FeatureFlagPort.class);
  private final MessageChannel channel = mock(MessageChannel.class);
  private final UUID reservation = UUID.randomUUID();
  private final String token = "A".repeat(43);
  private RealtimeStompInterceptor interceptor;

  @BeforeEach void setup() {
    when(flags.isEnabled(any(FeatureFlag.class), anyBoolean())).thenReturn(true);
    interceptor = new RealtimeStompInterceptor(mock(AccessTokenVerifier.class), mock(RealtimeRoomAccessPort.class), flags);
    interceptor.publicReservationAccess(access);
  }

  @Test void permitsOnlyOwnReservationAndReauthorizesSubscription() {
    Principal principal = connect();
    interceptor.preSend(subscription(principal, "/topic/reservations/" + reservation + "/payments"), channel);
    verify(access, times(2)).authorize("demo", "venue", reservation, token);
    assertThat(principal.toString()).doesNotContain(token);
    for (String destination : new String[]{"/topic/establishments/" + UUID.randomUUID(), "/topic/reservations/" + UUID.randomUUID() + "/payments", "/topic/reservations/" + reservation + "/payments/extra"}) {
      assertThatThrownBy(() -> interceptor.preSend(subscription(principal, destination), channel)).isInstanceOf(MessagingException.class);
    }
  }
  @Test void rejectsRevokedCredentialAtSubscriptionAndClientSend() {
    Principal principal = connect();
    when(access.authorize("demo", "venue", reservation, token)).thenThrow(new PublicReservationAccessService.AccessDenied());
    assertThatThrownBy(() -> interceptor.preSend(subscription(principal, "/topic/reservations/" + reservation + "/payments"), channel)).isInstanceOf(MessagingException.class);
    StompHeaderAccessor send = StompHeaderAccessor.create(StompCommand.SEND);
    send.setUser(principal);
    assertThatThrownBy(() -> interceptor.preSend(message(send), channel)).isInstanceOf(MessagingException.class);
  }
  @Test void deniesInvalidCredentialAndKillSwitch() {
    when(access.authorize("demo", "venue", reservation, token)).thenThrow(new PublicReservationAccessService.AccessDenied());
    assertThatThrownBy(this::connect).isInstanceOf(MessagingException.class).hasMessageNotContaining(token);
    reset(access);
    when(flags.isEnabled(any(FeatureFlag.class), anyBoolean())).thenReturn(false);
    assertThatThrownBy(this::connect).isInstanceOf(MessagingException.class);
  }
  @Test void rejectsCrossTenantAndEstablishmentCapabilitiesAtConnect() {
    for (String[] scope : new String[][]{{"foreign", "venue"}, {"demo", "other"}}) {
      when(access.authorize(scope[0], scope[1], reservation, token))
          .thenThrow(new PublicReservationAccessService.AccessDenied());
      var headers = StompHeaderAccessor.create(StompCommand.CONNECT);
      headers.setSessionId("foreign-session");
      headers.addNativeHeader("X-Reservation-Access", token);
      headers.addNativeHeader("tenantSlug", scope[0]);
      headers.addNativeHeader("establishmentSlug", scope[1]);
      headers.addNativeHeader("reservationId", reservation.toString());
      assertThatThrownBy(() -> interceptor.preSend(message(headers), channel))
          .isInstanceOf(MessagingException.class).hasMessageNotContaining(token);
    }
  }

  private Principal connect() {
    StompHeaderAccessor headers = StompHeaderAccessor.create(StompCommand.CONNECT);
    headers.setSessionId("public-session");
    headers.addNativeHeader("X-Reservation-Access", token);
    headers.addNativeHeader("tenantSlug", "demo");
    headers.addNativeHeader("establishmentSlug", "venue");
    headers.addNativeHeader("reservationId", reservation.toString());
    return StompHeaderAccessor.wrap(interceptor.preSend(message(headers), channel)).getUser();
  }
  @Test void revocationStopsAlreadySubscribedStreamAndDisconnectionClearsSession() {
    connect();
    SimpMessageHeaderAccessor headers = SimpMessageHeaderAccessor.create(SimpMessageType.MESSAGE);
    headers.setSessionId("public-session");
    headers.setDestination("/topic/reservations/" + reservation + "/payments");
    Message<?> delivery = MessageBuilder.createMessage(new byte[0], headers.getMessageHeaders());
    assertThat(interceptor.authorizeOutbound(delivery)).isSameAs(delivery);
    when(access.authorize("demo", "venue", reservation, token)).thenThrow(new PublicReservationAccessService.AccessDenied());
    assertThat(interceptor.authorizeOutbound(delivery)).isNull();
    StompHeaderAccessor disconnect = StompHeaderAccessor.create(StompCommand.DISCONNECT);
    disconnect.setSessionId("public-session");
    interceptor.preSend(message(disconnect), channel);
    assertThat(interceptor.authorizeOutbound(delivery)).isSameAs(delivery);
  }
  @Test void revokingStaffEstablishmentGrantStopsAnOpenStream() {
    var tokens = mock(AccessTokenVerifier.class);
    var rooms = mock(RealtimeRoomAccessPort.class);
    UUID establishment = UUID.randomUUID();
    var staff = new AuthenticatedPrincipal(UUID.randomUUID(), TenantId.of("demo"), "staff@example.test", UserRole.STAFF);
    when(tokens.verify("staff-token")).thenReturn(Optional.of(staff));
    when(rooms.canSubscribe(staff.tenantId(), staff.id(), "STAFF", establishment, Optional.empty())).thenReturn(true);
    var handler = new RealtimeStompInterceptor(tokens, rooms, flags);
    var connect = StompHeaderAccessor.create(StompCommand.CONNECT);
    connect.setSessionId("staff-session"); connect.addNativeHeader("Authorization", "Bearer staff-token");
    handler.preSend(message(connect), channel);
    var headers = SimpMessageHeaderAccessor.create(SimpMessageType.MESSAGE);
    headers.setSessionId("staff-session"); headers.setDestination("/topic/establishments/" + establishment);
    var delivery = MessageBuilder.createMessage(new byte[0], headers.getMessageHeaders());
    assertThat(handler.authorizeOutbound(delivery)).isSameAs(delivery);
    when(rooms.canSubscribe(staff.tenantId(), staff.id(), "STAFF", establishment, Optional.empty())).thenReturn(false);
    assertThat(handler.authorizeOutbound(delivery)).isNull();
  }
  private Message<?> subscription(Principal principal, String destination) {
    StompHeaderAccessor headers = StompHeaderAccessor.create(StompCommand.SUBSCRIBE);
    headers.setUser(principal); headers.setDestination(destination); return message(headers);
  }
  private Message<?> message(StompHeaderAccessor headers) { return MessageBuilder.createMessage(new byte[0], headers.getMessageHeaders()); }
}
