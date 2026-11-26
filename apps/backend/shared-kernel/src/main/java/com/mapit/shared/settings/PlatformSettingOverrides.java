package com.mapit.shared.settings;

import java.util.OptionalInt;

/**
 * Valores guardados por el Super Admin, para los contextos que los consumen.
 *
 * <p>Vacío significa «usa el valor del despliegue»: no hay cambio guardado o la sección está
 * apagada por su flag (rollback seguro, RN-3).
 */
public interface PlatformSettingOverrides {

  OptionalInt override(PlatformSetting setting);
}
