package com.mapit.operations.application.notification;

import static com.mapit.operations.application.notification.NotificationEventFixtures.*;
import static com.mapit.operations.application.notification.NotificationUseCaseFixtures.*;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Clock;
import java.time.Duration;
import java.util.List;
import java.util.stream.Stream;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.junit.jupiter.params.provider.MethodSource;

import com.mapit.operations.domain.notification.Notification;
import com.mapit.operations.domain.notification.NotificationEvent;
import com.mapit.operations.domain.notification.NotificationType;

class ProcessNotificationEventTest {
    @Test void omite_preferencias_optativas_sin_cambiar_el_hecho_ni_persistir_avisos() {
        var ports=new RecipientPorts(); var repository=new CreationRepository();
        var processor=new ProcessNotificationEvent(ports.resolver(),repository,CLOCK,(recipient,category)->false);
        assertThat(processor.execute(event(NotificationType.RESERVATION_CREATED))).isEmpty();
        assertThat(repository.createCalls).isZero();
    }

    private final RecipientPorts ports = new RecipientPorts();
    private final CreationRepository repository = new CreationRepository();
    private final ProcessNotificationEvent processor = new ProcessNotificationEvent(ports.resolver(), repository, CLOCK);

    @ParameterizedTest
    @EnumSource(NotificationType.class)
    void crea_avisos_minimos_por_destinatario_con_el_evento_estable_y_un_solo_instante(NotificationType type) {
        ports.candidates = List.of(OWNER, OTHER_USER, OTHER_COMPANY);
        NotificationEvent event = event(type);

        List<Notification> result = processor.execute(event);

        assertThat(result).hasSize(2);
        assertThat(result).extracting(Notification::recipient).containsExactlyInAnyOrder(OWNER, OTHER_USER);
        assertThat(repository.createCalls).isEqualTo(2);
        assertThat(repository.rows).hasSize(2);
        assertThat(ports.authorizationCalls).containsExactly(OWNER, OTHER_USER);
        assertThat(result).allSatisfy(notification -> {
            assertThat(notification.event()).isSameAs(event);
            assertThat(notification.event().id()).isEqualTo(id(30));
            assertThat(notification.event().reservationId()).isEqualTo(id(20));
            assertThat(notification.event().establishmentId()).isEqualTo(ESTABLISHMENT);
            assertThat(notification.category()).isEqualTo(type.category());
            assertThat(notification.createdAt()).isEqualTo(NOW);
            assertThat(notification.isUnread()).isTrue();
        });
        assertThatThrownBy(result::clear).isInstanceOf(UnsupportedOperationException.class);
    }

    @Test
    void reentregar_conserva_el_id_fecha_y_lectura_de_la_fila_canonica() {
        NotificationEvent event = event(NotificationType.RESERVATION_CREATED);
        Notification first = processor.execute(event).getFirst();
        Notification read = first.markRead(scope(OWNER), NOW).orElseThrow();
        repository.rows.put(read.key(), read);
        ProcessNotificationEvent later = new ProcessNotificationEvent(
                ports.resolver(), repository, Clock.offset(CLOCK, Duration.ofSeconds(5)));

        List<Notification> replay = later.execute(event);

        assertThat(replay).containsExactly(read);
        assertThat(replay.getFirst().id()).isEqualTo(first.id());
        assertThat(replay.getFirst().createdAt()).isEqualTo(first.createdAt());
        assertThat(replay.getFirst().readAt()).isEqualTo(NOW);
        assertThat(repository.rows).hasSize(1);
        assertThat(repository.createCalls).isEqualTo(2);
    }

    @Test
    void candidatos_repetidos_no_producen_dos_intentos_para_el_mismo_usuario() {
        ports.candidates = List.of(OWNER, OWNER);

        assertThat(processor.execute(event(NotificationType.RESERVATION_CREATED))).hasSize(1);
        assertThat(repository.createCalls).isEqualTo(1);
        assertThat(ports.authorizationCalls).containsExactly(OWNER);
    }

