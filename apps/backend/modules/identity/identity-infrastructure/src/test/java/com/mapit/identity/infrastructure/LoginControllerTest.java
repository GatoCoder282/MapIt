package com.mapit.identity.infrastructure;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicInteger;

import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import com.mapit.identity.application.AuthenticateUser;
import com.mapit.identity.application.IssueAccessToken;
import com.mapit.identity.domain.AuthenticatedUser;
import com.mapit.identity.domain.IssuedAccessToken;
import com.mapit.identity.domain.UserCredentials;
import com.mapit.identity.domain.UserCredentialsRepository;
import com.mapit.identity.domain.UserRole;
import com.mapit.shared.tenant.TenantId;

class LoginControllerTest {
  private static final UUID USER_ID =
      UUID.fromString("00000000-0000-0000-0000-000000000048");
  private static final Instant EXPIRES_AT = Instant.parse("2026-09-10T12:15:00Z");
  private static final AuthenticatedUser USER =
      new AuthenticatedUser(
          USER_ID, TenantId.of("tenant-a"), "staff@example.test", "Operador", UserRole.MANAGER);

  @Test
  void credenciales_validas_devuelven_token_e_identidad_sin_secretos() throws Exception {
    MockMvc mvc = mvc(credentials(true), new AtomicInteger());

    String body =
        mvc.perform(
                post("/api/v1/auth/login")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(
                        """
                        {
                          "tenantSlug": "TENANT-A",
                          "email": "Staff@Example.Test",
                          "password": "correcta"
                        }
                        """))
            .andExpect(status().isOk())
            .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
            .andExpect(jsonPath("$.accessToken").value("jwt.firmado.valor"))
            .andExpect(jsonPath("$.tokenType").value("Bearer"))
            .andExpect(jsonPath("$.expiresAt").value("2026-09-10T12:15:00Z"))
            .andExpect(jsonPath("$.user.id").value(USER_ID.toString()))
            .andExpect(jsonPath("$.user.tenantId").value("tenant-a"))
            .andExpect(jsonPath("$.user.email").value("staff@example.test"))
            .andExpect(jsonPath("$.user.fullName").value("Operador"))
            .andExpect(jsonPath("$.user.role").value("MANAGER"))
            .andReturn()
            .getResponse()
            .getContentAsString();

    assertThat(body).doesNotContain("correcta", "hash-privado", "password");
  }

  @Test
  void credenciales_incorrectas_devuelven_problem_details_uniforme() throws Exception {
    MockMvc mvc = mvc(credentials(true), new AtomicInteger());

    mvc.perform(
            post("/api/v1/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {
                      "tenantSlug": "tenant-a",
                      "email": "staff@example.test",
                      "password": "incorrecta"
                    }
                    """))
        .andExpect(status().isUnauthorized())
        .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
        .andExpect(jsonPath("$.type").value("https://mapit.local/problems/invalid-credentials"))
        .andExpect(jsonPath("$.title").value("Credenciales inválidas"))
        .andExpect(jsonPath("$.status").value(401))
        .andExpect(jsonPath("$.detail").value("Credenciales inválidas."));
  }

  @Test
  void cuerpo_invalido_responde_400_sin_consultar_credenciales() throws Exception {
    AtomicInteger repositoryCalls = new AtomicInteger();
    MockMvc mvc = mvc(credentials(true), repositoryCalls);

    mvc.perform(
            post("/api/v1/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {
                      "tenantSlug": "!",
                      "email": "correo-invalido",
                      "password": ""
                    }
                    """))
        .andExpect(status().isBadRequest());

    assertThat(repositoryCalls).hasValue(0);
  }

  @Test
  void cuerpo_ausente_devuelve_problem_details_sin_exponer_datos() throws Exception {
    MockMvc mvc = mvc(credentials(true), new AtomicInteger());

    mvc.perform(post("/api/v1/auth/login").contentType(MediaType.APPLICATION_JSON))
        .andExpect(status().isBadRequest())
        .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
        .andExpect(jsonPath("$.type").value("https://mapit.local/problems/invalid-request"))
        .andExpect(jsonPath("$.title").value("Solicitud inválida"))
        .andExpect(jsonPath("$.status").value(400))
        .andExpect(jsonPath("$.detail").value("El cuerpo de la solicitud no es válido."));
  }

  private static MockMvc mvc(
      Optional<UserCredentials> credentials, AtomicInteger repositoryCalls) {
    UserCredentialsRepository repository =
        (tenantSlug, email) -> {
          repositoryCalls.incrementAndGet();
          return credentials;
        };
    var authenticate =
        new AuthenticateUser(
            repository,
            (rawPassword, passwordHash) ->
                passwordHash.isPresent() && "correcta".equals(rawPassword));
    var issue =
        new IssueAccessToken(user -> new IssuedAccessToken("jwt.firmado.valor", EXPIRES_AT));
    return MockMvcBuilders.standaloneSetup(new LoginController(authenticate, issue)).build();
  }

  private static Optional<UserCredentials> credentials(boolean active) {
    return Optional.of(new UserCredentials(USER, "hash-privado", active, true));
  }
}
