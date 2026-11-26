package com.mapit.operations.domain.notification;

import static com.mapit.operations.domain.notification.NotificationFixtures.notice;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatNullPointerException;

import org.junit.jupiter.api.Test;

class NotificationInvalidationTest {
    @Test
    void creationRetriesUseTheCanonicalRowAndRecipient() {
        Notification row = notice(10);
        var first = NotificationInvalidation.created(row);
        assertThat(NotificationInvalidation.created(row)).isEqualTo(first);
        assertThat(first.eventId()).isEqualTo(row.id());
        assertThat(first.recipient()).isEqualTo(row.recipient());
        assertThat(first.occurredAt()).isEqualTo(row.createdAt());
        assertThat(NotificationInvalidation.created(notice(11)).eventId()).isNotEqualTo(first.eventId());
    }

    @Test
    void requiresCompleteInternalIdentityAndTime() {
        var row = notice(10);
        assertThatNullPointerException().isThrownBy(() -> NotificationInvalidation.created(null));
        assertThatNullPointerException().isThrownBy(() -> new NotificationInvalidation(null, row.recipient(), row.createdAt()));
        assertThatNullPointerException().isThrownBy(() -> new NotificationInvalidation(row.id(), null, row.createdAt()));
        assertThatNullPointerException().isThrownBy(() -> new NotificationInvalidation(row.id(), row.recipient(), null));
    }
}
