package com.mapit.operations.application.notification;
import java.util.Map;

import org.springframework.transaction.annotation.Transactional;

import com.mapit.operations.domain.notification.*;

/** Identidad y ámbito exclusivamente del principal del servidor. */
public class MyNotificationPreferences {
    private final CurrentNotificationScope scopes;
    private final NotificationPreferencesPort preferences;
    public MyNotificationPreferences(CurrentNotificationScope scopes,NotificationPreferencesPort preferences) { this.scopes=scopes;this.preferences=preferences; }
    @Transactional(readOnly=true)
    public Map<NotificationCategory,Boolean> read() { return preferences.read(scopes.require().recipient()); }
    @Transactional
    public Map<NotificationCategory,Boolean> patch(Map<NotificationCategory,Boolean> changes) {
        var recipient=scopes.require().recipient();
        if(changes.isEmpty() || changes.entrySet().stream().anyMatch(e->e.getKey()==null || e.getValue()==null)) throw new IllegalArgumentException("Preferencias inválidas");
        return preferences.patch(recipient,Map.copyOf(changes));
    }
}
