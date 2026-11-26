package com.mapit.platform.domain;

import java.util.OptionalInt;
import java.util.UUID;

import com.mapit.shared.settings.PlatformSetting;

/** Persistencia de los valores globales guardados. */
public interface PlatformSettingStore {

  OptionalInt find(PlatformSetting setting);

  /** Serializa los cambios concurrentes de un parámetro hasta el fin de la transacción. */
  void lock(PlatformSetting setting);

  void save(PlatformSetting setting, int value, UUID actorId);

  void delete(PlatformSetting setting);
}
