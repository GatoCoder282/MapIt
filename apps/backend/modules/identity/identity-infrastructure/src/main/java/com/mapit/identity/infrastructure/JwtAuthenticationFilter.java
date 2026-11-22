package com.mapit.identity.infrastructure;

import java.io.IOException;
import java.util.List;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import org.slf4j.MDC;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import com.mapit.identity.domain.AccessTokenVerifier;
import com.mapit.identity.domain.CurrentStaffIdentity;

/** Valida el Bearer token una vez por petición y crea la identidad de Spring Security. */
@Component
public class JwtAuthenticationFilter extends OncePerRequestFilter {
    private static final String BEARER = "Bearer ";

    private final AccessTokenVerifier tokens;
    private final CurrentStaffIdentity identities;

    public JwtAuthenticationFilter(AccessTokenVerifier tokens, CurrentStaffIdentity identities) {
        this.tokens = tokens;
        this.identities = identities;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
            FilterChain chain) throws ServletException, IOException {
        String authorization = request.getHeader(HttpHeaders.AUTHORIZATION);
        if (authorization == null) {
            chain.doFilter(request, response);
            return;
        }
        if (!authorization.startsWith(BEARER)) {
            chain.doFilter(request, response);
            return;
        }

        var principal = tokens.verify(authorization.substring(BEARER.length()).strip());
        if (principal.isEmpty()) {
            response.sendError(HttpStatus.UNAUTHORIZED.value());
            return;
        }

        com.mapit.identity.domain.AuthenticatedPrincipal identity;
        try {
            var current = identities.resolve(principal.orElseThrow());
            if (current.isEmpty()) {
                response.sendError(HttpStatus.UNAUTHORIZED.value());
                return;
            }
            identity = current.orElseThrow();
        } catch (RuntimeException failure) {
            // Error de BD o identidad corrupta: nunca autorizar solo con claims.
            response.sendError(HttpStatus.UNAUTHORIZED.value());
            return;
        }
        var authentication = new UsernamePasswordAuthenticationToken(identity, null,
                List.of(new SimpleGrantedAuthority("ROLE_" + identity.role().name())));
        var context = SecurityContextHolder.createEmptyContext();
        context.setAuthentication(authentication);
        SecurityContextHolder.setContext(context);
        String previousTenant = MDC.get("tenant_id");
        MDC.put("tenant_id", identity.tenantId().value());
        request.setAttribute("mapit.logging.tenant_id", identity.tenantId().value());
        try {
            chain.doFilter(request, response);
        } finally {
            SecurityContextHolder.clearContext();
            if (previousTenant == null) MDC.remove("tenant_id");
            else MDC.put("tenant_id", previousTenant);
        }
    }
}
