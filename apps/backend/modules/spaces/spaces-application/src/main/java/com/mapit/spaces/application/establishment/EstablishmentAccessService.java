package com.mapit.spaces.application.establishment;

import java.time.Clock;
import java.util.List;
import java.util.UUID;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.mapit.shared.security.ActorContext;
import com.mapit.shared.security.EstablishmentAuthorizationPort;
import com.mapit.shared.tenant.TenantContext;
import com.mapit.shared.tenant.TenantId;
import com.mapit.spaces.domain.establishment.EstablishmentAccessRepository;
import com.mapit.spaces.domain.establishment.EstablishmentAccessRepository.AccessibleEstablishment;
import com.mapit.spaces.domain.establishment.EstablishmentAccessRepository.StaffAccess;

@Service
public class EstablishmentAccessService {
  private final EstablishmentAccessRepository repository;
  private final EstablishmentAuthorizationPort authorization;
  private final TenantContext tenants;
  private final ActorContext actors;
  private final Clock clock;
  public EstablishmentAccessService(EstablishmentAccessRepository repository, EstablishmentAuthorizationPort authorization,
      TenantContext tenants, ActorContext actors, Clock clock) {
    this.repository=repository; this.authorization=authorization; this.tenants=tenants; this.actors=actors; this.clock=clock;
  }
  @Transactional(readOnly=true)
  public List<AccessibleEstablishment> accessible() { return repository.accessible(tenants.require(),actors.requireUserId()); }
  @Transactional(readOnly=true)
  public List<StaffAccess> staff(UUID establishmentId) {
    requireAdministrator(tenants.require(),establishmentId);
    return repository.staff(tenants.require(),establishmentId);
  }
  @Transactional
  public StaffAccess grant(UUID establishmentId,UUID userId,boolean canCheckIn) {
    TenantId tenant=tenants.require();
    requireAdministrator(tenant,establishmentId);
    StaffAccess user=repository.activeStaff(tenant,userId).orElseThrow(NotFound::new);
    repository.save(tenant,establishmentId,userId,canCheckIn,actors.requireUserId(),clock.instant());
    return new StaffAccess(user.userId(),user.fullName(),user.email(),canCheckIn);
  }
  private void requireAdministrator(TenantId tenant,UUID establishmentId) {
    if(!authorization.canManagePayments(tenant,actors.requireUserId(),establishmentId)) throw new NotFound();
  }
  public static class NotFound extends RuntimeException { public NotFound(){super("Establecimiento o personal no disponible");} }
}
