package com.mapit.platform.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Instant;
import java.util.UUID;

import org.junit.jupiter.api.Test;

import com.mapit.shared.tenant.TenantId;

class BusinessApplicationTest {

  private static final Instant NOW = Instant.parse("2026-11-20T12:00:00Z");
  private static final UUID ACTOR = UUID.fromString("91000000-0000-0000-0000-000000000001");

  @Test
  void la_solicitud_inicia_pendiente_en_platform_y_normaliza_el_contacto() {
    BusinessApplication application = pending();

    assertThat(application.tenantId()).isEqualTo(BusinessApplication.PLATFORM);
    assertThat(application.status()).isEqualTo(BusinessApplicationStatus.PENDING);
    assertThat(application.businessName()).isEqualTo("Hotel Norte");
    assertThat(application.contactEmail()).isEqualTo("ana@example.com");
    assertThat(application.approvedTenantId()).isNull();
    assertThat(application.decidedBy()).isNull();
  }

  @Test
  void exige_verificacion_antes_de_aprobar_y_la_aprobacion_es_idempotente() {
    BusinessApplication application = pending();
    TenantId newTenant = TenantId.of("hotel-norte");

    assertThatThrownBy(() -> application.approve(ACTOR, newTenant, NOW.plusSeconds(60)))
        .isInstanceOf(IllegalStateException.class);

    BusinessApplication verified = application.verifyContact(NOW.plusSeconds(30));
    BusinessApplication approved = verified.approve(ACTOR, newTenant, NOW.plusSeconds(60));

    assertThat(approved.status()).isEqualTo(BusinessApplicationStatus.APPROVED);
    assertThat(approved.approvedTenantId()).isEqualTo(newTenant);
    assertThat(approved.approve(ACTOR, newTenant, NOW.plusSeconds(90))).isSameAs(approved);
    assertThatThrownBy(() -> approved.approve(ACTOR, TenantId.of("otro-hotel"), NOW.plusSeconds(90)))
        .isInstanceOf(IllegalStateException.class);
    assertThatThrownBy(() -> approved.reject(ACTOR, "Duplicada", NOW.plusSeconds(90)))
        .isInstanceOf(IllegalStateException.class);
  }

  @Test
  void el_rechazo_guarda_actor_y_motivo_y_no_concede_tenant() {
    BusinessApplication rejected = pending().reject(ACTOR, "  Datos incompletos  ", NOW.plusSeconds(10));

    assertThat(rejected.status()).isEqualTo(BusinessApplicationStatus.REJECTED);
    assertThat(rejected.decidedBy()).isEqualTo(ACTOR);
    assertThat(rejected.rejectionReason()).isEqualTo("Datos incompletos");
    assertThat(rejected.approvedTenantId()).isNull();
    assertThatThrownBy(() -> rejected.verifyContact(NOW.plusSeconds(30)))
        .isInstanceOf(IllegalStateException.class);
  }

  @Test
  void no_admite_estado_incoherente_ni_tenant_de_negocio_en_una_solicitud() {
    BusinessApplication application = pending();
    assertThatThrownBy(() -> new BusinessApplication(
        application.id(), TenantId.of("otro-tenant"), application.businessName(),
        application.vertical(), application.location(), application.contactName(),
        application.contactEmail(), null, BusinessApplicationStatus.PENDING,
        null, null, null, null, null, NOW, NOW))
        .isInstanceOf(IllegalArgumentException.class);
    assertThatThrownBy(() -> new BusinessApplication(
        application.id(), BusinessApplication.PLATFORM, application.businessName(),
        application.vertical(), application.location(), application.contactName(),
        application.contactEmail(), null, BusinessApplicationStatus.APPROVED,
        null, ACTOR, NOW, null, TenantId.of("hotel-norte"), NOW, NOW))
        .isInstanceOf(IllegalArgumentException.class);
  }

  private static BusinessApplication pending() {
    return BusinessApplication.pending(
        UUID.fromString("91000000-0000-0000-0000-000000000010"),
        "  Hotel Norte  ", BusinessVertical.HOTEL, "Cochabamba", "Ana Pérez",
        "  ANA@EXAMPLE.COM  ", null, NOW);
  }
}
