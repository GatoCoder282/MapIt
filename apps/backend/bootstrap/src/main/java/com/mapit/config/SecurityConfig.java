package com.mapit.config;

import java.util.List;

import jakarta.servlet.DispatcherType;

import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.AnonymousAuthenticationFilter;
import org.springframework.security.web.authentication.HttpStatusEntryPoint;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import com.mapit.identity.domain.UserRole;
import com.mapit.identity.infrastructure.JwtAuthenticationFilter;
import com.mapit.shared.http.ApiPaths;

/**
 * Configuración base de seguridad.
 *
 * <p>Esto es <strong>andamiaje</strong>: define qué está abierto y qué no, y deja el resto
 * denegado por defecto. CU-23 añade la autenticación JWT mediante un filtro de
 * {@code identity-infrastructure}; la autorización detallada por rol corresponde a CU-24.
 *
 * <p>Vive en {@code bootstrap} porque es configuración transversal de la aplicación, no
 * lógica de ningún módulo de negocio.
 */
@Configuration
@EnableWebSecurity
public class SecurityConfig {

    /** Rutas públicas del andamiaje. Se irán acotando conforme lleguen los casos de uso. */
    private static final String[] RUTAS_PUBLICAS = {
        // Despacho interno de errores de Spring MVC. Sin esta ruta, un 400 de
        // validación hace forward a /error, vuelve a pasar por este filtro y
        // sale como 403 con el cuerpo vacío.
        "/error",
        "/actuator/health/**",
        "/actuator/info",
        "/v3/api-docs/**",
        "/swagger-ui/**",
        "/swagger-ui.html",
        // El handshake WebSocket no puede transportar el Bearer de forma portable; la identidad
        // se autentica inmediatamente en el frame STOMP CONNECT por RealtimeStompInterceptor.
        "/ws",
        "/ws/**",
        // Superficie pública de reservas (CU-15, CU-16): el cliente final es anónimo.
        ApiPaths.HEALTH,
        ApiPaths.PUBLIC,
        // El login y la activación del primer ADMIN son públicos por definición
        // (la activación no recibe contraseña temporal ni JWT; solo el token del
        // enlace, que ya es un secreto en sí mismo).
        ApiPaths.AUTH_LOGIN,
        ApiPaths.AUTH_ACTIVATE,
        // CRUD temporal que conserva acceso público para validar el stack.
        ApiPaths.DEMO_ITEMS,
        // CU-04. TEMPORAL: la autorización por rol llega en CU-23/CU-24. Hasta
        // entonces el tenant lo resuelve el servidor con DemoTenantContext.
        ApiPaths.ESTABLISHMENTS,
        // CU-05 / MAP-67 / MAP-68. Configuración de Pisos y Sectores
        "/api/v1/floors/**",
        "/api/v1/sectors/**",
        "/v1/floors/**",
        "/v1/sectors/**",
    };

    @Bean
    SecurityFilterChain filterChain(
            HttpSecurity http,
            JwtAuthenticationFilter jwtAuthenticationFilter,
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
                .exceptionHandling(errors -> errors
                        .authenticationEntryPoint(new HttpStatusEntryPoint(HttpStatus.UNAUTHORIZED)))
                .authorizeHttpRequests(auth -> auth
                        // Conserva el status real de validación/404 durante el despacho de error.
                        .dispatcherTypeMatchers(DispatcherType.ERROR).permitAll()
                        .requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()
                        // MAP-124: la ruta vive debajo de /sectors/**, que aún conserva
                        // acceso público temporal para HU-2.03. Esta regla específica debe
                        // evaluarse antes y exige los roles definidos por HU-3.01.
                        .requestMatchers(
                                HttpMethod.PATCH,
                                "/api/v1/sectors/*/elements/*/state")
                        .hasAnyRole(UserRole.ADMIN.name(), UserRole.STAFF.name())
                        .requestMatchers(RUTAS_PUBLICAS).permitAll()
                        // Administración de tenants (CU-01/CU-03): operación exclusiva
                        // del SUPER_ADMIN de plataforma. Cualquier otro rol autenticado
                        // recibe 403; sin JWT recibe 401 por el entry point.
                        .requestMatchers(ApiPaths.TENANTS, ApiPaths.TENANTS_ALL)
                        .hasRole(UserRole.SUPER_ADMIN.name())
                        // Todo lo demás requiere autenticación: se deniega por defecto,
                        // que es la postura correcta. Abrir es una decisión explícita.
                        .anyRequest().authenticated())
                .addFilterBefore(jwtAuthenticationFilter, AnonymousAuthenticationFilter.class)
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
        source.registerCorsConfiguration("/ws/**", config);
        return source;
    }

    /** BCrypt para las contraseñas del staff (RNF09). */
    @Bean
    PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }
}
