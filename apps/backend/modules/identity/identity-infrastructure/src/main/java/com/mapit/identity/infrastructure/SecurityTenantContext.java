package com.mapit.identity.infrastructure;

import java.util.Optional;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Primary;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;

import com.mapit.identity.domain.AuthenticatedPrincipal;
import com.mapit.shared.tenant.TenantContext;
import com.mapit.shared.tenant.TenantId;

/** Resuelve el tenant autenticado y conserva el fallback temporal del CRUD público demo. */
@Component
@Primary
public class SecurityTenantContext implements TenantContext {
    private final TenantId demoTenant;

    public SecurityTenantContext(@Value("${mapit.tenant.default:demo}") String demoTenant) {
        this.demoTenant = TenantId.of(demoTenant);
    }

    @Override
    public Optional<TenantId> current() {
        var authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication != null && authentication.isAuthenticated()
                && authentication.getPrincipal() instanceof AuthenticatedPrincipal principal) {
            return Optional.of(principal.tenantId());
        }
        return Optional.of(demoTenant);
    }
}
