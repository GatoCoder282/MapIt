package com.mapit.operations.application.notification;

import static com.mapit.operations.application.notification.NotificationEventFixtures.*;
import static com.mapit.operations.application.notification.NotificationUseCaseFixtures.*;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Stream;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.MethodSource;

import com.mapit.operations.domain.notification.NotificationEvent;
import com.mapit.operations.domain.notification.NotificationRecipient;
import com.mapit.operations.domain.notification.NotificationScope;
import com.mapit.operations.domain.notification.NotificationType;

class ResolveNotificationRecipientsTest {
    private final RecipientPorts ports = new RecipientPorts();

    /** Resultados del contrato de permisos existente; no reimplementa su SQL ni prueba roles reales. */
    @ParameterizedTest(name = "{0}: {1}")
    @CsvSource({
            "RESERVATION_CREATED, ADMIN, true, true, true",
            "RESERVATION_CREATED, MANAGER, true, false, true",
            "RESERVATION_CREATED, STAFF_con_concesion, true, true, true",
            "RESERVATION_CREATED, STAFF_sin_concesion, false, false, false",
            "RESERVATION_CREATED, SUPER_ADMIN, false, false, false",
            "RESERVATION_CHECKED_IN, ADMIN, true, true, true",
            "RESERVATION_CHECKED_IN, MANAGER, true, false, false",
            "RESERVATION_CHECKED_IN, STAFF_con_concesion, true, true, true",
            "RESERVATION_CHECKED_IN, STAFF_sin_concesion, false, false, false",
            "RESERVATION_CHECKED_IN, SUPER_ADMIN, false, false, false"
    })
    void selecciona_por_el_predicado_existente_del_tipo_sin_ampliar_roles(
            NotificationType type, String roleScenario, boolean canRead, boolean canCheckIn, boolean allowed) {
        ports.canRead = canRead;
        ports.canCheckIn = canCheckIn;
        NotificationEvent event = event(type);

        Set<NotificationRecipient> result = ports.resolver().execute(event);

        assertThat(result).as(roleScenario).isEqualTo(allowed ? Set.of(OWNER) : Set.of());
        assertThat(ports.lastEvent).isSameAs(event);
        assertThat(ports.checkedTenant).isEqualTo(TENANT);
        assertThat(ports.checkedUser).isEqualTo(OWNER.userId());
        assertThat(ports.checkedEstablishment).isEqualTo(ESTABLISHMENT);
        assertThat(ports.readCalls).isEqualTo(type == NotificationType.RESERVATION_CREATED ? 1 : 0);
        assertThat(ports.checkInCalls).isEqualTo(type == NotificationType.RESERVATION_CHECKED_IN ? 1 : 0);
    }

    @Test
    void excluye_cross_tenant_antes_de_autorizar_y_deduplica_candidatos() {
        ports.candidates = List.of(OTHER_COMPANY, OWNER, OWNER);

        assertThat(ports.resolver().execute(event(NotificationType.RESERVATION_CREATED))).containsExactly(OWNER);
        assertThat(ports.authorizationCalls).containsExactly(OWNER);
        assertThat(ports.readCalls).isEqualTo(1);
        assertThat(OTHER_COMPANY.userId()).isEqualTo(OWNER.userId());
    }

    @Test
    void cuenta_o_tenant_no_autorizados_quedan_excluidos_aunque_sean_candidatos() {
        ports.denied.add(OWNER);

        assertThat(ports.resolver().execute(event(NotificationType.RESERVATION_CREATED))).isEmpty();
        assertThat(ports.readCalls + ports.checkInCalls).isZero();
    }

    @ParameterizedTest
    @MethodSource("missingGrants")
    void no_hereda_concesiones_de_otro_tipo_o_establecimiento(NotificationScope scope) {
        ports.scopes.put(OWNER, scope);

        assertThat(ports.resolver().execute(event(NotificationType.RESERVATION_CREATED))).isEmpty();
        assertThat(ports.readCalls + ports.checkInCalls).isZero();
    }

    static Stream<NotificationScope> missingGrants() {
        return Stream.of(new NotificationScope(OWNER, Map.of()),
                new NotificationScope(OWNER, Map.of(NotificationType.RESERVATION_CREATED, Set.of(OTHER_ESTABLISHMENT))),
                new NotificationScope(OWNER, Map.of(NotificationType.RESERVATION_CHECKED_IN, Set.of(ESTABLISHMENT))));
    }

    @ParameterizedTest
    @MethodSource("foreignScopes")
    void un_ambito_devuelto_para_otra_identidad_falla_cerrado(NotificationScope scope) {
        ports.scopes.put(OWNER, scope);

        assertThatThrownBy(() -> ports.resolver().execute(event(NotificationType.RESERVATION_CREATED)))
                .isInstanceOf(NotificationAccessDeniedException.class)
                .hasMessage("Acceso a notificaciones no autorizado");
        assertThat(ports.readCalls + ports.checkInCalls).isZero();
    }

    static Stream<NotificationScope> foreignScopes() {
        return Stream.of(scope(OTHER_USER), scope(OTHER_COMPANY));
    }

    @Test
    void sin_candidatos_no_consulta_permisos_y_el_resultado_es_inmutable() {
        ports.candidates = List.of();
        Set<NotificationRecipient> result = ports.resolver().execute(event(NotificationType.RESERVATION_CREATED));

        assertThat(result).isEmpty();
        assertThat(ports.authorizationCalls).isEmpty();
        assertThat(ports.readCalls + ports.checkInCalls).isZero();
        assertThatThrownBy(() -> result.add(OWNER)).isInstanceOf(UnsupportedOperationException.class);
    }
}
