package com.mapit.operations.domain.notification;

import static com.mapit.operations.domain.notification.NotificationFixtures.*;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatIllegalArgumentException;
import static org.assertj.core.api.Assertions.assertThatNullPointerException;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.EnumMap;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Stream;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.junit.jupiter.params.provider.MethodSource;

import com.mapit.shared.audit.AuditEventType;

class NotificationTest {
    @Test
    void normaliza_precision_postgresql_sin_redondear_el_cursor_ni_la_clave_de_reentrega() {
        var occurred = OCCURRED_AT.plusNanos(123_456_789);
        var event = new NotificationEvent(id(40), TENANT, NotificationType.RESERVATION_CREATED,
                occurred, ESTABLISHMENT, RESERVATION);
        var notification = new Notification(id(30), OWNER, event,
                occurred.plusSeconds(1), occurred.plusSeconds(2));

        assertThat(event.occurredAt()).isEqualTo(occurred.truncatedTo(java.time.temporal.ChronoUnit.MICROS));
        assertThat(notification.createdAt().getNano()).isEqualTo(123_456_000);
        assertThat(notification.readAt().getNano()).isEqualTo(123_456_000);
        var persistedEvent = new NotificationEvent(event.id(), TENANT, event.type(),
                event.occurredAt(), ESTABLISHMENT, RESERVATION);
        assertThat(persistedEvent).isEqualTo(event);
        assertThat(Notification.unread(id(31), OWNER, persistedEvent, notification.createdAt()).key())
                .isEqualTo(notification.key());
    }

    @ParameterizedTest
    @EnumSource(NotificationType.class)
    void nace_no_leida_con_categoria_derivada_y_referencias_minimas(NotificationType type) {
        Notification notification = notice(30, 40, OWNER, type, ESTABLISHMENT, CREATED_AT);

        assertThat(notification.recipient()).isEqualTo(OWNER);
        assertThat(notification.event().tenantId()).isEqualTo(TENANT);
        assertThat(notification.event().establishmentId()).isEqualTo(ESTABLISHMENT);
        assertThat(notification.event().reservationId()).isEqualTo(RESERVATION);
        assertThat(notification.category()).isEqualTo(type.category());
        assertThat(notification.readAt()).isNull();
        assertThat(notification.isUnread()).isTrue();
    }

    @Test
    void los_tipos_apuntan_a_hechos_existentes_sin_crear_eventos_de_solicitudes() {
        assertThat(NotificationType.RESERVATION_CREATED.sourceEventType())
                .isEqualTo(AuditEventType.RESERVATION_CREATED.name());
        assertThat(NotificationType.RESERVATION_CHECKED_IN.sourceEventType())
                .isEqualTo("reservation.checked_in");
        assertThat(NotificationType.RESERVATION_CREATED.category()).isEqualTo(NotificationCategory.RESERVATIONS);
        assertThat(NotificationType.RESERVATION_CHECKED_IN.category()).isEqualTo(NotificationCategory.OPERATIONS);
    }

    @ParameterizedTest
    @MethodSource("missingRequiredData")
    void rechaza_identidad_evento_y_campos_obligatorios_ausentes(Runnable construct) {
        assertThatNullPointerException().isThrownBy(construct::run);
    }

    static Stream<Runnable> missingRequiredData() {
        Notification original = notice(30);
        return Stream.of(
                () -> new NotificationRecipient(null, OWNER.userId()),
                () -> new NotificationRecipient(TENANT, null),
                () -> new NotificationEvent(null, TENANT, NotificationType.RESERVATION_CREATED, OCCURRED_AT, ESTABLISHMENT, RESERVATION),
                () -> new NotificationEvent(id(40), null, NotificationType.RESERVATION_CREATED, OCCURRED_AT, ESTABLISHMENT, RESERVATION),
                () -> new NotificationEvent(id(40), TENANT, null, OCCURRED_AT, ESTABLISHMENT, RESERVATION),
                () -> new NotificationEvent(id(40), TENANT, NotificationType.RESERVATION_CREATED, null, ESTABLISHMENT, RESERVATION),
                () -> new NotificationEvent(id(40), TENANT, NotificationType.RESERVATION_CREATED, OCCURRED_AT, null, RESERVATION),
                () -> new NotificationEvent(id(40), TENANT, NotificationType.RESERVATION_CREATED, OCCURRED_AT, ESTABLISHMENT, null),
                () -> Notification.unread(null, OWNER, original.event(), CREATED_AT),
                () -> Notification.unread(id(30), null, original.event(), CREATED_AT),
                () -> Notification.unread(id(30), OWNER, null, CREATED_AT),
                () -> Notification.unread(id(30), OWNER, original.event(), null),
                () -> new NotificationKey(null, id(40), NotificationType.RESERVATION_CREATED),
                () -> new NotificationKey(OWNER, null, NotificationType.RESERVATION_CREATED),
                () -> new NotificationKey(OWNER, id(40), null),
                () -> new NotificationScope(null, Map.of()),
                () -> new NotificationScope(OWNER, null));
    }

