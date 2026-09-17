package com.mapit.identity.infrastructure;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import com.mapit.identity.domain.UserRole;
import com.mapit.shared.tenant.TenantScope;

/**
 * Crea el SUPER_ADMIN de plataforma al arrancar, si no existe.
 *
 * <p>¿Por qué aquí y no en Flyway? Las credenciales no se versionan: una
 * migración quedaría en el historial del repo para siempre. El usuario vive en
 * {@code app_user} dentro del tenant técnico {@code platform} (V6), con las
 * mismas garantías RLS que cualquier otro staff de tenant.
 *
 * <p>Idempotente: si la cuenta ya existe no toca nada (nunca sobreescribe una
 * contraseña que el operador ya haya cambiado). Sin {@code MAPIT_SUPER_ADMIN_PASSWORD}
 * configurada, no hace nada y lo deja explícito en el log.
 */
@Component
@Order(1)
public class SuperAdminBootstrap implements ApplicationRunner {

  private static final Logger log = LoggerFactory.getLogger(SuperAdminBootstrap.class);
  private static final String PLATFORM_TENANT = "platform";

  private final JdbcTemplate jdbc;
  private final PasswordEncoder passwordEncoder;
  private final String email;
  private final String fullName;
  private final String password;

  public SuperAdminBootstrap(
      JdbcTemplate jdbc,
      PasswordEncoder passwordEncoder,
      @Value("${mapit.super-admin.email:superadmin@mapit.local}") String email,
      @Value("${mapit.super-admin.full-name:Super Administrador}") String fullName,
      @Value("${mapit.super-admin.password:}") String password) {
    this.jdbc = jdbc;
    this.passwordEncoder = passwordEncoder;
    this.email = email == null ? "" : email.trim().toLowerCase();
    this.fullName = fullName;
    this.password = password == null ? "" : password;
  }

  @Override
  @Transactional(propagation = Propagation.REQUIRES_NEW)
  public void run(ApplicationArguments args) {
    if (password.isBlank()) {
      log.warn(
          "mapit.super-admin.password sin configurar: no se crea el SUPER_ADMIN. "
              + "Sin él, la administración de tenants no tendrá acceso.");
      return;
    }
    // Idempotencia estricta: UN SOLO SUPER_ADMIN por la plataforma.
    // Si cambiaste el email del .env, la cuenta nueva NO se crea: pasar de
    // una identidad a otra es una iteración deliberada (reclase manual), no
    // algo que el bootstrap haga en silencio al reiniciar.
    Integer existing =
        jdbc.queryForObject(
            "select count(*) from app_user where tenant_id = ? and role = 'SUPER_ADMIN'",
            Integer.class,
            PLATFORM_TENANT);
    if (existing != null && existing > 0) {
      log.info("Ya existe un SUPER_ADMIN de plataforma; bootstrap sin cambios (email actual en BD, no el del entorno).");
      return;
    }
    // RLS de app_user exige el contexto: alcance LOCAL a esta transacción.
    jdbc.queryForObject(TenantScope.SET_LOCAL_SQL, String.class, PLATFORM_TENANT);
    jdbc.update(
        """
        insert into app_user (tenant_id, email, password_hash, full_name, role)
        values (?, ?, ?, ?, ?)
        on conflict (tenant_id, email) do nothing
        """,
        PLATFORM_TENANT,
        email,
        passwordEncoder.encode(password),
        fullName,
        UserRole.SUPER_ADMIN.name());
    log.info("SUPER_ADMIN de plataforma creado ({}).", email);
  }
}
