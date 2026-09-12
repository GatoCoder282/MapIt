package com.mapit.identity.infrastructure;

import java.io.IOException;
import java.util.List;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import com.mapit.identity.domain.AccessTokenVerifier;

/** Valida el Bearer token una vez por petición y crea la identidad de Spring Security. */
@Component
public class JwtAuthenticationFilter extends OncePerRequestFilter {
    private static final String BEARER = "Bearer ";

    private final AccessTokenVerifier tokens;

    public JwtAuthenticationFilter(AccessTokenVerifier tokens) {
        this.tokens = tokens;
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

        var identity = principal.orElseThrow();
        var authentication = new UsernamePasswordAuthenticationToken(identity, null,
                List.of(new SimpleGrantedAuthority("ROLE_" + identity.role().name())));
        var context = SecurityContextHolder.createEmptyContext();
        context.setAuthentication(authentication);
        SecurityContextHolder.setContext(context);
        try {
            chain.doFilter(request, response);
        } finally {
            SecurityContextHolder.clearContext();
        }
    }
}
