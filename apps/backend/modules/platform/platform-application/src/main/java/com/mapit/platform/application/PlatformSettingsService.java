package com.mapit.platform.application;

import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.OptionalInt;
import java.util.UUID;

import org.jspecify.annotations.Nullable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.mapit.platform.domain.BusinessApplication;
import com.mapit.platform.domain.PlatformApplicationScope;
import com.mapit.platform.domain.PlatformSettingChange;
import com.mapit.platform.domain.PlatformSettingHistory;
import com.mapit.platform.domain.PlatformSettingStore;
import com.mapit.shared.audit.AuditEvent;
import com.mapit.shared.audit.AuditEventRecorder;
import com.mapit.shared.audit.AuditEventType;
import com.mapit.shared.audit.AuditResourceType;
import com.mapit.shared.flags.FeatureFlag;
import com.mapit.shared.flags.FeatureFlagPort;
import com.mapit.shared.security.ActorContext;
import com.mapit.shared.settings.PlatformSetting;

/**
 * Consulta y cambio de la configuración global (HU-7.07).
 *
 * <p>La flag es la primera compuerta de cada operación; la autorización SUPER_ADMIN la impone
 * {@code SecurityConfig} antes de llegar aquí.
 */
@Service
public class PlatformSettingsService {

  private static final int HISTORY_SIZE = 50;
  private static final int MIN_REASON = 10;
  private static final int MAX_REASON = 200;

  private final PlatformSettingStore store;
  private final PlatformSettingHistory history;
  private final PlatformSettingDefaults defaults;
  private final PlatformApplicationScope scope;
  private final FeatureFlagPort flags;
  private final AuditEventRecorder audit;
  private final ActorContext actors;
  private final Clock clock;

  public PlatformSettingsService(
      PlatformSettingStore store,
      PlatformSettingHistory history,
      PlatformSettingDefaults defaults,
      PlatformApplicationScope scope,
      FeatureFlagPort flags,
      AuditEventRecorder audit,
      ActorContext actors,
      Clock clock) {
    this.store = store;
    this.history = history;
    this.defaults = defaults;
    this.scope = scope;
    this.flags = flags;
    this.audit = audit;
    this.actors = actors;
    this.clock = clock;
  }

  public void requireEnabled() {
    if (!flags.isEnabled(FeatureFlag.MAPIT_S6_PLATFORM_SETTINGS)) {
      throw new PlatformSettingsDisabled();
    }
  }

  @Transactional(readOnly = true)
  public List<Value> values() {
    requireEnabled();
    return Arrays.stream(PlatformSetting.values()).map(this::current).toList();
  }

  @Transactional(readOnly = true)
  public List<PlatformSettingChange> changes() {
    requireEnabled();
    scope.enter();
    return history.latest(HISTORY_SIZE);
  }

  /**
   * @param value nuevo valor, o nulo para volver al del despliegue
   * @param expectedValue valor efectivo que el cliente tenía en pantalla
   */
  @Transactional
  public Value change(String key, @Nullable Integer value, int expectedValue, String reason) {
    requireEnabled();
    PlatformSetting setting =
        PlatformSetting.of(key).orElseThrow(() -> new UnknownPlatformSetting(key));
    if (value != null && !setting.accepts(value)) {
      throw new IllegalArgumentException(
          "El valor debe estar entre %d y %d".formatted(setting.min(), setting.max()));
    }
    String motive = reason.strip();
    if (motive.length() < MIN_REASON || motive.length() > MAX_REASON) {
      throw new IllegalArgumentException(
          "El motivo debe tener entre %d y %d caracteres".formatted(MIN_REASON, MAX_REASON));
    }
    UUID actor = actors.requireUserId();
    scope.enter();
    store.lock(setting);
    Value before = current(setting);
    if (before.value() != expectedValue) {
      throw new PlatformSettingConflict();
    }
    if (value == null) {
      store.delete(setting);
    } else {
      store.save(setting, value, actor);
    }
    Value after = current(setting);
    audit.record(
        new AuditEvent(
            UUID.randomUUID(),
            BusinessApplication.PLATFORM,
            actor,
            clock.instant(),
            AuditResourceType.PLATFORM_SETTING,
            UUID.nameUUIDFromBytes(setting.key().getBytes(StandardCharsets.UTF_8)),
            AuditEventType.PLATFORM_SETTING_CHANGED,
            Map.of(
                "setting", setting.key(),
                "previousValue", String.valueOf(before.value()),
                "newValue", String.valueOf(after.value()),
                "reason", motive)));
    return after;
  }

  private Value current(PlatformSetting setting) {
    int byDefault = defaults.of(setting);
    OptionalInt saved = store.find(setting);
    return new Value(setting, saved.orElse(byDefault), byDefault, saved.isPresent());
  }

  /** Valor efectivo de un parámetro. */
  public record Value(PlatformSetting setting, int value, int defaultValue, boolean overridden) {}
}