    @Test
    void ausencia_de_candidatos_no_escribe_ni_exige_configuracion_de_flags() {
        ports.candidates = List.of();

        assertThat(processor.execute(event(NotificationType.RESERVATION_CREATED))).isEmpty();
        assertThat(repository.createCalls).isZero();
        assertThat(repository.rows).isEmpty();
    }

    @Test
    void candidatos_sin_permiso_o_de_otro_tenant_no_generan_notificaciones() {
        ports.candidates = List.of(OWNER, OTHER_COMPANY);
        ports.canRead = false;

        assertThat(processor.execute(event(NotificationType.RESERVATION_CREATED))).isEmpty();
        assertThat(repository.createCalls).isZero();
        assertThat(repository.rows).isEmpty();
        assertThat(ports.authorizationCalls).containsExactly(OWNER);
    }

    @Test
    void valida_todos_los_destinatarios_antes_de_la_primera_escritura() {
        ports.candidates = List.of(OWNER, OTHER_USER);
        ports.failAuthorizationFor = OTHER_USER;

        assertThatThrownBy(() -> processor.execute(event(NotificationType.RESERVATION_CREATED)))
                .isInstanceOf(IllegalStateException.class).hasMessage("Autorización no disponible");
        assertThat(ports.authorizationCalls).containsExactly(OWNER, OTHER_USER);
        assertThat(repository.createCalls).isZero();
        assertThat(repository.rows).isEmpty();
    }

    @Test
    void un_ambito_ajeno_impide_crear_avisos_aunque_existan_candidatos_validos() {
        ports.candidates = List.of(OWNER, OTHER_USER);
        ports.scopes.put(OTHER_USER, scope(OTHER_COMPANY));

        assertThatThrownBy(() -> processor.execute(event(NotificationType.RESERVATION_CREATED)))
                .isInstanceOf(NotificationAccessDeniedException.class);
        assertThat(repository.createCalls).isZero();
    }

    @Test
    void un_evento_futuro_o_ausente_se_rechaza_antes_de_resolver_y_persistir() {
        NotificationEvent future = new NotificationEvent(id(30), TENANT, NotificationType.RESERVATION_CREATED,
                NOW.plusSeconds(1), ESTABLISHMENT, id(20));

        assertThatThrownBy(() -> processor.execute(future)).isInstanceOf(IllegalArgumentException.class)
                .hasMessage("El evento no puede ser posterior al procesamiento");
        assertThatThrownBy(() -> processor.execute(null)).isInstanceOf(NullPointerException.class);
        assertThat(ports.candidateCalls).isZero();
        assertThat(repository.createCalls).isZero();
    }

    @ParameterizedTest
    @MethodSource("incompatibleResponses")
    void una_respuesta_con_otra_clave_o_evento_no_se_devuelve(Notification incompatible) {
        repository.overrideResult = incompatible;

        assertThatThrownBy(() -> processor.execute(event(NotificationType.RESERVATION_CREATED)))
                .isInstanceOf(IllegalStateException.class)
                .hasMessage("Respuesta inválida del repositorio de notificaciones");
    }

    static Stream<Notification> incompatibleResponses() {
        NotificationEvent otherResource = new NotificationEvent(id(30), TENANT,
                NotificationType.RESERVATION_CREATED, CREATED_AT, ESTABLISHMENT, id(99));
        return Stream.of(
                Notification.unread(id(40), OTHER_USER, event(NotificationType.RESERVATION_CREATED), NOW),
                Notification.unread(id(41), OWNER, otherResource, NOW));
    }

    @Test
    void una_colision_del_evento_estable_no_sobrescribe_el_aviso_previo() {
        NotificationEvent priorEvent = new NotificationEvent(id(30), TENANT,
                NotificationType.RESERVATION_CREATED, CREATED_AT, ESTABLISHMENT, id(99));
        Notification prior = Notification.unread(id(40), OWNER, priorEvent, NOW);
        repository.rows.put(prior.key(), prior);

        assertThatThrownBy(() -> processor.execute(event(NotificationType.RESERVATION_CREATED)))
                .isInstanceOf(IllegalArgumentException.class).hasMessage("Reentrega incompatible");
        assertThat(repository.rows.values()).containsExactly(prior);
    }
}
