package com.mapit.identity;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.IOException;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicBoolean;

import jakarta.servlet.ServletException;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.core.context.SecurityContextHolder;

import com.mapit.identity.domain.AuthenticatedPrincipal;
import com.mapit.identity.domain.UserRole;
import com.mapit.identity.infrastructure.JwtAuthenticationFilter;
import com.mapit.identity.infrastructure.SecurityTenantContext;
import com.mapit.shared.tenant.TenantId;

class JwtSecurityFilterTest {
    private static final AuthenticatedPrincipal PRINCIPAL = new AuthenticatedPrincipal(
            UUID.fromString("00000000-0000-0000-0000-000000000047"),
            TenantId.of("tenant-a"), "staff@example.test", UserRole.ADMIN);

    @AfterEach
    void clearContext() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void bearer_valido_autentica_y_expone_el_tenant_solo_durante_la_peticion()
            throws ServletException, IOException {
        var filter = new JwtAuthenticationFilter(token -> "válido".equals(token)
                ? Optional.of(PRINCIPAL)
                : Optional.empty());
        var tenantContext = new SecurityTenantContext("demo");
        var request = new MockHttpServletRequest();
        request.addHeader("Authorization", "Bearer válido");
        var response = new MockHttpServletResponse();
        var invoked = new AtomicBoolean();

        filter.doFilter(request, response, (servletRequest, servletResponse) -> {
            invoked.set(true);
            var authentication = SecurityContextHolder.getContext().getAuthentication();
            assertThat(authentication.isAuthenticated()).isTrue();
            assertThat(authentication.getPrincipal()).isEqualTo(PRINCIPAL);
            assertThat(authentication.getAuthorities()).extracting("authority")
                    .containsExactly("ROLE_ADMIN");
            assertThat(tenantContext.current()).contains(TenantId.of("tenant-a"));
        });

        assertThat(invoked).isTrue();
        assertThat(SecurityContextHolder.getContext().getAuthentication()).isNull();
        assertThat(tenantContext.current()).contains(TenantId.of("demo"));
    }

    @Test
    void bearer_invalido_responde_401_y_no_continua_la_cadena()
            throws ServletException, IOException {
        var filter = new JwtAuthenticationFilter(token -> Optional.empty());
        var request = new MockHttpServletRequest();
        request.addHeader("Authorization", "Bearer alterado");
        var response = new MockHttpServletResponse();
        var invoked = new AtomicBoolean();

        filter.doFilter(request, response, (servletRequest, servletResponse) -> invoked.set(true));

        assertThat(invoked).isFalse();
        assertThat(response.getStatus()).isEqualTo(401);
        assertThat(SecurityContextHolder.getContext().getAuthentication()).isNull();
    }
}
