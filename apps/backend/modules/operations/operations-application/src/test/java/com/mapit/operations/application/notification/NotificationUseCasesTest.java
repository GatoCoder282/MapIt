package com.mapit.operations.application.notification;

import static com.mapit.operations.application.notification.NotificationUseCaseFixtures.*;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Stream;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;
import org.junit.jupiter.params.provider.ValueSource;

import com.mapit.operations.domain.notification.Notification;
import com.mapit.operations.domain.notification.NotificationAuthorizationPort;
import com.mapit.operations.domain.notification.NotificationCursor;
import com.mapit.operations.domain.notification.NotificationPage;
import com.mapit.operations.domain.notification.NotificationPageRequest;
import com.mapit.operations.domain.notification.NotificationScope;
import com.mapit.operations.domain.notification.NotificationType;
import com.mapit.shared.tenant.TenantId;

class NotificationUseCasesTest {
    private final Repository repository = new Repository();
    private UUID user = OWNER.userId();
    private TenantId tenant = TENANT;
    private Map<NotificationType, Set<UUID>> grants = GRANTS;
    private NotificationAuthorizationPort authorization = authenticated -> Optional.of(new NotificationScope(authenticated, grants));
    private final CurrentNotificationScope current = new CurrentNotificationScope(
            () -> Optional.ofNullable(user), () -> Optional.ofNullable(tenant), authenticated -> authorization.resolve(authenticated));
    private final ListMyNotifications list = new ListMyNotifications(repository, current);
    private final CountMyUnreadNotifications count = new CountMyUnreadNotifications(repository, current);
    private final MarkMyNotificationRead mark = new MarkMyNotificationRead(repository, current, CLOCK);
    private final MarkAllMyNotificationsRead markAll = new MarkAllMyNotificationsRead(repository, current, CLOCK);

    @ParameterizedTest
    @ValueSource(strings = {"list", "count", "mark", "all"})
    void sin_usuario_no_consulta_ni_modifica_el_repositorio(String operation) {
        user = null;
        authorization = ignored -> { throw new AssertionError("No debe autorizar sin identidad"); };

        assertThatThrownBy(() -> invoke(operation)).isInstanceOf(NotificationAuthenticationRequiredException.class)
                .hasMessage("Se requiere una identidad autenticada para consultar notificaciones");
        assertThat(repository.calls()).isZero();
    }

    @ParameterizedTest
    @ValueSource(strings = {"list", "count", "mark", "all"})
    void sin_tenant_no_consulta_ni_modifica_el_repositorio(String operation) {
        tenant = null;
        authorization = ignored -> { throw new AssertionError("No debe autorizar sin tenant"); };

        assertThatThrownBy(() -> invoke(operation)).isInstanceOf(NotificationAuthenticationRequiredException.class);
        assertThat(repository.calls()).isZero();
    }

    @ParameterizedTest
    @ValueSource(strings = {"list", "count", "mark", "all"})
    void autorizacion_denegada_impide_toda_operacion(String operation) {
        authorization = ignored -> Optional.empty();

        assertThatThrownBy(() -> invoke(operation)).isInstanceOf(NotificationAccessDeniedException.class)
                .hasMessage("Acceso a notificaciones no autorizado");
        assertThat(repository.calls()).isZero();
    }

    @ParameterizedTest
    @ValueSource(strings = {"list", "count", "mark", "all"})
    void un_ambito_con_otro_destinatario_falla_antes_del_repositorio(String operation) {
        authorization = ignored -> Optional.of(scope(OTHER_USER));

        assertThatThrownBy(() -> invoke(operation)).isInstanceOf(NotificationAccessDeniedException.class);
        assertThat(repository.calls()).isZero();
    }

    @ParameterizedTest
    @ValueSource(strings = {"list", "count", "mark", "all"})
    void error_al_resolver_permisos_no_usa_un_ambito_anterior(String operation) {
        current.require();
        authorization = ignored -> { throw new IllegalStateException("Autorización no disponible"); };

        assertThatThrownBy(() -> invoke(operation)).isInstanceOf(IllegalStateException.class);
        assertThat(repository.calls()).isZero();
    }

    @Test
    void lista_solo_notificaciones_autorizadas_con_cursor_y_orden_mas_recientes_primero() {
        Notification older = notice(30);
        Notification tied = notice(31);
        Notification newest = notice(32, OWNER, NotificationType.RESERVATION_CREATED, ESTABLISHMENT, CREATED_AT.plusSeconds(1));
        Notification foreignUser = notice(33, OTHER_USER, NotificationType.RESERVATION_CREATED, ESTABLISHMENT, CREATED_AT);
        Notification foreignTenant = notice(34, OTHER_COMPANY, NotificationType.RESERVATION_CREATED, ESTABLISHMENT, CREATED_AT);
        Notification foreignEstablishment = notice(35, OWNER, NotificationType.RESERVATION_CREATED, OTHER_ESTABLISHMENT, CREATED_AT);
        repository.seed(older, tied, newest, foreignUser, foreignTenant, foreignEstablishment);

        NotificationPage first = list.execute(2, null);
        NotificationPage second = list.execute(2, first.nextCursor().orElseThrow());

        assertThat(first.content()).containsExactly(newest, tied);
        assertThat(second.content()).containsExactly(older);
        assertThat(second.nextCursor()).isEmpty();
        assertThat(repository.lastScope).isEqualTo(scope(OWNER));
        assertThat(repository.rows.values()).containsExactlyInAnyOrder(older, tied, newest, foreignUser, foreignTenant, foreignEstablishment);
    }

