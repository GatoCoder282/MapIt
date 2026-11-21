package com.mapit.operations.application.notification;

import static com.mapit.operations.application.notification.NotificationUseCaseFixtures.*;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.Optional;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.stream.Stream;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;

import com.mapit.operations.domain.notification.NotificationRecipient;
import com.mapit.operations.domain.notification.NotificationScope;

class CurrentNotificationScopeTest {
    @Test
    void resuelve_solo_la_identidad_del_servidor_y_no_cachea_el_ambito() {
        AtomicInteger resolutions = new AtomicInteger();
        CurrentNotificationScope current = new CurrentNotificationScope(
                () -> Optional.of(OWNER.userId()), () -> Optional.of(TENANT), authenticated -> {
                    assertThat(authenticated).isEqualTo(OWNER);
                    resolutions.incrementAndGet();
                    return Optional.of(scope(authenticated));
                });

        assertThat(current.require()).isEqualTo(scope(OWNER));
        assertThat(current.require()).isEqualTo(scope(OWNER));
        assertThat(resolutions).hasValue(2);
    }

    @ParameterizedTest
    @MethodSource("otherRecipients")
    void rechaza_ambitos_de_otro_usuario_o_tenant_sin_revelar_identificadores(NotificationRecipient recipient) {
        CurrentNotificationScope current = new CurrentNotificationScope(
                () -> Optional.of(OWNER.userId()), () -> Optional.of(TENANT), ignored -> Optional.of(scope(recipient)));

        assertThatThrownBy(current::require).isInstanceOf(NotificationAccessDeniedException.class)
                .hasMessage("Acceso a notificaciones no autorizado");
    }

    static Stream<NotificationRecipient> otherRecipients() {
        return Stream.of(OTHER_USER, OTHER_COMPANY);
    }

    @Test
    void un_ambito_vacio_no_se_convierte_en_acceso_global() {
        NotificationScope empty = new NotificationScope(OWNER, java.util.Map.of());
        CurrentNotificationScope current = new CurrentNotificationScope(
                () -> Optional.of(OWNER.userId()), () -> Optional.of(TENANT), ignored -> Optional.of(empty));

        assertThat(current.require()).isEqualTo(empty);
        assertThat(current.require().permits(notice(30))).isFalse();
    }
}
