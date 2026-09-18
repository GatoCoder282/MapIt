package com.mapit.realtime;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.util.Optional;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.MessagingException;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.MessageBuilder;

import com.mapit.config.RealtimeStompInterceptor;
import com.mapit.identity.domain.AccessTokenVerifier;
import com.mapit.identity.domain.AuthenticatedPrincipal;
import com.mapit.identity.domain.UserRole;
import com.mapit.shared.flags.FeatureFlag;
import com.mapit.shared.flags.FeatureFlagPort;
import com.mapit.shared.realtime.RealtimeRoomAccessPort;
import com.mapit.shared.tenant.TenantId;

class RealtimeStompInterceptorTest {

  private static final UUID USER = UUID.fromString("00000000-0000-0000-0000-000000000001");
  private static final UUID ESTABLISHMENT =
      UUID.fromString("00000000-0000-0000-0000-000000000002");
  private static final AuthenticatedPrincipal PRINCIPAL =
      new AuthenticatedPrincipal(USER, TenantId.of("demo"), "staff@example.test", UserRole.STAFF);

  private final AccessTokenVerifier tokens = mock(AccessTokenVerifier.class);
  private final RealtimeRoomAccessPort rooms = mock(RealtimeRoomAccessPort.class);
  private final FeatureFlagPort flags = mock(FeatureFlagPort.class);
  private final MessageChannel channel = mock(MessageChannel.class);
  private RealtimeStompInterceptor interceptor;

  @BeforeEach
  void setUp() {
    when(flags.isEnabled(any(FeatureFlag.class), anyBoolean())).thenReturn(true);
    when(tokens.verify("jwt")).thenReturn(Optional.of(PRINCIPAL));
    when(rooms.canSubscribe(
            PRINCIPAL.tenantId(),
            PRINCIPAL.id(),
            PRINCIPAL.role().name(),
            ESTABLISHMENT,
            Optional.empty()))
        .thenReturn(true);
    interceptor = new RealtimeStompInterceptor(tokens, rooms, flags);
  }

  @Test
  void autentica_connect_con_bearer_y_autoriza_la_sala_del_tenant() {
    Message<?> connect = message(StompCommand.CONNECT, null, "Bearer jwt", null);
    Message<?> authenticated = interceptor.preSend(connect, channel);
    StompHeaderAccessor authenticatedHeaders = StompHeaderAccessor.wrap(authenticated);

    StompHeaderAccessor subscribe = StompHeaderAccessor.create(StompCommand.SUBSCRIBE);
    subscribe.setDestination("/topic/establishments/" + ESTABLISHMENT);
    subscribe.setUser(authenticatedHeaders.getUser());
    interceptor.preSend(message(subscribe), channel);
  }

  @Test
  void rechaza_jwt_invalido_y_suscripcion_sin_pertenencia() {
    when(tokens.verify("bad")).thenReturn(Optional.empty());
    assertThatThrownBy(() -> interceptor.preSend(message(StompCommand.CONNECT, null, "Bearer bad", null), channel))
        .isInstanceOf(MessagingException.class);

    when(rooms.canSubscribe(
            PRINCIPAL.tenantId(),
            PRINCIPAL.id(),
            PRINCIPAL.role().name(),
            ESTABLISHMENT,
            Optional.empty()))
        .thenReturn(false);
    Message<?> connect = interceptor.preSend(message(StompCommand.CONNECT, null, "Bearer jwt", null), channel);
    StompHeaderAccessor subscribe = StompHeaderAccessor.create(StompCommand.SUBSCRIBE);
    subscribe.setDestination("/topic/establishments/" + ESTABLISHMENT);
    subscribe.setUser(StompHeaderAccessor.wrap(connect).getUser());
    assertThatThrownBy(() -> interceptor.preSend(message(subscribe), channel))
        .isInstanceOf(MessagingException.class);
  }

  @Test
  void rechaza_publicacion_desde_el_cliente() {
    assertThatThrownBy(() -> interceptor.preSend(message(StompCommand.SEND, "/topic/x", null, null), channel))
        .isInstanceOf(MessagingException.class);
  }

  private static Message<byte[]> message(
      StompCommand command, String destination, String authorization, StompHeaderAccessor ignored) {
    StompHeaderAccessor headers = StompHeaderAccessor.create(command);
    headers.setDestination(destination);
    if (authorization != null) headers.addNativeHeader("Authorization", authorization);
    return message(headers);
  }

  private static Message<byte[]> message(StompHeaderAccessor headers) {
    return MessageBuilder.createMessage(new byte[0], headers.getMessageHeaders());
  }
}
