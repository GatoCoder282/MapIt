package com.mapit.operations.application.notification;
import static org.assertj.core.api.Assertions.*;

import java.util.*;

import org.junit.jupiter.api.Test;

import com.mapit.operations.domain.notification.*;
import com.mapit.shared.tenant.TenantId;

class MyNotificationPreferencesTest {
    final UUID user=UUID.randomUUID();
    final Map<NotificationRecipient,Map<NotificationCategory,Boolean>> saved=new HashMap<>();
    int writes;
    final NotificationPreferencesPort port=new NotificationPreferencesPort(){
        public Map<NotificationCategory,Boolean> read(NotificationRecipient recipient){return saved.getOrDefault(recipient,Map.of(NotificationCategory.RESERVATIONS,true,NotificationCategory.OPERATIONS,true));}
        public Map<NotificationCategory,Boolean> patch(NotificationRecipient recipient,Map<NotificationCategory,Boolean> changes){writes++;var values=new EnumMap<NotificationCategory,Boolean>(NotificationCategory.class);values.putAll(read(recipient));values.putAll(changes);saved.put(recipient,Map.copyOf(values));return read(recipient);}
    };
    MyNotificationPreferences own(String tenant,UUID id){return new MyNotificationPreferences(new CurrentNotificationScope(()->Optional.of(id),()->Optional.of(TenantId.of(tenant)),recipient->Optional.of(new NotificationScope(recipient,Map.of()))),port);}
    @Test void conserva_ausentes_y_aisla_mismo_tenant_y_otro_tenant(){
        var a=own("tenant-a",user);a.patch(Map.of(NotificationCategory.RESERVATIONS,false));
        assertThat(a.read()).containsEntry(NotificationCategory.RESERVATIONS,false).containsEntry(NotificationCategory.OPERATIONS,true);
        assertThat(own("tenant-a",UUID.randomUUID()).read()).containsEntry(NotificationCategory.RESERVATIONS,true);
        assertThat(own("tenant-b",user).read()).containsEntry(NotificationCategory.RESERVATIONS,true);
    }
    @Test void valida_todo_antes_de_escribir_y_rechaza_nulos_o_vacio(){
        var a=own("tenant-a",user);var invalid=new EnumMap<NotificationCategory,Boolean>(NotificationCategory.class);invalid.put(NotificationCategory.RESERVATIONS,false);invalid.put(NotificationCategory.OPERATIONS,null);
        assertThatThrownBy(()->a.patch(invalid)).isInstanceOf(IllegalArgumentException.class);assertThatThrownBy(()->a.patch(Map.of())).isInstanceOf(IllegalArgumentException.class);assertThat(writes).isZero();
    }
    @Test void requiere_identidad_y_ambito_vigentes_antes_del_repositorio(){
        var missing=new MyNotificationPreferences(new CurrentNotificationScope(Optional::<UUID>empty,()->Optional.of(TenantId.of("tenant-a")),recipient->Optional.empty()),port);
        assertThatThrownBy(missing::read).isInstanceOf(NotificationAuthenticationRequiredException.class);
        var denied=new MyNotificationPreferences(new CurrentNotificationScope(()->Optional.of(user),()->Optional.of(TenantId.of("tenant-a")),recipient->Optional.empty()),port);
        assertThatThrownBy(()->denied.patch(Map.of(NotificationCategory.OPERATIONS,false))).isInstanceOf(NotificationAccessDeniedException.class);assertThat(writes).isZero();
    }
}
