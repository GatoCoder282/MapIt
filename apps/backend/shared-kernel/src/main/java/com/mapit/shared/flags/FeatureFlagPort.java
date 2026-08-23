package com.mapit.shared.flags;

/**
 * Puerto de feature toggles.
 *
 * <p>El dominio y los casos de uso preguntan «¿está activa esta funcionalidad?» sin conocer
 * Unleash. El adaptador vive en la infraestructura ({@code UnleashFeatureFlagAdapter}), y en
 * los tests se sustituye por una implementación en memoria.
 *
 * <p>Esto es lo que permite cambiar de proveedor de flags —o quitarlo— sin tocar la lógica
 * de negocio. Ver plan §9.
 */
public interface FeatureFlagPort {

  /**
   * Evalúa una flag en el contexto actual (tenant, usuario, rol, país).
   *
   * @param flag clave con formato {@code <dominio>.<feature>}, ej. {@code payments.qr}
   * @return el valor por defecto de la flag si el servidor no responde — nunca lanza
   */
  boolean isEnabled(FeatureFlag flag);

  /** Evalúa una flag con un valor por defecto explícito. */
  boolean isEnabled(FeatureFlag flag, boolean valorPorDefecto);
}
