package com.mapit.payments.application;

import static org.assertj.core.api.Assertions.*;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.junit.jupiter.api.Test;

import com.mapit.payments.domain.Payment;
import com.mapit.payments.domain.PaymentLedgerRepository;
import com.mapit.shared.security.EstablishmentAuthorizationPort;
import com.mapit.shared.tenant.TenantId;

class PaymentLedgerServiceTest {
  private final TenantId tenant=TenantId.of("ledger-tenant");
  private final UUID actor=UUID.randomUUID(),venue=UUID.randomUUID();
  private int reads;
  private boolean allowed;
  private final PaymentLedgerRepository repository=(t,v,status,limit,offset)-> {
    reads++;
    assertThat(t).isEqualTo(tenant); assertThat(v).isEqualTo(venue);
    assertThat(status).isEqualTo(Payment.Status.EXPIRED);
    assertThat(limit).isEqualTo(25); assertThat(offset).isEqualTo(50);
    return new PaymentLedgerRepository.Page(List.of(),61);
  };
  private final EstablishmentAuthorizationPort access=new EstablishmentAuthorizationPort(){
    public boolean canManagePayments(TenantId t,UUID a,UUID v){return allowed&&t.equals(tenant)&&a.equals(actor)&&v.equals(venue);}
    public boolean canCheckIn(TenantId t,UUID a,UUID v){return false;}
    public boolean canReadOperations(TenantId t,UUID a,UUID v){return false;}
  };
  private final PaymentLedgerService service=new PaymentLedgerService(repository,access,()->Optional.of(tenant),()->Optional.of(actor));
  @Test void deniesForeignOrUnauthorizedVenueBeforeReadingPayments(){
    assertThatThrownBy(()->service.list(venue,null,25,0)).isInstanceOf(PaymentMethodService.NotFound.class);
    assertThat(reads).isZero();
  }
  @Test void appliesVenueStatusAndBoundedPagination(){
    allowed=true;
    var page=service.list(venue,Payment.Status.EXPIRED,25,50);
    assertThat(page.total()).isEqualTo(61);assertThat(page.offset()).isEqualTo(50);assertThat(page.items()).isEmpty();
    assertThat(reads).isEqualTo(1);
    for(int limit:new int[]{0,101})assertThatThrownBy(()->service.list(venue,null,limit,0)).isInstanceOf(IllegalArgumentException.class);
    assertThatThrownBy(()->service.list(venue,null,25,-1)).isInstanceOf(IllegalArgumentException.class);
  }
}
