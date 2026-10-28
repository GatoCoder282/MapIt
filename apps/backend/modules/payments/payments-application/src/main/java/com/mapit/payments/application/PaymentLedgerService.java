package com.mapit.payments.application;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import org.jspecify.annotations.Nullable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.mapit.payments.domain.Payment;
import com.mapit.payments.domain.PaymentLedgerRepository;
import com.mapit.payments.domain.PaymentProvider;
import com.mapit.shared.security.ActorContext;
import com.mapit.shared.security.EstablishmentAuthorizationPort;
import com.mapit.shared.tenant.TenantContext;

@Service
public class PaymentLedgerService {
  private final PaymentLedgerRepository repository;
  private final EstablishmentAuthorizationPort authorization;
  private final TenantContext tenants;
  private final ActorContext actors;
  public PaymentLedgerService(PaymentLedgerRepository repository, EstablishmentAuthorizationPort authorization,TenantContext tenants,ActorContext actors){
    this.repository=repository;this.authorization=authorization;this.tenants=tenants;this.actors=actors;
  }
  @Transactional(readOnly=true)
  public PaymentPage list(UUID establishmentId,Payment.@Nullable Status status,int limit,int offset){
    if(limit<1||limit>100||offset<0||offset>100000)throw new IllegalArgumentException("Paginación inválida");
    var tenant=tenants.require();
    if(!authorization.canManagePayments(tenant,actors.requireUserId(),establishmentId))throw new PaymentMethodService.NotFound();
    var page=repository.list(tenant,establishmentId,status,limit,offset);
    return new PaymentPage(page.items().stream().map(ManagedPayment::from).toList(),page.total(),limit,offset);
  }
  public record PaymentPage(List<ManagedPayment> items,long total,int limit,int offset){}
  public record ManagedPayment(UUID id,UUID reservationId,UUID establishmentId,String establishmentName,
      UUID methodId,String methodName,PaymentProvider provider,Payment.Status status,String amount,String currency,
      Instant createdAt,Instant expiresAt,@Nullable Instant verifiedAt,@Nullable String verificationSource,String externalReference){
    static ManagedPayment from(PaymentLedgerRepository.Entry entry){
      Payment p=entry.payment();
      return new ManagedPayment(p.id(),p.reservationId(),p.establishmentId(),entry.establishmentName(),p.methodId(),entry.methodName(),p.provider(),p.status(),
          p.money().amount().toPlainString(),p.money().currency(),p.createdAt(),p.expiresAt(),p.verifiedAt(),p.verificationSource(),p.externalReference());
    }
  }
}
