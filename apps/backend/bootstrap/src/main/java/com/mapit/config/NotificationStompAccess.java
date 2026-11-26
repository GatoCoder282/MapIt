package com.mapit.config;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.HexFormat;

import org.springframework.stereotype.Component;

import com.mapit.identity.domain.AuthenticatedPrincipal;
import com.mapit.operations.domain.notification.*;
import com.mapit.shared.flags.*;

/** Gate privado posterior a MAP-238, nunca sustituto de autorización. */
@Component
public class NotificationStompAccess {
    private final NotificationAuthorizationPort authorization;
    private final FeatureFlagPort flags;
    public NotificationStompAccess(NotificationAuthorizationPort authorization,FeatureFlagPort flags) { this.authorization=authorization;this.flags=flags; }
    public boolean allowed(AuthenticatedPrincipal principal,String sessionKey) {
        try {
            var recipient=new NotificationRecipient(principal.tenantId(),principal.id());
            var scope=authorization.resolve(recipient);
            return scope.isPresent() && scope.orElseThrow().recipient().equals(recipient)
                && flags.isEnabledFor(FeatureFlag.MAPIT_S6_NOTIFICATION_CENTER,new FeatureFlagContext(principal.tenantId(),principal.id(),sessionKey));
        } catch(RuntimeException unavailable) { return false; }
    }
    static String sessionKey(String bearer) {
        try { return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(("notification-session-v1:"+bearer).getBytes(StandardCharsets.UTF_8))); }
        catch(java.security.NoSuchAlgorithmException impossible) { throw new IllegalStateException(); }
    }
}
