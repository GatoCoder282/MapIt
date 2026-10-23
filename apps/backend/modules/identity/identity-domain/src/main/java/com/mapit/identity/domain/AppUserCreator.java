package com.mapit.identity.domain;

import java.util.UUID;

import com.mapit.shared.tenant.TenantId;

/** Puerto de creación de usuarios de staff (alto nivel: rol y tenant definidos). */
public interface AppUserCreator {

  /**
   * Crea el usuario activo con el rol y tenant indicados.
   * Devuelve el id generado. Comportamiento ante duplicado lo decide la capa
   * de aplicación (la BD lo rechazaría con la restricción UNIQUE).
   */
  UUID create(TenantId tenantId, String email, String fullName, String passwordHash, UserRole role);
}
