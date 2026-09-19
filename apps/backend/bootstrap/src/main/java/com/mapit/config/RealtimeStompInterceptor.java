package com.mapit.config;

import java.util.List;

import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.MessagingException;
import org.springframework.messaging.simp.SimpMessageType;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.messaging.support.MessageBuilder;
import org.springframework.messaging.support.MessageHeaderAccessor;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.stereotype.Component;

import com.mapit.identity.domain.AccessTokenVerifier;
import com.mapit.identity.domain.AuthenticatedPrincipal;
import com.mapit.shared.flags.FeatureFlag;
import com.mapit.shared.flags.FeatureFlagPort;
import com.mapit.shared.realtime.RealtimeDestination;
import com.mapit.shared.realtime.RealtimeRoomAccessPort;

/** Autenticación CONNECT y autorización por sala en la capa de mensajes STOMP. */
@Component
public final class RealtimeStompInterceptor implements ChannelInterceptor {

  private static final String BEARER_PREFIX = "Bearer ";

  private final AccessTokenVerifier tokens;
  private final RealtimeRoomAccessPort rooms;
  private final FeatureFlagPort flags;

  public RealtimeStompInterceptor(
      AccessTokenVerifier tokens, RealtimeRoomAccessPort rooms, FeatureFlagPort flags) {
    this.tokens = tokens;
    this.rooms = rooms;
    this.flags = flags;
  }

  @Override
  public Message<?> preSend(Message<?> message, MessageChannel channel) {
    StompHeaderAccessor accessor =
        (StompHeaderAccessor) MessageHeaderAccessor.getMutableAccessor(message);
    if (accessor == null || accessor.getMessageType() != SimpMessageType.CONNECT) {
      return inspectNonConnect(message, accessor);
    }
    if (!flags.isEnabled(FeatureFlag.REALTIME_WEBSOCKET, true)) {
      throw new MessagingException("El tiempo real está temporalmente desactivado");
    }
    String authorization = accessor.getFirstNativeHeader("Authorization");
    if (authorization == null || !authorization.startsWith(BEARER_PREFIX)) {
      throw new MessagingException("STOMP CONNECT requiere Authorization Bearer");
    }
    AuthenticatedPrincipal principal =
        tokens
            .verify(authorization.substring(BEARER_PREFIX.length()).strip())
            .orElseThrow(() -> new MessagingException("JWT STOMP inválido o vencido"));
    Authentication authentication =
        new UsernamePasswordAuthenticationToken(
            principal,
            null,
            List.of(new SimpleGrantedAuthority("ROLE_" + principal.role().name())));
    accessor.setUser(authentication);
    accessor.setLeaveMutable(true);
    return MessageBuilder.createMessage(message.getPayload(), accessor.getMessageHeaders());
  }

  private Message<?> inspectNonConnect(
      Message<?> message, StompHeaderAccessor accessor) {
    if (accessor == null) return message;
    StompCommand command = accessor.getCommand();
    if (command == null) return message;
    if (command == StompCommand.SEND) {
      throw new MessagingException("Los clientes no pueden publicar eventos STOMP");
    }
    if (command == StompCommand.SUBSCRIBE) {
      authorizeSubscription(accessor);
    }
    return message;
  }

  private void authorizeSubscription(StompHeaderAccessor accessor) {
    if (!flags.isEnabled(FeatureFlag.REALTIME_WEBSOCKET, true)) {
      throw new MessagingException("El tiempo real está temporalmente desactivado");
    }
    if (!(accessor.getUser() instanceof Authentication authentication)
        || !(authentication.getPrincipal() instanceof AuthenticatedPrincipal principal)) {
      throw new MessagingException("La suscripción STOMP no está autenticada");
    }
    RealtimeDestination destination =
        RealtimeDestination.parse(accessor.getDestination())
            .orElseThrow(() -> new MessagingException("Destino de sala STOMP no permitido"));
    if (!rooms.canSubscribe(
        principal.tenantId(),
        principal.id(),
        principal.role().name(),
        destination.establishmentId(),
        destination.sectorId())) {
      throw new MessagingException("La identidad no pertenece a la sala solicitada");
    }
  }
}
