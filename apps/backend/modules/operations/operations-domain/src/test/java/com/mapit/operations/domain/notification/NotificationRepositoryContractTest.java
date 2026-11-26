package com.mapit.operations.domain.notification;

import static com.mapit.operations.domain.notification.NotificationFixtures.*;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatIllegalArgumentException;

import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;

/** Contrato ejercitado con un doble de test; no demuestra aislamiento SQL/RLS ni concurrencia DB. */
class NotificationRepositoryContractTest {
    private final NotificationRepository repository = new InMemoryRepository();

    @Test
    void listado_y_contador_solo_incluyen_usuario_tenant_tipo_y_establecimiento_autorizados() {
        Notification own = notice(30);
        repository.createIfAbsent(own);
        repository.createIfAbsent(notice(31, 30, OTHER_USER, NotificationType.RESERVATION_CREATED, ESTABLISHMENT, CREATED_AT));
        repository.createIfAbsent(notice(32, 30, OTHER_COMPANY, NotificationType.RESERVATION_CREATED, ESTABLISHMENT, CREATED_AT));
        repository.createIfAbsent(notice(33, 33, OWNER, NotificationType.RESERVATION_CREATED, OTHER_ESTABLISHMENT, CREATED_AT));

        assertThat(repository.list(new NotificationPageRequest(scope(OWNER), 10, null)).content()).containsExactly(own);
        assertThat(repository.countUnread(scope(OWNER))).isEqualTo(1);
        assertThat(repository.countUnread(scope(OTHER_USER))).isEqualTo(1);
        assertThat(repository.countUnread(scope(OTHER_COMPANY))).isEqualTo(1);
    }

    @ParameterizedTest
    @MethodSource("com.mapit.operations.domain.notification.NotificationTest#unauthorizedScopes")
    void no_revela_ni_marca_un_id_ajeno_y_no_cuenta_sin_concesion(NotificationScope scope) {
        repository.createIfAbsent(notice(30));

        assertThat(repository.list(new NotificationPageRequest(scope, 10, null)).content()).isEmpty();
        assertThat(repository.countUnread(scope)).isZero();
        assertThat(repository.markRead(scope, id(30), CREATED_AT)).isEmpty();
        assertThat(repository.markRead(scope, id(999), CREATED_AT)).isEmpty();
        assertThat(repository.countUnread(scope(OWNER))).isEqualTo(1);
    }

    @Test
    void reentrega_estable_conserva_fila_fecha_y_lectura_incluso_con_un_nuevo_id_de_intento() {
        Notification original = notice(30);
        repository.createIfAbsent(original);
        Notification read = repository.markRead(scope(OWNER), original.id(), CREATED_AT.plusSeconds(1)).orElseThrow();
        Notification retry = notice(31, 30, OWNER, NotificationType.RESERVATION_CREATED, ESTABLISHMENT, CREATED_AT.plusSeconds(2));

        assertThat(repository.createIfAbsent(retry)).isEqualTo(read);
        assertThat(repository.list(new NotificationPageRequest(scope(OWNER), 10, null)).content()).containsExactly(read);
        assertThat(repository.countUnread(scope(OWNER))).isZero();
        assertThat(repository.markRead(scope(OWNER), original.id(), CREATED_AT.plusSeconds(3))).contains(read);
    }

    @Test
    void una_concesion_a_reservas_no_autoriza_llegadas_del_mismo_usuario_y_establecimiento() {
        NotificationScope reservationsOnly = new NotificationScope(OWNER,
                Map.of(NotificationType.RESERVATION_CREATED, java.util.Set.of(ESTABLISHMENT)));
        repository.createIfAbsent(notice(30));
        repository.createIfAbsent(notice(31, 30, OWNER, NotificationType.RESERVATION_CHECKED_IN, ESTABLISHMENT, CREATED_AT));

        assertThat(repository.countUnread(scope(OWNER))).isEqualTo(2);
        assertThat(repository.countUnread(reservationsOnly)).isEqualTo(1);
        assertThat(repository.list(new NotificationPageRequest(reservationsOnly, 10, null)).content()).containsExactly(notice(30));
        assertThat(repository.markRead(reservationsOnly, id(31), CREATED_AT)).isEmpty();
    }

    @Test
    void reentrega_con_datos_incompatibles_o_id_colisionado_no_sobrescribe_la_fila() {
        Notification original = notice(30);
        repository.createIfAbsent(original);
        Notification changedResource = notice(31, 30, OWNER, NotificationType.RESERVATION_CREATED, OTHER_ESTABLISHMENT, CREATED_AT);
        NotificationEvent changedReservation = new NotificationEvent(id(30), TENANT,
                NotificationType.RESERVATION_CREATED, OCCURRED_AT, ESTABLISHMENT, id(999));

        assertThatIllegalArgumentException().isThrownBy(() -> repository.createIfAbsent(changedResource));
        assertThatIllegalArgumentException().isThrownBy(() -> repository.createIfAbsent(
                Notification.unread(id(32), OWNER, changedReservation, CREATED_AT)));
        assertThatIllegalArgumentException().isThrownBy(() -> repository.createIfAbsent(
                notice(30, 99, OWNER, NotificationType.RESERVATION_CREATED, ESTABLISHMENT, CREATED_AT)));
        assertThat(repository.list(new NotificationPageRequest(scope(OWNER), 10, null)).content()).containsExactly(original);
        assertThat(repository.countUnread(scope(OWNER))).isEqualTo(1);
    }

