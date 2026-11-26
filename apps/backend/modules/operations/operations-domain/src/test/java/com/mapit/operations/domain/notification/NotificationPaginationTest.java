package com.mapit.operations.domain.notification;

import static com.mapit.operations.domain.notification.NotificationFixtures.*;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatIllegalArgumentException;
import static org.assertj.core.api.Assertions.assertThatNullPointerException;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;
import org.junit.jupiter.params.provider.ValueSource;

class NotificationPaginationTest {
    @ParameterizedTest
    @ValueSource(ints = {-1, 0, 101, Integer.MAX_VALUE})
    void rechaza_paginas_sin_limite_valido(int limit) {
        assertThatIllegalArgumentException().isThrownBy(() -> new NotificationPageRequest(scope(OWNER), limit, null));
    }

    @Test
    void la_peticion_y_el_cursor_exigen_ambito_y_posicion_completos() {
        assertThatNullPointerException().isThrownBy(() -> new NotificationPageRequest(null, 1, null));
        assertThatNullPointerException().isThrownBy(() -> new NotificationCursor(null, CREATED_AT, id(30)));
        assertThatNullPointerException().isThrownBy(() -> new NotificationCursor(scope(OWNER), null, id(30)));
        assertThatNullPointerException().isThrownBy(() -> new NotificationCursor(scope(OWNER), CREATED_AT, null));
        assertThat(new NotificationPageRequest(scope(OWNER), 100, null).limit()).isEqualTo(100);
    }

    @ParameterizedTest
    @MethodSource("com.mapit.operations.domain.notification.NotificationTest#unauthorizedScopes")
    void un_cursor_no_puede_trasladarse_a_otro_usuario_tenant_o_concesion(NotificationScope scope) {
        NotificationCursor cursor = new NotificationCursor(scope(OWNER), CREATED_AT, id(30));
        assertThatIllegalArgumentException()
                .isThrownBy(() -> new NotificationPageRequest(scope, 10, cursor))
                .withMessage("El cursor no corresponde al ámbito vigente");
    }

    @Test
    void la_pagina_rechaza_datos_de_usuario_tenant_tipo_y_establecimiento_ajenos() {
        NotificationPageRequest request = new NotificationPageRequest(
                new NotificationScope(OWNER, Map.of(NotificationType.RESERVATION_CREATED, Set.of(ESTABLISHMENT))), 10, null);
        List<Notification> hidden = List.of(
                notice(30, 40, OTHER_USER, NotificationType.RESERVATION_CREATED, ESTABLISHMENT, CREATED_AT),
                notice(31, 41, OTHER_COMPANY, NotificationType.RESERVATION_CREATED, ESTABLISHMENT, CREATED_AT),
                notice(32, 42, OWNER, NotificationType.RESERVATION_CREATED, OTHER_ESTABLISHMENT, CREATED_AT),
                notice(33, 43, OWNER, NotificationType.RESERVATION_CHECKED_IN, ESTABLISHMENT, CREATED_AT));
        for (Notification notification : hidden) {
            assertThatIllegalArgumentException()
                    .isThrownBy(() -> new NotificationPage(request, List.of(notification), false))
                    .withMessage("La página contiene una notificación fuera del ámbito solicitado");
        }
    }

    @Test
    void copia_contenido_y_calcula_cursor_solo_si_hay_mas_resultados() {
        NotificationPageRequest request = new NotificationPageRequest(scope(OWNER), 1, null);
        List<Notification> content = new ArrayList<>(List.of(notice(30)));
        NotificationPage page = new NotificationPage(request, content, true);
        content.clear();

        assertThat(page.content()).containsExactly(notice(30));
        assertThat(page.nextCursor()).contains(new NotificationCursor(scope(OWNER), CREATED_AT, id(30)));
        assertThatThrownBy(() -> page.content().clear()).isInstanceOf(UnsupportedOperationException.class);
        assertThat(new NotificationPage(request, List.of(notice(30)), false).nextCursor()).isEmpty();
        assertThat(new NotificationPage(request, List.of(), false).nextCursor()).isEmpty();
    }

    @Test
    void rechaza_exceso_duplicados_y_orden_incorrecto() {
        Notification first = notice(30);
        Notification laterId = notice(31);
        NotificationPageRequest request = new NotificationPageRequest(scope(OWNER), 2, null);
        Notification duplicateEvent = notice(32, 30, OWNER, NotificationType.RESERVATION_CREATED, ESTABLISHMENT, CREATED_AT);

        assertThatIllegalArgumentException().isThrownBy(() -> new NotificationPage(
                new NotificationPageRequest(scope(OWNER), 1, null), List.of(laterId, first), false));
        assertThatIllegalArgumentException().isThrownBy(() -> new NotificationPage(request, List.of(first, first), false));
        assertThatIllegalArgumentException().isThrownBy(() -> new NotificationPage(request, List.of(duplicateEvent, first), false));
        assertThatIllegalArgumentException().isThrownBy(() -> new NotificationPage(request, List.of(first, laterId), false));
        assertThatIllegalArgumentException().isThrownBy(() -> new NotificationPage(request, List.of(), true));
    }

    @Test
    void desempata_uuid_sin_orden_signed_y_no_repite_la_frontera_del_cursor() {
        Notification low = withId("7fffffff-ffff-ffff-ffff-ffffffffffff", 40);
        Notification high = withId("80000000-0000-0000-0000-000000000000", 41);
        NotificationPage first = new NotificationPage(new NotificationPageRequest(scope(OWNER), 1, null), List.of(high), true);
        NotificationPageRequest next = new NotificationPageRequest(scope(OWNER), 1, first.nextCursor().orElseThrow());

        assertThat(List.of(low, high).stream().sorted(Notification.NEWEST_FIRST).toList()).containsExactly(high, low);
        assertThat(next.includes(low)).isTrue();
        assertThat(next.includes(high)).isFalse();
        assertThat(next.includes(notice(42, 42, OWNER, NotificationType.RESERVATION_CREATED,
                ESTABLISHMENT, CREATED_AT.plusSeconds(1)))).isFalse();
        assertThatIllegalArgumentException().isThrownBy(() -> new NotificationPage(next, List.of(high), false));
        assertThat(new NotificationPage(next, List.of(low), false).content()).containsExactly(low);
    }

    private static Notification withId(String id, long eventId) {
        Notification original = notice(eventId);
        return Notification.unread(UUID.fromString(id), OWNER, original.event(), CREATED_AT);
    }
}
