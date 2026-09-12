package com.mapit.identity.infrastructure;

import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Date;
import java.util.Optional;
import java.util.UUID;

import javax.crypto.SecretKey;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import com.mapit.identity.domain.AccessTokenIssuer;
import com.mapit.identity.domain.AccessTokenVerifier;
import com.mapit.identity.domain.AuthenticatedPrincipal;
import com.mapit.identity.domain.AuthenticatedUser;
import com.mapit.identity.domain.IssuedAccessToken;
import com.mapit.identity.domain.UserRole;
import com.mapit.shared.tenant.TenantId;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jws;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;

/** Adaptador JJWT para tokens de acceso HS256. */
@Component
public class JjwtTokenService implements AccessTokenIssuer, AccessTokenVerifier {
    private static final String ACCESS_TYPE = "access";
    private static final String HS256 = "HS256";

    private final SecretKey key;
    private final String issuer;
    private final Duration ttl;
    private final Clock clock;

    public JjwtTokenService(
            @Value("${mapit.jwt.secret}") String secret,
            @Value("${mapit.jwt.issuer:mapit}") String issuer,
            @Value("${mapit.jwt.access-ttl-minutes}") long ttlMinutes,
            Clock clock) {
        if (secret.getBytes(StandardCharsets.UTF_8).length < 32) {
            throw new IllegalArgumentException("mapit.jwt.secret debe tener al menos 32 bytes");
        }
        if (issuer.isBlank()) {
            throw new IllegalArgumentException("mapit.jwt.issuer no puede estar vacío");
        }
        if (ttlMinutes <= 0) {
            throw new IllegalArgumentException("mapit.jwt.access-ttl-minutes debe ser positivo");
        }
        this.key = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
        this.issuer = issuer;
        this.ttl = Duration.ofMinutes(ttlMinutes);
        this.clock = clock;
    }

    @Override
    public IssuedAccessToken issue(AuthenticatedUser user) {
        Instant issuedAt = clock.instant();
        Instant expiresAt = issuedAt.plus(ttl);
        String token = Jwts.builder()
                .subject(user.id().toString())
                .issuer(issuer)
                .issuedAt(Date.from(issuedAt))
                .expiration(Date.from(expiresAt))
                .id(UUID.randomUUID().toString())
                .claim("tenant", user.tenantId().value())
                .claim("role", user.role().name())
                .claim("email", user.email())
                .claim("typ", ACCESS_TYPE)
                .signWith(key, Jwts.SIG.HS256)
                .compact();
        return new IssuedAccessToken(token, expiresAt);
    }

    @Override
    public Optional<AuthenticatedPrincipal> verify(String token) {
        if (token == null || token.isBlank()) {
            return Optional.empty();
        }
        try {
            Jws<Claims> parsed = Jwts.parser()
                    .verifyWith(key)
                    .requireIssuer(issuer)
                    .clock(() -> Date.from(clock.instant()))
                    .build()
                    .parseSignedClaims(token);
            if (!HS256.equals(parsed.getHeader().getAlgorithm())) {
                return Optional.empty();
            }
            Claims claims = parsed.getPayload();
            if (!ACCESS_TYPE.equals(claims.get("typ", String.class))
                    || claims.getIssuedAt() == null
                    || claims.getExpiration() == null
                    || claims.getId() == null
                    || claims.getId().isBlank()
                    || claims.getIssuedAt().toInstant().isAfter(clock.instant())
                    || !claims.getExpiration().after(claims.getIssuedAt())) {
                return Optional.empty();
            }
            return Optional.of(new AuthenticatedPrincipal(
                    UUID.fromString(requiredString(claims, Claims.SUBJECT)),
                    TenantId.of(requiredString(claims, "tenant")),
                    requiredString(claims, "email"),
                    UserRole.valueOf(requiredString(claims, "role"))));
        } catch (JwtException | IllegalArgumentException exception) {
            return Optional.empty();
        }
    }

    private static String requiredString(Claims claims, String name) {
        String value = claims.get(name, String.class);
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException("claim obligatorio ausente");
        }
        return value;
    }
}
