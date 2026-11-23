package com.mapit.config;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.List;

import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;

/** CORS por patrones: previews de Vercel del equipo sí; otros orígenes y {@code *}, no. */
class SecurityConfigCorsTest {

    private static final String LOCAL = "http://localhost:4300";
    private static final String PATRON_PREVIEW =
            "https://map-it-n7y1-*-diegos-projects-03cdb86b.vercel.app";

    private static final List<String> PERMITIDOS = List.of(
            LOCAL,
            "https://map-it-n7y1-7g3z8b6iw-diegos-projects-03cdb86b.vercel.app",
            "https://map-it-n7y1-git-feat-x-diegos-projects-03cdb86b.vercel.app");

    private static final List<String> RECHAZADOS = List.of(
            "http://map-it-n7y1-7g3z8b6iw-diegos-projects-03cdb86b.vercel.app",
            "https://map-it-n7y1-abc-otro-equipo.vercel.app",
            "https://evil.example");

    private final SecurityConfig securityConfig = new SecurityConfig();

    @Test
    void apiYWebSocketAceptanOrigenExactoYPreviewsDelEquipo() {
        for (String ruta : List.of("/api/v1/x", "/ws")) {
            CorsConfiguration config = configuracionPara(List.of(LOCAL, PATRON_PREVIEW), ruta);

            for (String origen : PERMITIDOS) {
                assertThat(config.checkOrigin(origen)).as("%s en %s", origen, ruta).isEqualTo(origen);
            }
            for (String origen : RECHAZADOS) {
                assertThat(config.checkOrigin(origen)).as("%s en %s", origen, ruta).isNull();
            }
            assertThat(config.getAllowCredentials()).isTrue();
            assertThat(config.getExposedHeaders()).containsExactly("X-Request-ID");
        }
    }

    @Test
    void recortaEspaciosEIgnoraEntradasVacias() {
        CorsConfiguration config = configuracionPara(List.of("  " + LOCAL + "  ", "", "   "), "/api/v1/x");

        assertThat(config.getAllowedOriginPatterns()).containsExactly(LOCAL);
        assertThat(config.checkOrigin(LOCAL)).isEqualTo(LOCAL);
    }

    @Test
    void rechazaElComodinTotalAlArrancar() {
        assertThatThrownBy(() -> securityConfig.corsConfigurationSource(List.of(LOCAL, " * ")))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("\"*\"");
    }

    private CorsConfiguration configuracionPara(List<String> origenes, String ruta) {
        CorsConfigurationSource source = securityConfig.corsConfigurationSource(origenes);
        CorsConfiguration config = source.getCorsConfiguration(new MockHttpServletRequest("GET", ruta));
        assertThat(config).as("configuración CORS para %s", ruta).isNotNull();
        return config;
    }
}
