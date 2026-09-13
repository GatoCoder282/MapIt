package com.mapit.identity.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.stream.Stream;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;

import com.mapit.identity.domain.AuthenticatedUser;
import com.mapit.identity.domain.InvalidCredentialsException;
import com.mapit.identity.domain.UserCredentials;
import com.mapit.identity.domain.UserRole;
import com.mapit.shared.tenant.TenantId;

class AuthenticateUserTest {
    private static final AuthenticatedUser IDENTITY = new AuthenticatedUser(
            UUID.randomUUID(), TenantId.of("company-id"), "staff@example.test", "Operador", UserRole.STAFF);
    private static final UserCredentials USER = new UserCredentials(IDENTITY, "private-hash", true, true);

    @Test
    void normaliza_empresa_y_correo_sin_modificar_la_contrasena() {
        var service = new AuthenticateUser((slug, email) -> {
            assertThat(slug).isEqualTo("company-slug");
            assertThat(email).isEqualTo("staff@example.test");
            return Optional.of(USER);
        }, (raw, hash) -> {
            assertThat(raw).isEqualTo(" secret ");
            assertThat(hash).contains("private-hash");
            return true;
        });
        assertThat(service.execute(new AuthenticateUserCommand(
                " COMPANY-SLUG ", " Staff@Example.Test ", " secret "))).isEqualTo(IDENTITY);
    }

    @Test
    void usuario_inexistente_tambien_compara_y_falla_aunque_el_verificador_devuelva_true() {
        var compared = new AtomicBoolean();
        var service = new AuthenticateUser((slug, email) -> Optional.empty(), (raw, hash) -> {
            compared.set(true);
            assertThat(hash).isEmpty();
            return true;
        });
        assertRejected(service, validCommand());
        assertThat(compared).isTrue();
    }

    @Test
    void contrasena_incorrecta_se_rechaza() {
        assertRejected(new AuthenticateUser((s, e) -> Optional.of(USER), (r, h) -> false), validCommand());
    }

    @ParameterizedTest
    @MethodSource("disabledUsers")
    void cuenta_o_empresa_deshabilitada_se_rechaza_despues_de_comparar(UserCredentials user) {
        var compared = new AtomicBoolean();
        var service = new AuthenticateUser((s, e) -> Optional.of(user), (r, h) -> {
            compared.set(true);
            return true;
        });
        assertRejected(service, validCommand());
        assertThat(compared).isTrue();
    }

    static Stream<UserCredentials> disabledUsers() {
        return Stream.of(new UserCredentials(IDENTITY, "hash", false, true),
                new UserCredentials(IDENTITY, "hash", true, false),
                new UserCredentials(IDENTITY, "hash", false, false));
    }

    @ParameterizedTest
    @MethodSource("invalidCommands")
    void entrada_invalida_falla_sin_consultar(AuthenticateUserCommand command) {
        var service = new AuthenticateUser((s, e) -> {
            throw new AssertionError("No debe consultar credenciales inválidas");
        }, (r, h) -> { throw new AssertionError("No debe comparar entradas inválidas"); });
        assertRejected(service, command);
    }

    static Stream<AuthenticateUserCommand> invalidCommands() {
        return Stream.of(
                new AuthenticateUserCommand(null, "staff@example.test", "secret"),
                new AuthenticateUserCommand("demo", null, "secret"),
                new AuthenticateUserCommand("demo", "staff@example.test", null),
                new AuthenticateUserCommand(" ", "staff@example.test", "secret"),
                new AuthenticateUserCommand("demo", " ", "secret"),
                new AuthenticateUserCommand("demo", "staff@example.test", " "),
                new AuthenticateUserCommand("../demo", "staff@example.test", "secret"),
                new AuthenticateUserCommand("demo", "staff@example.test", "x".repeat(73)),
                new AuthenticateUserCommand("demo", "staff@example.test", "é".repeat(37)));
    }

    @Test
    void secretos_no_aparecen_en_texto_ni_en_el_resultado() {
        assertThat(USER.toString()).doesNotContain("private-hash");
        assertThat(validCommand().toString()).doesNotContain("secret");
        assertThat(IDENTITY.toString()).doesNotContain("private-hash", "secret");
    }

    @Test
    void error_de_infraestructura_no_se_oculta_como_credenciales_invalidas() {
        var service = new AuthenticateUser((s, e) -> { throw new IllegalStateException("BD no disponible"); },
                (r, h) -> true);
        assertThatThrownBy(() -> service.execute(validCommand()))
                .isInstanceOf(IllegalStateException.class).hasMessage("BD no disponible");
    }

    private static AuthenticateUserCommand validCommand() {
        return new AuthenticateUserCommand("company-slug", "staff@example.test", "secret");
    }

    private static void assertRejected(AuthenticateUser service, AuthenticateUserCommand command) {
        assertThatThrownBy(() -> service.execute(command))
                .isInstanceOf(InvalidCredentialsException.class).hasMessage("Credenciales inválidas.");
    }
}