    @ParameterizedTest
    @ValueSource(ints = {-1, 0, 101, Integer.MAX_VALUE})
    void limites_invalidos_no_llegan_a_persistencia(int limit) {
        assertThatThrownBy(() -> list.execute(limit, null)).isInstanceOf(IllegalArgumentException.class)
                .hasMessage("El límite debe estar entre 1 y 100");
        assertThat(repository.calls()).isZero();
    }

    @ParameterizedTest
    @MethodSource("invalidCursorScopes")
    void rechaza_cursores_de_otro_usuario_tenant_o_permisos(NotificationScope staleScope) {
        NotificationCursor cursor = new NotificationCursor(staleScope, CREATED_AT, id(30));

        assertThatThrownBy(() -> list.execute(10, cursor)).isInstanceOf(IllegalArgumentException.class)
                .hasMessage("El cursor no corresponde al ámbito vigente");
        assertThat(repository.calls()).isZero();
    }

    static Stream<NotificationScope> invalidCursorScopes() {
        return Stream.of(scope(OTHER_USER), scope(OTHER_COMPANY), new NotificationScope(OWNER, Map.of()));
    }

    @Test
    void contador_y_marcado_comparten_permisos_por_tipo_y_lectura_persistida() {
        grants = Map.of(NotificationType.RESERVATION_CREATED, Set.of(ESTABLISHMENT));
        Notification read = notice(31).markRead(scope(OWNER), CREATED_AT).orElseThrow();
        repository.seed(notice(30), read,
                notice(32, OWNER, NotificationType.RESERVATION_CHECKED_IN, ESTABLISHMENT, CREATED_AT),
                notice(33, OTHER_USER, NotificationType.RESERVATION_CREATED, ESTABLISHMENT, CREATED_AT),
                notice(34, OTHER_COMPANY, NotificationType.RESERVATION_CREATED, ESTABLISHMENT, CREATED_AT));

        assertThat(count.execute()).isEqualTo(1);
        assertThat(mark.execute(id(32))).isEmpty();
        assertThat(mark.execute(id(30)).orElseThrow().readAt()).isEqualTo(NOW);
        assertThat(count.execute()).isZero();
        assertThat(repository.rows.get(read.key())).isEqualTo(read);
    }

    @Test
    void marcado_individual_usa_reloj_del_servidor_y_conserva_la_primera_lectura() {
        repository.seed(notice(30));

        Notification first = mark.execute(id(30)).orElseThrow();
        MarkMyNotificationRead later = new MarkMyNotificationRead(repository, current,
                java.time.Clock.offset(CLOCK, java.time.Duration.ofSeconds(5)));

        assertThat(later.execute(id(30))).contains(first);
        assertThat(first.readAt()).isEqualTo(NOW);
        assertThat(repository.lastReadAt).isEqualTo(NOW.plusSeconds(5));
        assertThat(count.execute()).isZero();
    }

    @Test
    void marcado_ajeno_e_inexistente_tienen_resultado_vacio_y_no_modifican_nada() {
        Notification otherUser = notice(30, OTHER_USER, NotificationType.RESERVATION_CREATED, ESTABLISHMENT, CREATED_AT);
        Notification otherTenant = notice(31, OTHER_COMPANY, NotificationType.RESERVATION_CREATED, ESTABLISHMENT, CREATED_AT);
        Notification otherEstablishment = notice(32, OWNER, NotificationType.RESERVATION_CREATED, OTHER_ESTABLISHMENT, CREATED_AT);
        repository.seed(otherUser, otherTenant, otherEstablishment);

        assertThat(mark.execute(id(30))).isEmpty();
        assertThat(mark.execute(id(31))).isEmpty();
        assertThat(mark.execute(id(32))).isEmpty();
        assertThat(mark.execute(id(999))).isEmpty();
        assertThat(repository.rows.values()).containsExactlyInAnyOrder(otherUser, otherTenant, otherEstablishment);
    }

