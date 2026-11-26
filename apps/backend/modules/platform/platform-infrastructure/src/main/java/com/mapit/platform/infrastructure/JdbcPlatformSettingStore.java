package com.mapit.platform.infrastructure;

import java.util.List;
import java.util.OptionalInt;
import java.util.UUID;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import com.mapit.platform.domain.PlatformSettingChange;
import com.mapit.platform.domain.PlatformSettingHistory;
import com.mapit.platform.domain.PlatformSettingStore;
import com.mapit.shared.settings.PlatformSetting;

/** Valores globales y su historial (leído de la bitácora inmutable del tenant `platform`). */
@Repository
class JdbcPlatformSettingStore implements PlatformSettingStore, PlatformSettingHistory {

  private final JdbcTemplate jdbc;

  JdbcPlatformSettingStore(JdbcTemplate jdbc) {
    this.jdbc = jdbc;
  }

  @Override
  public OptionalInt find(PlatformSetting setting) {
    List<Integer> values =
        jdbc.queryForList(
            "select int_value from platform_setting where setting_key = ?",
            Integer.class,
            setting.key());
    return values.isEmpty() ? OptionalInt.empty() : OptionalInt.of(values.getFirst());
  }

  @Override
  public void lock(PlatformSetting setting) {
    // Bloqueo por nombre: también cubre el primer cambio, cuando aún no hay fila.
    jdbc.queryForList(
        "select pg_advisory_xact_lock(hashtext(?))", "platform-setting:" + setting.key());
  }

  @Override
  public void save(PlatformSetting setting, int value, UUID actorId) {
    jdbc.update(
        """
        insert into platform_setting (setting_key, int_value, updated_at, updated_by)
        values (?, ?, now(), ?)
        on conflict (setting_key) do update
          set int_value = excluded.int_value, updated_at = now(), updated_by = excluded.updated_by
        """,
        setting.key(),
        value,
        actorId);
  }

  @Override
  public void delete(PlatformSetting setting) {
    jdbc.update("delete from platform_setting where setting_key = ?", setting.key());
  }

  @Override
  public List<PlatformSettingChange> latest(int limit) {
    return jdbc.query(
        """
        select a.details ->> 'setting' as setting_key,
               a.details ->> 'previousValue' as previous_value,
               a.details ->> 'newValue' as new_value,
               a.details ->> 'reason' as reason,
               u.full_name as actor_name,
               a.occurred_at
        from audit_log a
        join app_user u on u.id = a.actor_id and u.tenant_id = a.tenant_id
        where a.tenant_id = 'platform' and a.resource_type = 'PLATFORM_SETTING'
        order by a.occurred_at desc, a.id desc
        limit ?
        """,
        (row, index) ->
            new PlatformSettingChange(
                row.getString("setting_key"),
                row.getString("previous_value"),
                row.getString("new_value"),
                row.getString("reason"),
                row.getString("actor_name"),
                row.getTimestamp("occurred_at").toInstant()),
        limit);
  }
}
