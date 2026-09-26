package com.mapit.identity.infrastructure;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import java.util.UUID;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;

import com.mapit.identity.domain.AuthenticatedPrincipal;
import com.mapit.identity.domain.UserRole;
import com.mapit.shared.tenant.TenantId;

class SecurityActorContextTest {

  @AfterEach
  void clearContext() {
    SecurityContextHolder.clearContext();
  }

  @Test
  void obtiene_el_actor_del_principal_autenticado_por_jwt() {
    UUID userId = UUID.randomUUID();
    AuthenticatedPrincipal principal =
        new AuthenticatedPrincipal(
            userId, TenantId.of("tenant-a"), "staff@tenant.test", UserRole.STAFF);
    var authentication =
        new UsernamePasswordAuthenticationToken(principal, null, List.of());
    SecurityContextHolder.getContext().setAuthentication(authentication);

    assertThat(new SecurityActorContext().currentUserId()).contains(userId);
  }

  @Test
  void no_inventa_actor_fuera_de_una_sesion_autenticada() {
    assertThat(new SecurityActorContext().currentUserId()).isEmpty();
  }
}
