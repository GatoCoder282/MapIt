package com.mapit.identity.infrastructure;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.Date;
import java.util.UUID;

import org.junit.jupiter.api.Test;

import com.mapit.identity.domain.AuthenticatedUser;
import com.mapit.identity.domain.UserRole;
import com.mapit.shared.tenant.TenantId;

import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;

class JjwtTokenServiceTest {
    private static final String SECRET = "0123456789abcdef0123456789abcdef";
    private static final Instant NOW = Instant.parse("2026-09-10T12:00:00Z");
    private static final UUID USER_ID = UUID.fromString("00000000-0000-0000-0000-000000000047");
    private static final AuthenticatedUser USER = new AuthenticatedUser(USER_ID,
            TenantId.of("tenant-a"), "staff@example.test", "Operador", UserRole.MANAGER);

    @Test
    void emite_y_valida_los_claims_obligatorios() {
        var service = serviceAt(NOW, "mapit", 15);

        var issued = service.issue(USER);
        var claims = Jwts.parser()
                .verifyWith(Keys.hmacShaKeyFor(SECRET.getBytes(StandardCharsets.UTF_8)))
                .build()
                .parseSignedClaims(issued.value());

        assertThat(claims.getHeader().getAlgorithm()).isEqualTo("HS256");
        assertThat(claims.getPayload().getSubject()).isEqualTo(USER_ID.toString());
        assertThat(claims.getPayload().getIssuer()).isEqualTo("mapit");
        assertThat(claims.getPayload().getId()).isNotBlank();
        assertThat(claims.getPayload().getIssuedAt()).isEqualTo(Date.from(NOW));
        assertThat(claims.getPayload().getExpiration()).isEqualTo(Date.from(NOW.plusSeconds(900)));
        assertThat(claims.getPayload().get("tenant", String.class)).isEqualTo("tenant-a");
        assertThat(claims.getPayload().get("role", String.class)).isEqualTo("MANAGER");
        assertThat(claims.getPayload().get("email", String.class)).isEqualTo("staff@example.test");
        assertThat(claims.getPayload().get("typ", String.class)).isEqualTo("access");
        assertThat(issued.expiresAt()).isEqualTo(NOW.plusSeconds(900));

        assertThat(service.verify(issued.value())).contains(USER.toPrincipal());
    }

    @Test
    void rechaza_tokens_expirados_alterados_y_de_otro_emisor() {
        var issuer = serviceAt(NOW, "mapit", 15);
        String token = issuer.issue(USER).value();
        String altered = token.substring(0, token.length() - 2) + "aa";

        assertThat(serviceAt(NOW.plusSeconds(901), "mapit", 15).verify(token)).isEmpty();
        assertThat(issuer.verify(altered)).isEmpty();
        assertThat(serviceAt(NOW, "otro-emisor", 15).verify(token)).isEmpty();
    }

    @Test
    void rechaza_tipo_o_claims_obligatorios_ausentes() {
        var key = Keys.hmacShaKeyFor(SECRET.getBytes(StandardCharsets.UTF_8));
        String wrongType = Jwts.builder()
                .subject(USER_ID.toString())
                .issuer("mapit")
                .issuedAt(Date.from(NOW))
                .expiration(Date.from(NOW.plusSeconds(900)))
                .id(UUID.randomUUID().toString())
                .claim("tenant", "tenant-a")
                .claim("role", "MANAGER")
                .claim("email", "staff@example.test")
                .claim("typ", "refresh")
                .signWith(key, Jwts.SIG.HS256)
                .compact();
        String missingTenant = Jwts.builder()
                .subject(USER_ID.toString())
                .issuer("mapit")
                .issuedAt(Date.from(NOW))
                .expiration(Date.from(NOW.plusSeconds(900)))
                .id(UUID.randomUUID().toString())
                .claim("role", "MANAGER")
                .claim("email", "staff@example.test")
                .claim("typ", "access")
                .signWith(key, Jwts.SIG.HS256)
                .compact();

        var verifier = serviceAt(NOW, "mapit", 15);
        assertThat(verifier.verify(wrongType)).isEmpty();
        assertThat(verifier.verify(missingTenant)).isEmpty();
        assertThat(verifier.verify("")).isEmpty();
        assertThat(verifier.verify("no-es-un-jwt")).isEmpty();
    }

    @Test
    void valida_la_configuracion_y_no_expone_el_token_en_to_string() {
        assertThatThrownBy(() -> new JjwtTokenService("corta", "mapit", 15, clockAt(NOW)))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> new JjwtTokenService(SECRET, "mapit", 0, clockAt(NOW)))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> new JjwtTokenService(SECRET, " ", 15, clockAt(NOW)))
                .isInstanceOf(IllegalArgumentException.class);

        var token = serviceAt(NOW, "mapit", 15).issue(USER);
        assertThat(token.toString()).doesNotContain(token.value()).contains("<redacted>");
    }

    private static JjwtTokenService serviceAt(Instant instant, String issuer, long minutes) {
        return new JjwtTokenService(SECRET, issuer, minutes, clockAt(instant));
    }

    private static Clock clockAt(Instant instant) {
        return Clock.fixed(instant, ZoneOffset.UTC);
    }
}
