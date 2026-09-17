package com.mapit.shared.http;

/**
 * Rutas de la API que cruzan capas o módulos.
 *
 * <p>Ejemplo del acoplamiento que se evita: si el controlador de tenants se mueve
 * y la regla de seguridad apuntaba a la ruta literal, la protección se pierde sin
 * que nadie lo note. Con esto, controlador y `SecurityConfig` comparten la fuente.
 *
 * <p>No listemos aquí todas las rutas: solo las que alguien más necesita conocer
 * (configuración de seguridad, wiring transversal). Las rutas internas de un
 * módulo viven en su controlador.
 */
public final class ApiPaths {

  /** Prefijo versionado de toda la API. */
  public static final String API_V1 = "/api/v1";

  public static final String HEALTH = API_V1 + "/health";
  public static final String PUBLIC = API_V1 + "/public/**";
  public static final String AUTH_LOGIN = API_V1 + "/auth/login";
  public static final String AUTH_ACTIVATE = API_V1 + "/auth/activate";
  public static final String DEMO_ITEMS = API_V1 + "/demo-items/**";
  public static final String ESTABLISHMENTS = API_V1 + "/establishments/**";
  public static final String TENANTS = API_V1 + "/tenants";
  public static final String TENANTS_ALL = TENANTS + "/**";

  private ApiPaths() {}
}
