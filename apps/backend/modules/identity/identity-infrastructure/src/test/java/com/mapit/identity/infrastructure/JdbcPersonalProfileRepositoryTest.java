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
        when(jdbc.query(anyString(), ArgumentMatchers.<RowMapper<PersonalProfile>>any(), eq(true), eq(name), eq(false), ArgumentMatchers.isNull(), eq(false), ArgumentMatchers.isNull(), eq("tenant-a"), eq(A.id()), eq("STAFF")))
                .thenReturn(List.of(new PersonalProfile(name, A.email())));
        assertThat(repository.updateOwn(A, com.mapit.identity.domain.PersonalProfileChanges.name(name))).contains(new PersonalProfile(name, A.email()));
        verify(jdbc).queryForObject(TenantScope.SET_LOCAL_SQL, String.class, "tenant-a");
        var sql = ArgumentCaptor.forClass(String.class);
        verify(jdbc).query(sql.capture(), ArgumentMatchers.<RowMapper<PersonalProfile>>any(), eq(true), eq(name), eq(false), ArgumentMatchers.isNull(), eq(false), ArgumentMatchers.isNull(), eq("tenant-a"), eq(A.id()), eq("STAFF"));
        String assignments = sql.getValue().substring(0, sql.getValue().indexOf("where")).strip();
        assertThat(assignments).startsWith("update app_user set full_name = case").contains("contact_phone = case", "preferred_language = case")
                .doesNotContain("email =", "role =", "tenant_id =", "active =", "password_hash", "staff_tokens_valid_after");
        assertThat(sql.getValue()).contains("tenant_id = ? and id = ? and role = ?", "active = true", "t.status = 'ACTIVE'", "returning full_name, email")
                .doesNotContain(name, "password_hash", "login_email");
    }

    @Test
    void transactionIsRequiredBeforeAnySqlRuns() {
        try (var context = new AnnotationConfigApplicationContext(TransactionConfiguration.class)) {
            var proxied = context.getBean(PersonalProfileRepository.class);
            clearInvocations(context.getBean(JdbcTemplate.class)); // Excluir inicialización del bean.
            assertThatThrownBy(() -> proxied.findOwn(A)).isInstanceOf(IllegalTransactionStateException.class);
            assertThatThrownBy(() -> proxied.updateOwn(A, com.mapit.identity.domain.PersonalProfileChanges.name("Nombre"))).isInstanceOf(IllegalTransactionStateException.class);
            verifyNoInteractions(context.getBean(JdbcTemplate.class));
        }
    }

    @Test
    void optionalFieldsUsePresenceAndTypedNullInsteadOfOverwritingFromAnOldRead() {
        var changes = new com.mapit.identity.domain.PersonalProfileChanges(
                com.mapit.identity.domain.PersonalProfileChanges.Field.absent(),
                com.mapit.identity.domain.PersonalProfileChanges.Field.provided(null),
                com.mapit.identity.domain.PersonalProfileChanges.Field.provided("ja-JP"));
        repository.updateOwn(A, changes);
        var sql = ArgumentCaptor.forClass(String.class);
        verify(jdbc).query(sql.capture(), ArgumentMatchers.<RowMapper<PersonalProfile>>any(), eq(false), ArgumentMatchers.isNull(), eq(true), ArgumentMatchers.isNull(), eq(true), eq("ja-JP"), eq("tenant-a"), eq(A.id()), eq("STAFF"));
        assertThat(sql.getValue()).contains("else full_name end", "else contact_phone end", "else preferred_language end");
        assertThat(sql.getValue()).doesNotContain("coalesce", "varchar(32)", "varchar(5)");
    }

    @Test
    void readMapsPersistedContactAndLanguageIncludingNull() throws java.sql.SQLException {
        var resultSet = mock(java.sql.ResultSet.class);
        when(resultSet.getString("full_name")).thenReturn("Cuenta"); when(resultSet.getString("email")).thenReturn(A.email());
        when(resultSet.getString("contact_phone")).thenReturn("+591 123"); when(resultSet.getString("preferred_language")).thenReturn("en");
        when(jdbc.query(anyString(), ArgumentMatchers.<RowMapper<PersonalProfile>>any(), eq("tenant-a"), eq(A.id()), eq("STAFF")))
                .thenAnswer(call -> List.of(call.<RowMapper<PersonalProfile>>getArgument(1).mapRow(resultSet, 0)));
        assertThat(repository.findOwn(A)).contains(new PersonalProfile("Cuenta", A.email(), "+591 123", "en"));
    }

    @Configuration
    @EnableTransactionManagement
    static class TransactionConfiguration {
        @Bean JdbcTemplate jdbc() { return mock(JdbcTemplate.class); }
        @Bean PlatformTransactionManager transactions() { return new DataSourceTransactionManager(mock(DataSource.class)); }
        @Bean PersonalProfileRepository profiles(JdbcTemplate jdbc) { return new JdbcPersonalProfileRepository(jdbc); }
    }
}
