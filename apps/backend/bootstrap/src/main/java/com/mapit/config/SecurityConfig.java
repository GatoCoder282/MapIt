package com.mapit.config;

import java.util.List;

import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

/**
 * Configuración base de seguridad.
 *
 * <p>Esto es <strong>andamiaje</strong>: define qué está abierto y qué no, y deja el resto
 * denegado por defecto. La autenticación real con JWT y la autorización por rol llegan en
 * CU-23 y CU-24, y se añadirán como un filtro dentro de {@code identity-infrastructure}.
 *
 * <p>Vive en {@code bootstrap} porque es configuración transversal de la aplicación, no
 * lógica de ningún módulo de negocio.
 */
@Configuration
@EnableWebSecurity
public class SecurityConfig {

    /** Rutas públicas del andamiaje. Se irán acotando conforme lleguen los casos de uso. */
    private static final String[] RUTAS_PUBLICAS = {
        "/actuator/health/**",
        "/actuator/info",
        "/v3/api-docs/**",
        "/swagger-ui/**",
        "/swagger-ui.html",
        // Superficie pública de reservas (CU-15, CU-16): el cliente final es anónimo.
        "/api/v1/health",
        "/api/v1/public/**",
    };

    @Bean
    SecurityFilterChain filterChain(
            HttpSecurity http,
            // Se cualifica por NOMBRE a propósito: Spring MVC registra su propio
            // `mvcHandlerMappingIntrospector`, que también implementa
            // CorsConfigurationSource, y la inyección por tipo queda ambigua.
            @Qualifier("corsConfigurationSource") CorsConfigurationSource cors)
            throws Exception {
        return http
                // La API es sin estado y se autentica con JWT (no con cookies de sesión),
                // así que CSRF no aplica: no hay cookie que un tercero pueda reutilizar.
                .csrf(csrf -> csrf.disable())
                .cors(c -> c.configurationSource(cors))
                .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()
                        .requestMatchers(RUTAS_PUBLICAS).permitAll()
                        // Todo lo demás requiere autenticación: se deniega por defecto,
                        // que es la postura correcta. Abrir es una decisión explícita.
                        .anyRequest().authenticated())
                .httpBasic(basic -> basic.disable())
                .formLogin(form -> form.disable())
                .build();
    }

    @Bean
    CorsConfigurationSource corsConfigurationSource(
            @Value("${mapit.cors.allowed-origins}") List<String> origenesPermitidos) {
        CorsConfiguration config = new CorsConfiguration();
        config.setAllowedOrigins(origenesPermitidos);
        config.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
        config.setAllowedHeaders(List.of("*"));
        config.setAllowCredentials(true);
        config.setMaxAge(3600L);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/api/**", config);
        return source;
    }

    /** BCrypt para las contraseñas del staff (RNF09). */
    @Bean
    PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }
}