    @Test
    void las_paginas_son_descendentes_y_el_marcado_no_cambia_la_posicion() {
        Notification older = notice(30);
        Notification sameDateHigherId = notice(31);
        Notification newest = notice(32, 32, OWNER, NotificationType.RESERVATION_CREATED, ESTABLISHMENT, CREATED_AT.plusSeconds(1));
        repository.createIfAbsent(older);
        repository.createIfAbsent(newest);
        repository.createIfAbsent(sameDateHigherId);
        NotificationPage first = repository.list(new NotificationPageRequest(scope(OWNER), 2, null));

        assertThat(first.content()).containsExactly(newest, sameDateHigherId);
        repository.markRead(scope(OWNER), sameDateHigherId.id(), CREATED_AT.plusSeconds(2));
        NotificationPage second = repository.list(new NotificationPageRequest(scope(OWNER), 2, first.nextCursor().orElseThrow()));

        assertThat(second.content()).containsExactly(older);
        assertThat(second.nextCursor()).isEmpty();
        assertThat(repository.countUnread(scope(OWNER))).isEqualTo(2);
    }

    @Test
    void marcado_total_es_propio_idempotente_y_respeta_el_corte_y_lecturas_previas() {
        Notification own = notice(30);
        Notification alreadyRead = notice(31).markRead(scope(OWNER), CREATED_AT).orElseThrow();
        Notification later = notice(32, 32, OWNER, NotificationType.RESERVATION_CREATED,
                ESTABLISHMENT, CREATED_AT.plusSeconds(2));
        Notification foreign = notice(33, 33, OTHER_USER, NotificationType.RESERVATION_CREATED,
                ESTABLISHMENT, CREATED_AT);
        repository.createIfAbsent(own);
        repository.createIfAbsent(alreadyRead);
        repository.createIfAbsent(later);
        repository.createIfAbsent(foreign);

        assertThat(repository.markAllRead(scope(OWNER), CREATED_AT.plusSeconds(1))).isEqualTo(1);
        assertThat(repository.markAllRead(scope(OWNER), CREATED_AT.plusSeconds(1))).isZero();
        assertThat(repository.countUnread(scope(OWNER))).isEqualTo(1);
        assertThat(repository.countUnread(scope(OTHER_USER))).isEqualTo(1);
        assertThat(repository.list(new NotificationPageRequest(scope(OWNER), 10, null)).content())
                .contains(alreadyRead, later);
    }

    /** Solo fixture: ningún bean, fallback ni adaptador de producción usa esta implementación. */
    private static final class InMemoryRepository implements NotificationRepository {
        private final Map<NotificationKey, Notification> rows = new HashMap<>();

        @Override
        public Notification createIfAbsent(Notification notification) {
            Objects.requireNonNull(notification);
            Notification existing = rows.get(notification.key());
            if (existing != null) {
                if (!existing.event().equals(notification.event())) {
                    throw new IllegalArgumentException("Reentrega incompatible");
                }
                return existing;
            }
            if (rows.values().stream().anyMatch(row -> row.id().equals(notification.id()))) {
                throw new IllegalArgumentException("Identificador de fila ya utilizado");
            }
            rows.put(notification.key(), notification);
            return notification;
        }

        @Override
        public NotificationPage list(NotificationPageRequest request) {
            Objects.requireNonNull(request);
            List<Notification> visible = rows.values().stream().filter(request::includes)
                    .sorted(Notification.NEWEST_FIRST).limit(request.limit() + 1L).toList();
            boolean hasMore = visible.size() > request.limit();
            return new NotificationPage(request, visible.subList(0, Math.min(request.limit(), visible.size())), hasMore);
        }

        @Override
        public long countUnread(NotificationScope scope) {
            Objects.requireNonNull(scope);
            return rows.values().stream().filter(scope::permits).filter(Notification::isUnread).count();
        }

        @Override
        public Optional<Notification> markRead(NotificationScope scope, UUID notificationId, Instant readAt) {
            Objects.requireNonNull(scope);
            Objects.requireNonNull(notificationId);
            Objects.requireNonNull(readAt);
            Optional<Notification> updated = rows.values().stream()
                    .filter(row -> row.id().equals(notificationId)).filter(scope::permits).findFirst()
                    .flatMap(row -> row.markRead(scope, readAt));
            updated.ifPresent(notification -> rows.put(notification.key(), notification));
            return updated;
        }

        @Override
        public long markAllRead(NotificationScope scope, Instant readAt) {
            Objects.requireNonNull(scope);
            Objects.requireNonNull(readAt);
            List<Notification> snapshot = rows.values().stream().filter(scope::permits)
                    .filter(Notification::isUnread).filter(row -> !row.createdAt().isAfter(readAt)).toList();
            for (Notification notification : snapshot) {
                Notification read = notification.markRead(scope, readAt).orElseThrow();
                rows.put(read.key(), read);
            }
            return snapshot.size();
        }
    }
}
