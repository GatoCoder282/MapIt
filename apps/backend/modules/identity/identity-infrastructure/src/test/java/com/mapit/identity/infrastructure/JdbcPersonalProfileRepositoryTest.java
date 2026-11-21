package com.mapit.identity.infrastructure;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.clearInvocations;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.UUID;

import javax.sql.DataSource;

import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.ArgumentMatchers;
import org.springframework.context.annotation.AnnotationConfigApplicationContext;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import org.springframework.transaction.IllegalTransactionStateException;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.EnableTransactionManagement;

import com.mapit.identity.domain.AuthenticatedPrincipal;
import com.mapit.identity.domain.PersonalProfile;
import com.mapit.identity.domain.PersonalProfileRepository;
import com.mapit.identity.domain.UserRole;
import com.mapit.shared.tenant.TenantId;
import com.mapit.shared.tenant.TenantScope;

class JdbcPersonalProfileRepositoryTest {
    private static final AuthenticatedPrincipal A = new AuthenticatedPrincipal(UUID.randomUUID(), TenantId.of("tenant-a"), "a@example.test", UserRole.STAFF);
    private final JdbcTemplate jdbc = mock(JdbcTemplate.class);
    private final JdbcPersonalProfileRepository repository = new JdbcPersonalProfileRepository(jdbc);

    @Test
    void readBindsTenantUserAndRoleAndChecksActiveStates() {
        when(jdbc.query(anyString(), ArgumentMatchers.<RowMapper<PersonalProfile>>any(), eq("tenant-a"), eq(A.id()), eq("STAFF")))
                .thenReturn(List.of(new PersonalProfile("A", A.email())));
        assertThat(repository.findOwn(A)).contains(new PersonalProfile("A", A.email()));
        verify(jdbc).queryForObject(TenantScope.SET_LOCAL_SQL, String.class, "tenant-a");
        var sql = ArgumentCaptor.forClass(String.class);
        verify(jdbc).query(sql.capture(), ArgumentMatchers.<RowMapper<PersonalProfile>>any(), eq("tenant-a"), eq(A.id()), eq("STAFF"));
        assertThat(sql.getValue()).contains("u.tenant_id = ? and u.id = ? and u.role = ?", "u.active = true", "t.status = 'ACTIVE'")
                .doesNotContain("password_hash", "login_email");
    }

    @Test
    void updateOnlyWritesNameWithTheSameEligibilityAndBoundValues() {
        String name = "Nombre ' seguro";
        when(jdbc.query(anyString(), ArgumentMatchers.<RowMapper<PersonalProfile>>any(), eq(name), eq("tenant-a"), eq(A.id()), eq("STAFF")))
                .thenReturn(List.of(new PersonalProfile(name, A.email())));
        assertThat(repository.updateOwnFullName(A, name)).contains(new PersonalProfile(name, A.email()));
        verify(jdbc).queryForObject(TenantScope.SET_LOCAL_SQL, String.class, "tenant-a");
        var sql = ArgumentCaptor.forClass(String.class);
        verify(jdbc).query(sql.capture(), ArgumentMatchers.<RowMapper<PersonalProfile>>any(), eq(name), eq("tenant-a"), eq(A.id()), eq("STAFF"));
        assertThat(sql.getValue().substring(0, sql.getValue().indexOf("where")).strip()).isEqualTo("update app_user set full_name = ?");
        assertThat(sql.getValue()).contains("tenant_id = ? and id = ? and role = ?", "active = true", "t.status = 'ACTIVE'", "returning full_name, email")
                .doesNotContain(name, "password_hash", "login_email");
    }

    @Test
    void transactionIsRequiredBeforeAnySqlRuns() {
        try (var context = new AnnotationConfigApplicationContext(TransactionConfiguration.class)) {
            var proxied = context.getBean(PersonalProfileRepository.class);
            clearInvocations(context.getBean(JdbcTemplate.class)); // Excluir inicialización del bean.
            assertThatThrownBy(() -> proxied.findOwn(A)).isInstanceOf(IllegalTransactionStateException.class);
            assertThatThrownBy(() -> proxied.updateOwnFullName(A, "Nombre")).isInstanceOf(IllegalTransactionStateException.class);
            verifyNoInteractions(context.getBean(JdbcTemplate.class));
        }
    }

    @Configuration
    @EnableTransactionManagement
    static class TransactionConfiguration {
        @Bean JdbcTemplate jdbc() { return mock(JdbcTemplate.class); }
        @Bean PlatformTransactionManager transactions() { return new DataSourceTransactionManager(mock(DataSource.class)); }
        @Bean PersonalProfileRepository profiles(JdbcTemplate jdbc) { return new JdbcPersonalProfileRepository(jdbc); }
    }
}
