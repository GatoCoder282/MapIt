package com.mapit.operations.domain.state;

import java.util.Map;

import com.mapit.shared.realtime.SpaceElementState;
import com.mapit.shared.tenant.TenantId;

/**
 * Puerto de lectura agregada de los estados operativos del tenant.
 *
 * <p>Devuelve únicamente los estados presentes en la base de datos; completar los
 * estados ausentes con 0 es responsabilidad de la capa de aplicación.
 */
public interface SpaceElementStateSummaryRepository {

  Map<SpaceElementState, Long> countByState(TenantId tenantId);
}
