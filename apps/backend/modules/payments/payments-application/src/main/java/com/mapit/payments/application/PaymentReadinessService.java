package com.mapit.payments.application;

import static com.mapit.payments.application.PaymentReadinessView.Blocker.*;

import java.util.ArrayList;
import java.util.UUID;

import org.springframework.transaction.annotation.Transactional;

import com.mapit.payments.domain.*;
import com.mapit.shared.tenant.TenantContext;

public class PaymentReadinessService {
  private final PaymentConfigurationRepository configuration;
  private final MockQrConfigurationRepository qr;
  private final PaymentMethodRepository methods;
  private final PaymentGatewayPort gateway;
  private final TenantContext tenants;
  public PaymentReadinessService(PaymentConfigurationRepository configuration, MockQrConfigurationRepository qr,
      PaymentMethodRepository methods, PaymentGatewayPort gateway, TenantContext tenants) {
    this.configuration=configuration; this.qr=qr; this.methods=methods; this.gateway=gateway; this.tenants=tenants;
  }
  @Transactional(readOnly=true)
  public PaymentReadinessView read(UUID establishmentId) {
    var tenant=tenants.require();
    if (!methods.establishmentExists(tenant,establishmentId)) throw new PaymentMethodService.NotFound();
    var policy=configuration.policy(tenant,establishmentId).orElse(null);
    var config=qr.findByEstablishment(tenant,establishmentId).orElse(null);
    boolean runtime=gateway.capabilities().webhooks();
    var blockers=new ArrayList<PaymentReadinessView.Blocker>();
    if(policy==null) blockers.add(POLICY_MISSING); else if(!policy.enabled()) blockers.add(POLICY_DISABLED);
    if(config==null) blockers.add(QR_MISSING); else if(!config.enabled()) blockers.add(QR_DISABLED);
    if(!runtime) blockers.add(MOCK_RUNTIME_DISABLED);
    if(config!=null) {
      var method=methods.projection(tenant,config.id()).orElseGet(() -> methods.list(tenant).stream()
          .filter(m -> config.id().equals(m.mockQrConfigurationId())).findFirst().orElse(null));
      if(method==null) {
        if(policy!=null && policy.enabled() && config.enabled() && runtime) blockers.add(METHOD_MISSING);
      } else {
        if(!method.enabled()) blockers.add(METHOD_DISABLED);
        if(method.supersededAt()!=null) blockers.add(METHOD_SUPERSEDED);
        if(policy!=null && !method.currency().equals(policy.deposit().currency())) blockers.add(METHOD_CURRENCY_MISMATCH);
        if(!tenant.equals(method.tenantId()) || !establishmentId.equals(method.establishmentId())
            || method.provider()!=PaymentProvider.MOCK_GATEWAY) blockers.add(METHOD_SCOPE_MISMATCH);
      }
    }
    return new PaymentReadinessView(establishmentId,config!=null && config.enabled(),policy,blockers.isEmpty(),java.util.List.copyOf(blockers));
  }
}
