package com.mapit.spaces.application.establishment;

import static org.assertj.core.api.Assertions.*;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.junit.jupiter.api.Test;

import com.mapit.shared.security.EstablishmentAuthorizationPort;
import com.mapit.shared.tenant.TenantId;
import com.mapit.spaces.domain.establishment.EstablishmentAccessRepository;
import com.mapit.spaces.domain.establishment.EstablishmentAccessRepository.StaffAccess;

class EstablishmentAccessServiceTest {
  private final TenantId tenant=TenantId.of("access-tenant");
  private final UUID actor=UUID.randomUUID(),venue=UUID.randomUUID(),staff=UUID.randomUUID();
  private final Instant now=Instant.parse("2026-10-25T12:00:00Z");
  private boolean allowed,active;
  private int reads,saves;
  private boolean savedPermission;
  private final EstablishmentAccessRepository repository=new EstablishmentAccessRepository(){
    public List<AccessibleEstablishment> accessible(TenantId t,UUID a){reads++;assertThat(t).isEqualTo(tenant);assertThat(a).isEqualTo(actor);return List.of();}
    public List<StaffAccess> staff(TenantId t,UUID v){reads++;return List.of();}
    public Optional<StaffAccess> activeStaff(TenantId t,UUID u){reads++;assertThat(t).isEqualTo(tenant);assertThat(u).isEqualTo(staff);return active?Optional.of(new StaffAccess(staff,"Operador","operator@example.test",false)):Optional.empty();}
    public void save(TenantId t,UUID v,UUID u,boolean permission,UUID a,Instant time){saves++;savedPermission=permission;assertThat(t).isEqualTo(tenant);assertThat(v).isEqualTo(venue);assertThat(u).isEqualTo(staff);assertThat(a).isEqualTo(actor);assertThat(time).isEqualTo(now);}
  };
  private final EstablishmentAuthorizationPort access=new EstablishmentAuthorizationPort(){
    public boolean canManagePayments(TenantId t,UUID a,UUID v){return allowed&&t.equals(tenant)&&a.equals(actor)&&v.equals(venue);}
    public boolean canCheckIn(TenantId t,UUID a,UUID v){return false;}
    public boolean canReadOperations(TenantId t,UUID a,UUID v){return false;}
  };
  private final EstablishmentAccessService service=new EstablishmentAccessService(repository,access,()->Optional.of(tenant),()->Optional.of(actor),Clock.fixed(now,ZoneOffset.UTC));
  @Test void neverGrantsAcrossVenueOrTenantAuthorization(){
    assertThatThrownBy(()->service.grant(venue,staff,true)).isInstanceOf(EstablishmentAccessService.NotFound.class);
    assertThat(reads).isZero();assertThat(saves).isZero();
  }
  @Test void validatesActiveStaffAndRecordsRevocationActorAndTime(){
    allowed=true;
    assertThatThrownBy(()->service.grant(venue,staff,true)).isInstanceOf(EstablishmentAccessService.NotFound.class);
    active=true;
    assertThat(service.grant(venue,staff,true).canCheckIn()).isTrue();
    assertThat(service.grant(venue,staff,false).canCheckIn()).isFalse();
    assertThat(saves).isEqualTo(2);assertThat(savedPermission).isFalse();
  }
  @Test void accessibleListIsScopedToCurrentActorNotBrowserTenant(){
    assertThat(service.accessible()).isEmpty();assertThat(reads).isEqualTo(1);
  }
}
