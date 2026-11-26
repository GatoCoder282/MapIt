package com.mapit.operations.domain.notification;
import java.util.Map;
/** Solo categorías optativas propias. Ausencia equivale a ON; seguridad no forma parte del catálogo editable. */
public interface NotificationPreferencesPort {
    Map<NotificationCategory, Boolean> read(NotificationRecipient recipient);
    Map<NotificationCategory, Boolean> patch(NotificationRecipient recipient, Map<NotificationCategory, Boolean> changes);
}