    @Test
    void marcado_total_es_una_operacion_acotada_idempotente_y_no_toca_ajenas_o_posteriores() {
        grants = Map.of(NotificationType.RESERVATION_CREATED, Set.of(ESTABLISHMENT));
        Notification read = notice(31).markRead(scope(OWNER), CREATED_AT).orElseThrow();
        List<Notification> untouched = List.of(read,
                notice(32, OTHER_USER, NotificationType.RESERVATION_CREATED, ESTABLISHMENT, CREATED_AT),
                notice(33, OTHER_COMPANY, NotificationType.RESERVATION_CREATED, ESTABLISHMENT, CREATED_AT),
                notice(34, OWNER, NotificationType.RESERVATION_CREATED, OTHER_ESTABLISHMENT, CREATED_AT),
                notice(35, OWNER, NotificationType.RESERVATION_CHECKED_IN, ESTABLISHMENT, CREATED_AT),
                notice(36, OWNER, NotificationType.RESERVATION_CREATED, ESTABLISHMENT, NOW.plusSeconds(1)));
        repository.seed(untouched.toArray(Notification[]::new));
        repository.seed(notice(30));

        assertThat(markAll.execute()).isEqualTo(1);
        assertThat(markAll.execute()).isZero();
        assertThat(repository.lastReadAt).isEqualTo(NOW);
        assertThat(repository.markAllCalls).isEqualTo(2);
        assertThat(repository.listCalls + repository.markCalls + repository.countCalls).isZero();
        assertThat(repository.rows.values()).containsAll(untouched);
        assertThat(repository.rows.get(notice(30).key()).readAt()).isEqualTo(NOW);
    }

    @Test
    void una_llegada_tras_la_instantanea_sigue_no_leida_aunque_su_fecha_de_creacion_sea_anterior() {
        repository.seed(notice(30));
        Notification arrivedLater = notice(31);
        repository.afterBulkSnapshot = () -> repository.seed(arrivedLater);

        assertThat(markAll.execute()).isEqualTo(1);
        assertThat(repository.rows.get(arrivedLater.key())).isEqualTo(arrivedLater);
        assertThat(count.execute()).isEqualTo(1);
    }

    @Test
    void cambio_de_identidad_o_permisos_no_reutiliza_datos_ni_cursor_anteriores() {
        repository.seed(notice(30), notice(31), notice(32, OTHER_USER,
                NotificationType.RESERVATION_CREATED, ESTABLISHMENT, CREATED_AT));
        NotificationCursor oldCursor = list.execute(1, null).nextCursor().orElseThrow();
        user = OTHER_USER.userId();

        assertThat(count.execute()).isEqualTo(1);
        assertThat(mark.execute(id(30))).isEmpty();
        assertThatThrownBy(() -> list.execute(10, oldCursor)).isInstanceOf(IllegalArgumentException.class);
        grants = Map.of();
        assertThat(count.execute()).isZero();
        assertThat(markAll.execute()).isZero();
        assertThat(list.execute(10, null).content()).isEmpty();
    }

    @Test
    void cambio_de_tenant_con_el_mismo_uuid_recalcula_el_ambito() {
        Notification sameUserOtherTenant = notice(31, OTHER_COMPANY,
                NotificationType.RESERVATION_CREATED, ESTABLISHMENT, CREATED_AT);
        repository.seed(notice(30), sameUserOtherTenant);
        assertThat(count.execute()).isEqualTo(1);
        tenant = OTHER_TENANT;

        assertThat(list.execute(10, null).content()).containsExactly(sameUserOtherTenant);
        assertThat(mark.execute(id(30))).isEmpty();
        assertThat(markAll.execute()).isEqualTo(1);
        assertThat(repository.rows.get(notice(30).key()).isUnread()).isTrue();
    }

    @Test
    void detecta_pagina_de_otro_ambito_y_contadores_invalidos_sin_exponer_sus_datos() {
        NotificationPageRequest foreign = new NotificationPageRequest(scope(OTHER_USER), 10, null);
        repository.overridePage = new NotificationPage(foreign, List.of(), false);
        assertThatThrownBy(() -> list.execute(10, null)).isInstanceOf(IllegalStateException.class)
                .hasMessage("Respuesta inválida del repositorio de notificaciones");
        repository.overrideCount = -1L;
        assertThatThrownBy(count::execute).isInstanceOf(IllegalStateException.class);
        repository.overrideAll = -1L;
        assertThatThrownBy(markAll::execute).isInstanceOf(IllegalStateException.class);
    }

    @Test
    void detecta_resultados_de_marcado_ajenos_sin_confiar_en_el_adaptador() {
        Notification foreign = notice(30, OTHER_USER, NotificationType.RESERVATION_CREATED, ESTABLISHMENT, CREATED_AT);
        repository.overrideRead = foreign.markRead(scope(OTHER_USER), NOW);
        assertThatThrownBy(() -> mark.execute(id(30))).isInstanceOf(IllegalStateException.class);
        repository.overrideRead = Optional.of(notice(30));
        assertThatThrownBy(() -> mark.execute(id(30))).isInstanceOf(IllegalStateException.class);
        repository.overrideRead = notice(31).markRead(scope(OWNER), NOW);
        assertThatThrownBy(() -> mark.execute(id(30))).isInstanceOf(IllegalStateException.class);
    }

    private void invoke(String operation) {
        switch (operation) {
            case "list" -> list.execute(10, null);
            case "count" -> count.execute();
            case "mark" -> mark.execute(id(30));
            case "all" -> markAll.execute();
            default -> throw new AssertionError("Operación de test desconocida");
        }
    }
}
