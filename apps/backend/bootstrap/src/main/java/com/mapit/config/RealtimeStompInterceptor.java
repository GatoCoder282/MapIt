package com.mapit.config;

import java.util.List;

import org.slf4j.LoggerFactory;
import org.slf4j.MDC;
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
    var previous = MDC.getCopyOfContextMap();
    MDC.clear();
    var accessor = MessageHeaderAccessor.getAccessor(message, StompHeaderAccessor.class);
    String operation = accessor != null && accessor.getCommand() != null ? accessor.getCommand().name() : "UNKNOWN";
    if (accessor != null && accessor.getUser() instanceof Authentication authentication
        && authentication.getPrincipal() instanceof AuthenticatedPrincipal principal) {
      MDC.put("tenant_id", principal.tenantId().value());
    }
    try {
      return inspect(message);
    } catch (MessagingException exception) {
      LoggerFactory.getLogger(RealtimeStompInterceptor.class).atWarn()
          .addKeyValue("event", "realtime.access.denied")
          .addKeyValue("operation", operation)
          .log("STOMP command rejected");
      throw exception;
    } catch (RuntimeException exception) {
      LoggerFactory.getLogger(RealtimeStompInterceptor.class).atError()
          .addKeyValue("event", "realtime.processing.failed")
          .addKeyValue("operation", operation)
          .setCause(exception).log("STOMP processing failed");
      throw exception;
    } finally {
      MDC.clear();
      if (previous != null) MDC.setContextMap(previous);
    }
  }

  private Message<?> inspect(Message<?> message) {
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
