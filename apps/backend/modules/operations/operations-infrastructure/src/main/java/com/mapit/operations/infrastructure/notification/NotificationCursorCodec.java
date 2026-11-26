package com.mapit.operations.infrastructure.notification;

import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.MessageDigest;
import java.time.Clock;
import java.time.Instant;
import java.util.Arrays;
import java.util.Base64;
import java.util.UUID;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import com.mapit.operations.domain.notification.*;

/** Token opaco autenticado; solo contiene posición, caducidad y huella del ámbito, nunca grants/identidad en claro. */
@Component
public class NotificationCursorCodec {
    private static final int PAYLOAD=69, LENGTH=101;
    private final SecretKeySpec key;
    private final Clock clock;
    public NotificationCursorCodec(@Value("${mapit.jwt.secret}") String secret, Clock clock) {
        if (secret.getBytes(StandardCharsets.UTF_8).length<32) throw new IllegalArgumentException("Clave de cursor inválida");
        key=new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8),"HmacSHA256"); this.clock=clock;
    }
    public String encode(NotificationCursor cursor) {
        var bytes=ByteBuffer.allocate(LENGTH).put((byte)1).putLong(cursor.createdAt().getEpochSecond()).putInt(cursor.createdAt().getNano())
                .putLong(cursor.notificationId().getMostSignificantBits()).putLong(cursor.notificationId().getLeastSignificantBits())
                .putLong(clock.instant().plusSeconds(900).getEpochSecond()).put(scope(cursor.scope()));
        bytes.put(mac("cursor",Arrays.copyOf(bytes.array(),PAYLOAD)));
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes.array());
    }
    public NotificationCursor decode(String encoded, NotificationScope scope) {
        try {
            if (encoded.length()>2048 || !encoded.matches("[A-Za-z0-9_-]+")) throw invalid();
            byte[] bytes=Base64.getUrlDecoder().decode(encoded);
            if (bytes.length!=LENGTH || !Base64.getUrlEncoder().withoutPadding().encodeToString(bytes).equals(encoded)
                    || !MessageDigest.isEqual(Arrays.copyOfRange(bytes,PAYLOAD,LENGTH),mac("cursor",Arrays.copyOf(bytes,PAYLOAD)))) throw invalid();
            var value=ByteBuffer.wrap(bytes);
            if(value.get()!=1) throw invalid();
            long seconds=value.getLong(); int nanos=value.getInt();
            if(nanos<0 || nanos>=1_000_000_000 || nanos%1000!=0) throw invalid();
            var at=Instant.ofEpochSecond(seconds,nanos);
            var id=new UUID(value.getLong(),value.getLong());
            long expiry=value.getLong(); byte[] fingerprint=new byte[32]; value.get(fingerprint);
            if(expiry<=clock.instant().getEpochSecond() || !MessageDigest.isEqual(fingerprint,scope(scope))) throw invalid();
            return new NotificationCursor(scope,at,id);
        } catch (IllegalArgumentException | java.time.DateTimeException invalid) { throw invalid(); }
    }
    private byte[] scope(NotificationScope scope) {
        var data=new StringBuilder(scope.recipient().tenantId().value()).append('|').append(scope.recipient().userId());
        for(var type:NotificationType.values()) {
            data.append('|').append(type.name());
            scope.establishmentsByType().getOrDefault(type,java.util.Set.of()).stream().map(UUID::toString).sorted().forEach(id->data.append(':').append(id));
        }
        return mac("scope",data.toString().getBytes(StandardCharsets.UTF_8));
    }
    private byte[] mac(String purpose, byte[] data) {
        try { var mac=Mac.getInstance("HmacSHA256"); mac.init(key); mac.update(("mapit.notifications.v1:"+purpose+":").getBytes(StandardCharsets.UTF_8)); return mac.doFinal(data); }
        catch(GeneralSecurityException impossible) { throw new IllegalStateException("No se pudo validar el cursor"); }
    }
    private static IllegalArgumentException invalid() { return new IllegalArgumentException("Cursor inválido o caducado"); }
}
