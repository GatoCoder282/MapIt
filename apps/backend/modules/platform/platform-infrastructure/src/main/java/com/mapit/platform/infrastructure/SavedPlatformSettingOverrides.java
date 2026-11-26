package com.mapit.platform.infrastructure;

import java.util.OptionalInt;

import org.springframework.stereotype.Component;

import com.mapit.platform.domain.PlatformSettingStore;
import com.mapit.shared.flags.FeatureFlag;
import com.mapit.shared.flags.FeatureFlagPort;
import com.mapit.shared.settings.PlatformSetting;
import com.mapit.shared.settings.PlatformSettingOverrides;

/** Publica los valores guardados solo mientras la sección esté habilitada (RN-3). */
@Component
class SavedPlatformSettingOverrides implements PlatformSettingOverrides {

  private final PlatformSettingStore store;
  private final FeatureFlagPort flags;

  SavedPlatformSettingOverrides(PlatformSettingStore store, FeatureFlagPort flags) {
    this.store = store;
    this.flags = flags;
  }

  @Override
  public OptionalInt override(PlatformSetting setting) {
    return flags.isEnabled(FeatureFlag.MAPIT_S6_PLATFORM_SETTINGS)
        ? store.find(setting)
        : OptionalInt.empty();
  }
}
