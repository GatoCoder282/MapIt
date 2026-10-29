package com.mapit.spaces.domain.establishment;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.jspecify.annotations.Nullable;

import com.mapit.shared.tenant.TenantId;

public interface EstablishmentAccessRepository {
  record AccessibleEstablishment(UUID id, String name, String slug, @Nullable String address,
      String timezone, boolean canManagePayments, boolean canCheckIn) {}
  record StaffAccess(UUID userId, String fullName, String email, boolean canCheckIn) {}
  List<AccessibleEstablishment> accessible(TenantId tenant, UUID actor);
  List<StaffAccess> staff(TenantId tenant, UUID establishment);
  Optional<StaffAccess> activeStaff(TenantId tenant, UUID userId);
  void save(TenantId tenant, UUID establishment, UUID userId, boolean canCheckIn, UUID actor, Instant now);
}
