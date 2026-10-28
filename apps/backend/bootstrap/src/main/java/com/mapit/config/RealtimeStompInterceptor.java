package com.mapit.config;

import java.util.List;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

import org.jspecify.annotations.Nullable;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.event.EventListener;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.MessagingException;
import org.springframework.messaging.simp.SimpMessageHeaderAccessor;
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
import org.springframework.web.socket.messaging.SessionDisconnectEvent;

import com.mapit.identity.domain.AccessTokenVerifier;
import com.mapit.identity.domain.AuthenticatedPrincipal;
import com.mapit.reservations.application.reservation.PublicReservationAccessService;
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
  private @Nullable PublicReservationAccessService reservations;
  private final ConcurrentHashMap<String, PublicReservationPrincipal> publicSessions = new ConcurrentHashMap<>();
  private final ConcurrentHashMap<String, AuthenticatedPrincipal> staffSessions = new ConcurrentHashMap<>();

  @Autowired
  void publicReservationAccess(PublicReservationAccessService reservations) {
    this.reservations = reservations;
  }

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
    if (authorization == null && accessor.getFirstNativeHeader("X-Reservation-Access") != null) {
      return connectReservation(message, accessor);
    }
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
    if (accessor.getSessionId() != null) staffSessions.put(accessor.getSessionId(), principal);
    accessor.setLeaveMutable(true);
    return MessageBuilder.createMessage(message.getPayload(), accessor.getMessageHeaders());
  }

  private Message<?> inspectNonConnect(
      Message<?> message, StompHeaderAccessor accessor) {
    if (accessor == null) return message;
    StompCommand command = accessor.getCommand();
    if (command == null) return message;
    if (command == StompCommand.DISCONNECT && accessor.getSessionId() != null) {
      publicSessions.remove(accessor.getSessionId());
      staffSessions.remove(accessor.getSessionId());
    }
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
    if (accessor.getUser() instanceof PublicReservationPrincipal principal) {
      String allowed = "/topic/reservations/" + principal.reservationId() + "/payments";
      if (!allowed.equals(accessor.getDestination())) throw new MessagingException("Destino público no permitido");
      authorizePublic(principal);
      return;
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

  private Message<?> connectReservation(Message<?> message, StompHeaderAccessor accessor) {
    try {
      PublicReservationPrincipal principal = new PublicReservationPrincipal(
          requiredHeader(accessor, "tenantSlug"), requiredHeader(accessor, "establishmentSlug"),
          UUID.fromString(requiredHeader(accessor, "reservationId")), requiredHeader(accessor, "X-Reservation-Access"));
      authorizePublic(principal);
      String sessionId = accessor.getSessionId();
      if (sessionId != null) publicSessions.put(sessionId, principal);
      accessor.setUser(principal);
      accessor.setLeaveMutable(true);
      return MessageBuilder.createMessage(message.getPayload(), accessor.getMessageHeaders());
    } catch (RuntimeException exception) {
      throw new MessagingException("Acceso público STOMP inválido");
    }
  }

  private String requiredHeader(StompHeaderAccessor accessor, String name) {
    String value = accessor.getFirstNativeHeader(name);
    if (value == null || value.length() > 128) throw new MessagingException("Credencial pública inválida");
    return value;
  }

  private void authorizePublic(PublicReservationPrincipal principal) {
    PublicReservationAccessService service = reservations;
    if (service == null) throw new MessagingException("Acceso público no disponible");
    try {
      service.authorize(principal.tenantSlug(), principal.establishmentSlug(), principal.reservationId(), principal.token());
    } catch (RuntimeException exception) {
      throw new MessagingException("Credencial pública inválida o vencida");
    }
  }

  /** El simple broker solo incluye sessionId al entregar; la identidad se retiene del CONNECT validado. */
  @Nullable Message<?> authorizeOutbound(Message<?> message) {
    if (SimpMessageHeaderAccessor.getMessageType(message.getHeaders()) != SimpMessageType.MESSAGE) return message;
    String sessionId = SimpMessageHeaderAccessor.getSessionId(message.getHeaders());
    PublicReservationPrincipal principal = sessionId == null ? null : publicSessions.get(sessionId);
    if (principal == null) {
      AuthenticatedPrincipal staff = sessionId == null ? null : staffSessions.get(sessionId);
      if (staff == null) return message;
      if (!flags.isEnabled(FeatureFlag.REALTIME_WEBSOCKET, true)) return null;
      var destination = RealtimeDestination.parse(SimpMessageHeaderAccessor.getDestination(message.getHeaders()));
      if (destination.isEmpty()) return null;
      var room = destination.orElseThrow();
      try {
        return rooms.canSubscribe(staff.tenantId(), staff.id(), staff.role().name(), room.establishmentId(), room.sectorId()) ? message : null;
      } catch (RuntimeException exception) { return null; }
    }
    if (!flags.isEnabled(FeatureFlag.REALTIME_WEBSOCKET, true)
        || !("/topic/reservations/" + principal.reservationId() + "/payments").equals(SimpMessageHeaderAccessor.getDestination(message.getHeaders()))) return null;
    try {
      authorizePublic(principal);
      return message;
    } catch (MessagingException exception) {
      return null;
    }
  }

  @EventListener
  public void sessionDisconnected(SessionDisconnectEvent event) { publicSessions.remove(event.getSessionId()); staffSessions.remove(event.getSessionId()); }

  private record PublicReservationPrincipal(String tenantSlug, String establishmentSlug,
      UUID reservationId, String token) implements java.security.Principal {
    @Override public String getName() { return "reservation:" + reservationId; }
    @Override public String toString() { return "PublicReservationPrincipal[REDACTED]"; }
  }
}
