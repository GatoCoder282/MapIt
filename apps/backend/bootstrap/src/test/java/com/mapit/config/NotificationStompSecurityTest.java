package com.mapit.config;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import java.util.*;
import java.util.concurrent.atomic.AtomicBoolean;

import org.junit.jupiter.api.Test;
import org.springframework.messaging.*;
import org.springframework.messaging.simp.SimpMessageType;
import org.springframework.messaging.simp.stomp.*;
import org.springframework.messaging.support.MessageBuilder;

import com.mapit.identity.domain.*;
import com.mapit.operations.domain.notification.*;
import com.mapit.shared.flags.*;
import com.mapit.shared.realtime.RealtimeRoomAccessPort;
import com.mapit.shared.tenant.TenantId;

class NotificationStompSecurityTest {
    final UUID id=UUID.randomUUID();
    final AuthenticatedPrincipal user=new AuthenticatedPrincipal(id,TenantId.of("tenant-a"),"private@test",UserRole.ADMIN);
    final FeatureFlagPort flags=mock(FeatureFlagPort.class);
    final NotificationAuthorizationPort grants=mock(NotificationAuthorizationPort.class);
    final AtomicBoolean current=new AtomicBoolean(true);
    final AccessTokenVerifier tokens=mock(AccessTokenVerifier.class);
    final RealtimeStompInterceptor interceptor=new RealtimeStompInterceptor(tokens,signed->current.get()?Optional.of(signed):Optional.empty(),mock(RealtimeRoomAccessPort.class),flags);
    final MessageChannel channel=mock(MessageChannel.class);
    NotificationStompSecurityTest(){
        when(tokens.verify("jwt")).thenReturn(Optional.of(user));
        when(flags.isEnabled(eq(FeatureFlag.REALTIME_WEBSOCKET),anyBoolean())).thenReturn(true);
        when(flags.isEnabledFor(eq(FeatureFlag.MAPIT_S6_NOTIFICATION_CENTER),any(FeatureFlagContext.class))).thenReturn(true);
        when(grants.resolve(any())).thenAnswer(call->Optional.of(new NotificationScope(call.getArgument(0),Map.of())));
        interceptor.notificationAccess(new NotificationStompAccess(grants,flags));
    }
    @Test void onlyExactPrivateDestinationAndCurrentSessionCanReceive(){
        var connected=connect("one","jwt");assertThat(StompHeaderAccessor.wrap(connected).getUser().getName()).isEqualTo("staff:tenant-a:"+id);
        subscribe(connected,"one","/user/topic/notifications");assertThat(interceptor.authorizeOutbound(outgoing("one","/topic/notifications-userone"))).isNotNull();
        for(String bad:List.of("/user/other/topic/notifications","/topic/notifications","/topic/notifications-userother","/user/topic/notifications/other"))assertThatThrownBy(()->subscribe(connected,"one",bad)).isInstanceOf(MessagingException.class);
        assertThat(interceptor.authorizeOutbound(outgoing("one","/topic/notifications-userother"))).isNull();assertThat(interceptor.authorizeOutbound(outgoing("other","/topic/notifications-userother"))).isNull();
        var disconnect=StompHeaderAccessor.create(StompCommand.DISCONNECT);disconnect.setSessionId("one");interceptor.preSend(message(disconnect),channel);
        assertThat(interceptor.authorizeOutbound(outgoing("one","/topic/notifications-userone"))).isNull();
    }
    @Test void revocationOffProviderFailureAndIdentityMismatchFailClosed(){
        var connected=connect("one","jwt");current.set(false);assertThat(interceptor.authorizeOutbound(outgoing("one","/topic/notifications-userone"))).isNull();assertThatThrownBy(()->subscribe(connected,"one","/user/topic/notifications")).isInstanceOf(MessagingException.class);
        current.set(true);when(flags.isEnabledFor(eq(FeatureFlag.MAPIT_S6_NOTIFICATION_CENTER),any(FeatureFlagContext.class))).thenReturn(false);
        assertThatThrownBy(()->subscribe(connected,"one","/user/topic/notifications")).isInstanceOf(MessagingException.class);
        doThrow(new IllegalStateException("provider unavailable")).when(flags).isEnabledFor(eq(FeatureFlag.MAPIT_S6_NOTIFICATION_CENTER),any(FeatureFlagContext.class));
        assertThat(interceptor.authorizeOutbound(outgoing("one","/topic/notifications-userone"))).isNull();
        reset(grants);when(grants.resolve(any())).thenReturn(Optional.of(new NotificationScope(new NotificationRecipient(TenantId.of("tenant-b"),id),Map.of())));
        assertThat(interceptor.authorizeOutbound(outgoing("one","/topic/notifications-userone"))).isNull();
    }
    @Test void sameUserUuidInDifferentTenantsHasDistinctRoutingAndCannotForgeSession(){
        var a=connect("one","jwt");var other=new AuthenticatedPrincipal(id,TenantId.of("tenant-b"),"other@test",UserRole.ADMIN);when(tokens.verify("other")).thenReturn(Optional.of(other));
        var b=connect("two","other");assertThat(StompHeaderAccessor.wrap(a).getUser().getName()).isNotEqualTo(StompHeaderAccessor.wrap(b).getUser().getName());
        assertThatThrownBy(()->subscribe(a,"unknown","/user/topic/notifications")).isInstanceOf(MessagingException.class);
        assertThatThrownBy(()->subscribe(a,"two","/user/topic/notifications")).isInstanceOf(MessagingException.class);
        assertThatThrownBy(()->connect("one","other")).isInstanceOf(MessagingException.class);
    }
    Message<?> connect(String session,String token){var h=StompHeaderAccessor.create(StompCommand.CONNECT);h.setSessionId(session);h.addNativeHeader("Authorization","Bearer "+token);return interceptor.preSend(message(h),channel);}
    void subscribe(Message<?> connected,String session,String destination){var h=StompHeaderAccessor.create(StompCommand.SUBSCRIBE);h.setSessionId(session);h.setUser(StompHeaderAccessor.wrap(connected).getUser());h.setDestination(destination);interceptor.preSend(message(h),channel);}
    Message<?> outgoing(String session,String destination){var h=StompHeaderAccessor.createForHeartbeat();h.setHeader("simpMessageType",SimpMessageType.MESSAGE);h.setSessionId(session);h.setDestination(destination);return message(h);}
    Message<byte[]> message(StompHeaderAccessor h){return MessageBuilder.createMessage(new byte[0],h.getMessageHeaders());}
}
