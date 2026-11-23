package com.mapit.config;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.*;

import java.util.stream.IntStream;

import org.flywaydb.core.Flyway;
import org.flywaydb.core.api.FlywayException;
import org.flywaydb.core.api.MigrationInfo;
import org.flywaydb.core.api.MigrationInfoService;
import org.flywaydb.core.api.MigrationState;
import org.flywaydb.core.api.MigrationVersion;
import org.flywaydb.core.api.configuration.Configuration;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;

class NotificationMigrationDependencyTest {
  private final Flyway flyway = mock(Flyway.class);
  private final Configuration configuration = mock(Configuration.class);
  private final MigrationInfoService info = mock(MigrationInfoService.class);

  private MigrationInfo migration(int version, MigrationState state) {
    var migration = mock(MigrationInfo.class);
    when(migration.getVersion()).thenReturn(MigrationVersion.fromVersion("" + version));
    when(migration.getState()).thenReturn(state);
    if (version == 40) {
      when(migration.getScript()).thenReturn("V40__agregar_contacto_e_idioma_al_perfil_personal.sql");
    }
    return migration;
  }

  private void configure(MigrationInfo... migrations) {
    when(flyway.getConfiguration()).thenReturn(configuration);
    when(flyway.info()).thenReturn(info);
    when(info.all()).thenReturn(migrations);
  }

  @Test
  void refusesMissingV40BeforeAnyMigrationIsExecuted() {
    configure(migration(41, MigrationState.PENDING));
    assertThatThrownBy(() -> new NotificationMigrationDependency().notificationMigrationOrder().migrate(flyway))
        .isInstanceOf(FlywayException.class).hasMessageContaining("MAP-285");
    verify(flyway, never()).migrate();
  }

  @ParameterizedTest
  @EnumSource(value = MigrationState.class, names = {"MISSING_SUCCESS", "IGNORED", "OUT_OF_ORDER", "BASELINE"})
  void refusesMissingIgnoredOrOutOfOrderDependency(MigrationState state) {
    configure(migration(40, state));
    assertThatThrownBy(() -> new NotificationMigrationDependency().notificationMigrationOrder().migrate(flyway))
        .isInstanceOf(FlywayException.class);
    verify(flyway, never()).migrate();
  }

  @Test
  void refusesAnotherMigrationUsingTheReservedVersion() {
    var other = migration(40, MigrationState.PENDING);
    when(other.getScript()).thenReturn("V40__otra_historia.sql");
    configure(other);
    assertThatThrownBy(() -> new NotificationMigrationDependency().notificationMigrationOrder().migrate(flyway))
        .isInstanceOf(FlywayException.class).hasMessageContaining("MAP-285");
    verify(flyway, never()).migrate();
  }

  @Test
  void refusesAppliedNotificationsBeforePendingV40() {
    configure(migration(40, MigrationState.PENDING), migration(41, MigrationState.SUCCESS));
    assertThatThrownBy(() -> new NotificationMigrationDependency().notificationMigrationOrder().migrate(flyway))
        .isInstanceOf(FlywayException.class);
    verify(flyway, never()).migrate();
  }

  @Test
  void refusesOutOfOrderConfiguration() {
    configure();
    when(configuration.isOutOfOrder()).thenReturn(true);
    assertThatThrownBy(() -> new NotificationMigrationDependency().notificationMigrationOrder().migrate(flyway))
        .isInstanceOf(FlywayException.class);
    verify(flyway, never()).migrate();
  }

  @ParameterizedTest
  @EnumSource(value = MigrationState.class, names = {"PENDING", "SUCCESS"})
  void runsNormalMigrationForResolvedOrderedChain(MigrationState state) {
    configure(IntStream.rangeClosed(40, 43).mapToObj(version -> migration(version, state)).toArray(MigrationInfo[]::new));
    new NotificationMigrationDependency().notificationMigrationOrder().migrate(flyway);
    verify(flyway).migrate();
  }

  @Test
  void allowsV40AlreadyAppliedWithNotificationsPending() {
    configure(migration(40, MigrationState.SUCCESS), migration(41, MigrationState.PENDING),
        migration(42, MigrationState.PENDING), migration(43, MigrationState.PENDING));
    new NotificationMigrationDependency().notificationMigrationOrder().migrate(flyway);
    verify(flyway).migrate();
  }
}
