package com.mapit.platform.domain;

import java.util.List;

/** Lectura de la bitácora de cambios de configuración. */
public interface PlatformSettingHistory {

  List<PlatformSettingChange> latest(int limit);
}
