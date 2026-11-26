package com.mapit.operations.infrastructure.notification;

import static org.assertj.core.api.Assertions.*;

import java.time.*;
import java.util.*;

import org.junit.jupiter.api.Test;

import com.mapit.operations.domain.notification.*;
import com.mapit.shared.tenant.TenantId;

class NotificationCursorCodecTest {
    private final Instant now=Instant.parse("2026-11-22T12:00:00Z");
    private final String secret="test-cursor-secret-with-at-least-32-bytes";
    private final NotificationScope scope=new NotificationScope(new NotificationRecipient(TenantId.of("cursor-a"),new UUID(0,1)),Map.of(NotificationType.RESERVATION_CREATED,Set.of(new UUID(0,10))));
    private final NotificationCursorCodec codec=new NotificationCursorCodec(secret,Clock.fixed(now,ZoneOffset.UTC));
    @Test void roundTripBindsAllGrantsAndPreservesUnsignedUuidPosition() {
        var cursor=new NotificationCursor(scope,now.minusSeconds(1),UUID.fromString("ffffffff-0000-0000-0000-000000000001"));
        String token=codec.encode(cursor); assertThat(codec.decode(token,scope)).isEqualTo(cursor);
        assertThat(token).doesNotContain("cursor-a",scope.recipient().userId().toString());
        for(var other:List.of(new NotificationScope(new NotificationRecipient(TenantId.of("cursor-b"),scope.recipient().userId()),scope.establishmentsByType()),
                new NotificationScope(new NotificationRecipient(scope.recipient().tenantId(),new UUID(0,2)),scope.establishmentsByType()),
                new NotificationScope(scope.recipient(),Map.of())))
            assertThatThrownBy(()->codec.decode(token,other)).isInstanceOf(IllegalArgumentException.class).hasMessage("Cursor inválido o caducado");
    }
    @Test void rejectsTamperingExpiryNonCanonicalMalformedAndOtherKeyWithoutEcho() {
        String token=codec.encode(new NotificationCursor(scope,now,new UUID(0,1)));
        for(String invalid:List.of("", "private-canary",token+"=",token.substring(0,12)+"!", "a".repeat(2049)))
            assertThatThrownBy(()->codec.decode(invalid,scope)).isInstanceOf(IllegalArgumentException.class).hasMessage("Cursor inválido o caducado");
        var bytes=Base64.getUrlDecoder().decode(token); bytes[10]^=1;
        assertThatThrownBy(()->codec.decode(Base64.getUrlEncoder().withoutPadding().encodeToString(bytes),scope)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(()->new NotificationCursorCodec(secret,Clock.fixed(now.plusSeconds(900),ZoneOffset.UTC)).decode(token,scope)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(()->new NotificationCursorCodec(secret+"other",Clock.fixed(now,ZoneOffset.UTC)).decode(token,scope)).isInstanceOf(IllegalArgumentException.class);
    }
}
