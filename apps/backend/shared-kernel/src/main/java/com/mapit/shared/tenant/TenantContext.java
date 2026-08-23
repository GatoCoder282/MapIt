package com.mapit.shared.tenant;

import java.util.Optional;

/**
 * Acceso al tenant de la petición en curso.
 *
 * <p>Es un <em>puerto</em>: el dominio y los casos de uso preguntan por el tenant actual
 * sin saber de dónde sale. La infraestructura lo implementa leyendo el claim {@code tenant}
 * del JWT (rutas de staff) o el slug del establecimiento (rutas públicas).
 *
 * <p>Aunque Hibernate filtre por {@code @TenantId} y PostgreSQL aplique RLS, hay lógica
 * de negocio que necesita saber explícitamente en qué tenant está operando.
 */
public interface TenantContext {

  /** Tenant de la petición actual, o vacío en contextos sin tenant (ej. tareas de plataforma). */
  Optional<TenantId> current();

  /**
   * Tenant actual, o excepción si no hay ninguno.
   *
   * @throws IllegalStateException si se invoca fuera de un contexto con tenant
   */
  default TenantId require() {
    return current()
        .orElseThrow(
            () ->
                new IllegalStateException(
                    "No hay tenant en el contexto. ¿La petición pasó por el filtro de tenant?"));
  }
}
