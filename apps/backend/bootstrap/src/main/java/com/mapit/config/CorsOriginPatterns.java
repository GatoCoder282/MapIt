package com.mapit.config;

import java.util.List;

/**
 * Normaliza {@code mapit.cors.allowed-origins} para que REST ({@link SecurityConfig}) y el
 * handshake STOMP ({@link RealtimeWebSocketConfig}) apliquen exactamente la misma lista.
 *
 * <p>Las entradas se tratan como <em>patrones</em> de origen de Spring: un origen exacto
 * ({@code https://app.example.com}) solo coincide consigo mismo, y {@code *} dentro del host
 * permite cubrir los previews de Vercel, cuyo subdominio cambia en cada despliegue
 * ({@code https://mi-app-*-mi-equipo.vercel.app}). En producción conviene listar solo orígenes
 * exactos.
 */
final class CorsOriginPatterns {

    private static final String COMODIN_TOTAL = "*";

    private CorsOriginPatterns() {}

    /**
     * Recorta espacios, descarta entradas vacías (p. ej. una coma final en la variable de entorno)
     * y rechaza el comodín total.
     *
     * @throws IllegalStateException si alguna entrada es exactamente {@code *}: con
     *     {@code allowCredentials(true)} aceptaría cualquier origen con credenciales.
     */
    static List<String> from(List<String> configurados) {
        List<String> patrones = configurados.stream()
                .map(String::trim)
                .filter(origen -> !origen.isEmpty())
                .toList();
        if (patrones.contains(COMODIN_TOTAL)) {
            throw new IllegalStateException(
                    "mapit.cors.allowed-origins (CORS_ALLOWED_ORIGINS) no admite \"*\": con "
                            + "credenciales habilitadas aceptaría peticiones de cualquier origen. "
                            + "Lista los orígenes exactos o un patrón acotado, p. ej. "
                            + "https://mi-app-*-mi-equipo.vercel.app.");
        }
        return patrones;
    }
}