    @Test
    void rechaza_un_evento_de_otro_tenant_aunque_el_uuid_de_usuario_coincida() {
        assertThat(OTHER_COMPANY.userId()).isEqualTo(OWNER.userId());
        assertThatIllegalArgumentException()
                .isThrownBy(() -> Notification.unread(id(30), OTHER_COMPANY, notice(30).event(), CREATED_AT))
                .withMessage("El evento y el destinatario deben pertenecer al mismo tenant");
    }

    @Test
    void rechaza_creacion_y_lectura_anteriores_a_su_origen() {
        Notification original = notice(30);
        assertThatIllegalArgumentException().isThrownBy(() -> Notification.unread(
                id(31), OWNER, original.event(), OCCURRED_AT.minusNanos(1)));
        assertThatIllegalArgumentException().isThrownBy(() -> new Notification(
                original.id(), OWNER, original.event(), CREATED_AT, CREATED_AT.minusNanos(1)));
        assertThatIllegalArgumentException().isThrownBy(() -> original.markRead(
                scope(OWNER), CREATED_AT.minusNanos(1)));
        assertThat(Notification.unread(id(31), OWNER, original.event(), OCCURRED_AT)
                .markRead(scope(OWNER), OCCURRED_AT)).isPresent();
    }

    @Test
    void marcar_es_inmutable_e_idempotente_y_conserva_la_primera_lectura() {
        Notification original = notice(30);
        Notification read = original.markRead(scope(OWNER), CREATED_AT.plusSeconds(5)).orElseThrow();

        assertThat(original.isUnread()).isTrue();
        assertThat(read.isUnread()).isFalse();
        assertThat(read.readAt()).isEqualTo(CREATED_AT.plusSeconds(5));
        assertThat(read.markRead(scope(OWNER), CREATED_AT.plusSeconds(10))).containsSame(read);
        assertThat(read.markRead(scope(OWNER), CREATED_AT.plusSeconds(2))).containsSame(read);
        assertThat(read.event()).isSameAs(original.event());
    }

    @ParameterizedTest
    @MethodSource("unauthorizedScopes")
    void rechaza_otro_usuario_tenant_establecimiento_o_tipo_sin_mutar(NotificationScope scope) {
        Notification original = notice(30);
        assertThat(scope.permits(original)).isFalse();
        assertThat(original.markRead(scope, CREATED_AT)).isEmpty();
        assertThat(original.readAt()).isNull();
    }

    static Stream<NotificationScope> unauthorizedScopes() {
        return Stream.of(
                scope(OTHER_USER), scope(OTHER_COMPANY),
                new NotificationScope(OWNER, Map.of()),
                new NotificationScope(OWNER, Map.of(NotificationType.RESERVATION_CREATED, Set.of())),
                new NotificationScope(OWNER, Map.of(NotificationType.RESERVATION_CREATED, Set.of(OTHER_ESTABLISHMENT))),
                new NotificationScope(OWNER, Map.of(NotificationType.RESERVATION_CHECKED_IN, Set.of(ESTABLISHMENT))));
    }

    @Test
    void las_concesiones_son_copias_profundas_y_no_se_heredan_entre_tipos() {
        Map<NotificationType, Set<UUID>> grants = new EnumMap<>(NotificationType.class);
        Set<UUID> establishments = new HashSet<>(Set.of(ESTABLISHMENT));
        grants.put(NotificationType.RESERVATION_CREATED, establishments);
        NotificationScope scope = new NotificationScope(OWNER, grants);

        establishments.clear();
        grants.put(NotificationType.RESERVATION_CHECKED_IN, Set.of(ESTABLISHMENT));

        assertThat(scope.permits(notice(30))).isTrue();
        assertThat(scope.permits(notice(31, 41, OWNER, NotificationType.RESERVATION_CHECKED_IN,
                ESTABLISHMENT, CREATED_AT))).isFalse();
        assertThatThrownBy(() -> scope.establishmentsByType().clear()).isInstanceOf(UnsupportedOperationException.class);
        assertThatThrownBy(() -> scope.establishmentsByType().get(NotificationType.RESERVATION_CREATED).clear())
                .isInstanceOf(UnsupportedOperationException.class);
    }

    @Test
    void la_clave_estable_ignora_intento_y_lectura_pero_separa_destinatario_tenant_tipo_y_evento() {
        Notification original = notice(30, 40, OWNER, NotificationType.RESERVATION_CREATED, ESTABLISHMENT, CREATED_AT);
        Notification retry = notice(31, 40, OWNER, NotificationType.RESERVATION_CREATED, ESTABLISHMENT, CREATED_AT.plusSeconds(1));
        assertThat(retry.key()).isEqualTo(original.key());
        assertThat(original.markRead(scope(OWNER), CREATED_AT).orElseThrow().key()).isEqualTo(original.key());
        assertThat(new NotificationKey(OTHER_USER, id(40), NotificationType.RESERVATION_CREATED)).isNotEqualTo(original.key());
        assertThat(new NotificationKey(OTHER_COMPANY, id(40), NotificationType.RESERVATION_CREATED)).isNotEqualTo(original.key());
        assertThat(new NotificationKey(OWNER, id(40), NotificationType.RESERVATION_CHECKED_IN)).isNotEqualTo(original.key());
        assertThat(new NotificationKey(OWNER, id(41), NotificationType.RESERVATION_CREATED)).isNotEqualTo(original.key());
    }
}
