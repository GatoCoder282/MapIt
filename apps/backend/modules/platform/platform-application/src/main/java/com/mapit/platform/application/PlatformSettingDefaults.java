package com.mapit.platform.application;

import org.springframework.core.env.Environment;
import org.springframework.stereotype.Component;

import com.mapit.shared.settings.PlatformSetting;

/** Valor que rige sin cambios guardados: el del despliegue o el del catálogo. */
@Component
public class PlatformSettingDefaults {

  private final Environment environment;

  public PlatformSettingDefaults(Environment environment) {
    this.environment = environment;
  }

  public int of(PlatformSetting setting) {
    return environment.getProperty(setting.property(), Integer.class, setting.fallback());
  }
}
