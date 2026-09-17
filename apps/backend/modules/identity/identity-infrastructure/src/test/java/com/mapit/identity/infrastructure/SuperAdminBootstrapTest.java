package com.mapit.identity.infrastructure;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import org.junit.jupiter.api.Test;
import org.mockito.InOrder;
import org.springframework.boot.DefaultApplicationArguments;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;

/** El bootstrap no depende de BD: la lógica de decisión se prueba con dobles. */
class SuperAdminBootstrapTest {

  private final JdbcTemplate jdbc = mock(JdbcTemplate.class);
  private final PasswordEncoder encoder = new BCryptPasswordEncoder();

  @Test
  void no_crea_nada_sin_contrasena_configurada() {
    bootstrap("").run(new DefaultApplicationArguments());

    verify(jdbc, never()).update(anyString(), any(Object[].class));
  }

  @Test
  void es_idempotente_si_la_cuenta_ya_existe() {
    stubExists(1);

    bootstrap("secreto-seguro").run(new DefaultApplicationArguments());

    verify(jdbc, never()).update(anyString(), any(Object[].class));
  }

  @Test
  void un_cambio_de_email_no_duplica_el_super_admin() {
    stubExists(1);

    new SuperAdminBootstrap(jdbc, encoder, "otro@mapit.local", "Otro", "secreto-nuevo")
        .run(new DefaultApplicationArguments());

    // La regla del bootstrap es UN SUPER_ADMIN: ya hay uno, no se crea otro.
    verify(jdbc, never()).update(anyString(), any(Object[].class));
  }

  @Test
  void crea_la_cuenta_con_contexto_rls_y_hash_bcrypt() {
    stubExists(0);

    bootstrap("secreto-seguro").run(new DefaultApplicationArguments());

    InOrder order = inOrder(jdbc);
    // Primero se cuenta si ya existe un SUPER_ADMIN, luego SET LOCAL del tenant, y al final el insert.
    order.verify(jdbc).queryForObject(anyString(), eq(Integer.class), eq("platform"));
    order.verify(jdbc).queryForObject(contains("set_config"), eq(String.class), eq("platform"));
    order
        .verify(jdbc)
        .update(
            contains("insert into app_user"),
            eq("platform"),
            eq("superadmin@mapit.local"),
            org.mockito.ArgumentMatchers.argThat(
                (String hash) -> encoder.matches("secreto-seguro", hash)),
            eq("Super Administrador"),
            eq("SUPER_ADMIN"));
  }

  @Test
  void normaliza_el_email_configurado() {
    stubExists(0);

    new SuperAdminBootstrap(jdbc, encoder, "  Admin@Mapit.LOCAL ", "Admin", "secreto-seguro")
        .run(new DefaultApplicationArguments());

    verify(jdbc)
        .update(anyString(), eq("platform"), eq("admin@mapit.local"), anyString(), anyString(), anyString());
  }

  private void stubExists(int count) {
    when(jdbc.queryForObject(anyString(), eq(Integer.class), anyString())).thenReturn(count);
  }

  private SuperAdminBootstrap bootstrap(String password) {
    return new SuperAdminBootstrap(
        jdbc, encoder, "superadmin@mapit.local", "Super Administrador", password);
  }
}
