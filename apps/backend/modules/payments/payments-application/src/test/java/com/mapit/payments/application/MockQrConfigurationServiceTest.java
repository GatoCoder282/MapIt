package com.mapit.payments.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import com.mapit.payments.domain.MerchantPaymentMethod;
import com.mapit.payments.domain.MockQrConfiguration;
import com.mapit.payments.domain.MockQrConfigurationRepository;
import com.mapit.payments.domain.Money;
import com.mapit.payments.domain.PaymentConfigurationRepository;
import com.mapit.payments.domain.PaymentMethodRepository;
import com.mapit.payments.domain.PaymentPolicy;
import com.mapit.payments.domain.PaymentProvider;
import com.mapit.payments.domain.ReservationPaymentQuote;
import com.mapit.shared.tenant.TenantId;

class MockQrConfigurationServiceTest {
  private static final Instant NOW = Instant.parse("2026-10-25T12:00:00Z");
  private final TenantId tenant = TenantId.of("tenant-a");
  private final TenantId foreignTenant = TenantId.of("tenant-b");
  private final UUID actor = UUID.randomUUID();
  private final UUID establishment = UUID.randomUUID();
  private final Clock clock = Clock.fixed(NOW, ZoneOffset.UTC);
  private final FakeRepository repository = new FakeRepository();
  private final FakePaymentConfiguration paymentConfiguration = new FakePaymentConfiguration();
  private final FakeMethods methods = new FakeMethods();
  private final List<String> lockOrder = new ArrayList<>();
  private MockQrConfigurationService service;

  @BeforeEach
  void setUp() {
    repository.establishments.put(tenant, Set.of(establishment));
    service = new MockQrConfigurationService(repository, paymentConfiguration, methods, () -> Optional.of(tenant),
        () -> Optional.of(actor), clock, true);
  }

  @Test
  void createsPersistsAndListsOnlyTheCurrentTenant() {
    MockQrConfiguration created = service.create(draft(establishment, "BO", "Banco Unión", true));

    assertThat(created.tenantId()).isEqualTo(tenant);
    assertThat(created.createdBy()).isEqualTo(actor);
    assertThat(created.updatedBy()).isEqualTo(actor);
    assertThat(created.createdAt()).isEqualTo(NOW);
    assertThat(created.simulationPath()).isEqualTo("/simulacion/qr/" + created.simulationToken());
    assertThat(service.list()).containsExactly(created);

    MockQrConfigurationService foreign = new MockQrConfigurationService(repository, paymentConfiguration, methods,
        () -> Optional.of(foreignTenant), () -> Optional.of(actor), clock, true);
    assertThat(foreign.list()).isEmpty();
    assertThatThrownBy(() -> foreign.get(created.id()))
        .isInstanceOf(MockQrConfigurationService.NotFound.class);
  }

  @Test
  void rejectsInvalidFieldsAndForeignEstablishmentBeforeWriting() {
    assertThatThrownBy(() -> service.create(draft(establishment, "ZZ", "Banco", true)))
        .isInstanceOf(IllegalArgumentException.class);
    assertThatThrownBy(() -> service.create(draft(establishment, "BO", "  ", true)))
        .isInstanceOf(IllegalArgumentException.class);
    assertThatThrownBy(() -> service.create(draft(UUID.randomUUID(), "BO", "Banco", true)))
        .isInstanceOf(MockQrConfigurationService.NotFound.class);
    assertThat(repository.rows).isEmpty();
  }

  @Test
  void allowsOneConfigurationPerEstablishmentEvenAfterEditing() {
    service.create(draft(establishment, "BO", "Banco", true));
    assertThatThrownBy(() -> service.create(draft(establishment, "BO", "Otro banco", false)))
        .isInstanceOf(MockQrConfigurationRepository.Duplicate.class);
  }

  @Test
  void updateKeepsTokenAndCreationDataAndCanDisableTheConfiguration() {
    MockQrConfiguration created = service.create(draft(establishment, "BO", "Banco", true));

    MockQrConfiguration updated = service.update(created.id(),
        draft(establishment, "PE", "Banco de prueba", false));

    assertThat(updated.id()).isEqualTo(created.id());
    assertThat(updated.simulationToken()).isEqualTo(created.simulationToken());
    assertThat(updated.createdAt()).isEqualTo(created.createdAt());
    assertThat(updated.createdBy()).isEqualTo(actor);
    assertThat(updated.country()).isEqualTo("PE");
    assertThat(updated.bankName()).isEqualTo("Banco de prueba");
    assertThat(updated.enabled()).isFalse();
    assertThat(service.list()).containsExactly(updated);
  }

  @Test
  void update_toma_primero_el_lock_del_establecimiento_y_despues_el_de_configuracion() {
    MockQrConfiguration created = service.create(draft(establishment, "BO", "Banco", true));
    lockOrder.clear();

    service.update(created.id(), draft(establishment, "BO", "Banco actualizado", true));

    assertThat(lockOrder).containsExactly("establishment", "configuration");
  }

  @Test
  void regenerateRotatesOnlyTheSimulationToken() {
    MockQrConfiguration created = service.create(draft(establishment, "BO", "Banco", true));

    MockQrConfiguration regenerated = service.regenerate(created.id());

    assertThat(regenerated.simulationToken()).isNotEqualTo(created.simulationToken());
    assertThat(regenerated.establishmentId()).isEqualTo(created.establishmentId());
    assertThat(regenerated.country()).isEqualTo(created.country());
    assertThat(regenerated.bankName()).isEqualTo(created.bankName());
    assertThat(regenerated.accountHolderName()).isEqualTo(created.accountHolderName());
    assertThat(regenerated.accountReference()).isEqualTo(created.accountReference());
    assertThat(regenerated.updatedAt()).isEqualTo(NOW);
  }

  @Test
  void sincroniza_configuracion_y_policy_y_conserva_proyeccion_con_pagos() {
    paymentConfiguration.savePolicy(new PaymentPolicy(UUID.randomUUID(), tenant, establishment, false,
        new Money(java.math.BigDecimal.TEN, "USD"), null, 30, NOW, actor));
    MockQrConfiguration created = service.create(draft(establishment, "BO", "Banco", true));

    MerchantPaymentMethod original = methods.projection(tenant, created.id()).orElseThrow();
    assertThat(original.provider()).isEqualTo(PaymentProvider.MOCK_GATEWAY);
    assertThat(original.establishmentId()).isEqualTo(establishment);
    assertThat(original.currency()).isEqualTo("USD");
    assertThat(original.enabled()).isTrue();
    assertThat(paymentConfiguration.policy(tenant, establishment).orElseThrow().enabled()).isFalse();

    methods.paid.add(original.id());
    service.update(created.id(), draft(establishment, "BO", "Banco cambiado", true));
    MerchantPaymentMethod current = methods.projection(tenant, created.id()).orElseThrow();

    assertThat(current.id()).isNotEqualTo(original.id());
    assertThat(current.bankName()).isEqualTo("Banco cambiado");
    assertThat(methods.find(tenant, original.id()).orElseThrow().supersededAt()).isEqualTo(NOW);
  }

  @Test
  void policy_currency_sincroniza_sin_materializar_si_falta_configuracion() {
    PaymentPolicyService policies = new PaymentPolicyService(paymentConfiguration, methods, service,
        () -> Optional.of(tenant), () -> Optional.of(actor), clock);
    policies.save(establishment, true, "USD", java.math.BigDecimal.TEN, null, 30);
    assertThat(methods.values).isEmpty();

    MockQrConfiguration created = service.create(draft(establishment, "BO", "Banco", true));
    MerchantPaymentMethod original = methods.projection(tenant, created.id()).orElseThrow();
    methods.paid.add(original.id());
    policies.save(establishment, false, "BOB", java.math.BigDecimal.ONE, null, 15);

    MerchantPaymentMethod current = methods.projection(tenant, created.id()).orElseThrow();
    assertThat(current.currency()).isEqualTo("BOB");
    assertThat(current.id()).isNotEqualTo(original.id());
    assertThat(paymentConfiguration.policy(tenant, establishment).orElseThrow().enabled()).isFalse();
  }

  @Test
  void policy_se_guarda_aunque_el_gate_mock_este_desactivado_y_no_crea_proyeccion() {
    service.create(draft(establishment, "BO", "Banco", true));
    MockQrConfigurationService disabled = new MockQrConfigurationService(repository, paymentConfiguration, methods,
        () -> Optional.of(tenant), () -> Optional.of(actor), clock, false);
    PaymentPolicyService policies = new PaymentPolicyService(paymentConfiguration, methods, disabled,
        () -> Optional.of(tenant), () -> Optional.of(actor), clock);

    PaymentPolicy saved = policies.save(establishment, true, "USD", java.math.BigDecimal.TEN, null, 30);

    assertThat(saved.enabled()).isTrue();
    assertThat(paymentConfiguration.policy(tenant, establishment)).contains(saved);
    assertThat(methods.values).isEmpty();
  }

  @Test
  void disabledEnvironmentRejectsEveryOperation() {
    MockQrConfigurationService disabled = new MockQrConfigurationService(repository, paymentConfiguration, methods,
        () -> Optional.of(tenant), () -> Optional.of(actor), clock, false);

    assertThatThrownBy(disabled::list).isInstanceOf(MockQrConfigurationService.Disabled.class);
    assertThatThrownBy(disabled::countries).isInstanceOf(MockQrConfigurationService.Disabled.class);
    assertThatThrownBy(() -> disabled.get(establishment))
        .isInstanceOf(MockQrConfigurationService.Disabled.class);
    assertThatThrownBy(() -> disabled.create(draft(establishment, "BO", "Banco", true)))
        .isInstanceOf(MockQrConfigurationService.Disabled.class);
  }

  @Test
  void countriesComeFromIsoCatalogAndAreSortedInSpanish() {
    List<MockQrConfigurationService.Country> countries = service.countries();

    assertThat(countries).hasSize(249);
    assertThat(countries).allSatisfy(country -> {
      assertThat(country.code()).hasSize(2).isUpperCase();
      assertThat(country.name()).isNotBlank();
    });
    assertThat(countries).anySatisfy(country -> {
      assertThat(country.code()).isEqualTo("BO");
      assertThat(country.name()).contains("Bolivia");
    });
    assertThat(countries).isSortedAccordingTo(
        Comparator.comparing(MockQrConfigurationService.Country::name));
  }

  @Test
  void withoutTenantContextEveryOperationFailsClosed() {
    MockQrConfigurationService anonymous = new MockQrConfigurationService(repository, paymentConfiguration, methods,
        Optional::empty, () -> Optional.of(actor), clock, true);

    assertThatThrownBy(anonymous::list).isInstanceOf(IllegalStateException.class);
    assertThatThrownBy(() -> anonymous.create(draft(establishment, "BO", "Banco", true)))
        .isInstanceOf(IllegalStateException.class);
    assertThat(repository.rows).isEmpty();
  }

  private static MockQrConfigurationService.Draft draft(UUID establishment, String country,
      String bank, boolean enabled) {
    return new MockQrConfigurationService.Draft(establishment, country, bank, "Titular de prueba",
        "cuenta-123", enabled);
  }

  private final class FakeRepository implements MockQrConfigurationRepository {
    private final Map<UUID, MockQrConfiguration> rows = new LinkedHashMap<>();
    private final Map<TenantId, Set<UUID>> establishments = new java.util.HashMap<>();

    @Override
    public List<MockQrConfiguration> list(TenantId tenant) {
      return rows.values().stream().filter(row -> row.tenantId().equals(tenant)).toList();
    }

    @Override
    public Optional<MockQrConfiguration> find(TenantId tenant, UUID id) {
      return Optional.ofNullable(rows.get(id)).filter(row -> row.tenantId().equals(tenant));
    }

    @Override
    public Optional<MockQrConfiguration> findByEstablishment(TenantId tenant, UUID establishmentId) {
      return rows.values().stream().filter(row -> row.tenantId().equals(tenant)
          && row.establishmentId().equals(establishmentId)).findFirst();
    }

    @Override
    public Optional<MockQrConfiguration> lock(TenantId tenant, UUID id) {
      lockOrder.add("configuration");
      return find(tenant, id);
    }

    @Override
    public boolean establishmentExists(TenantId tenant, UUID establishmentId) {
      return establishments.getOrDefault(tenant, Set.of()).contains(establishmentId);
    }

    @Override
    public boolean insert(MockQrConfiguration configuration) {
      if (duplicate(configuration)) {
        return false;
      }
      rows.put(configuration.id(), configuration);
      return true;
    }

    @Override
    public boolean update(MockQrConfiguration configuration) {
      MockQrConfiguration current = rows.get(configuration.id());
      if (current == null || !current.tenantId().equals(configuration.tenantId())) {
        return false;
      }
      if (duplicate(configuration)) {
        throw new Duplicate();
      }
      rows.put(configuration.id(), configuration);
      return true;
    }

    private boolean duplicate(MockQrConfiguration configuration) {
      return rows.values().stream().anyMatch(row -> row.tenantId().equals(configuration.tenantId())
          && row.establishmentId().equals(configuration.establishmentId())
          && !row.id().equals(configuration.id()));
    }
  }

  private final class FakePaymentConfiguration implements PaymentConfigurationRepository {
    private final Map<UUID, PaymentPolicy> policies = new LinkedHashMap<>();
    @Override public boolean lockEstablishment(TenantId tenant, UUID id) {
      lockOrder.add("establishment");
      return repository.establishmentExists(tenant, id);
    }
    @Override public Optional<PaymentPolicy> policy(TenantId tenant, UUID id) {
      return Optional.ofNullable(policies.get(id)).filter(policy -> policy.tenantId().equals(tenant));
    }
    @Override public PaymentPolicy savePolicy(PaymentPolicy policy) {
      policies.put(policy.establishmentId(), policy);
      return policy;
    }
    @Override public Optional<ReservationPaymentQuote> quote(TenantId tenant, UUID reservationId) { return Optional.empty(); }
    @Override public ReservationPaymentQuote insertQuote(ReservationPaymentQuote quote) { return quote; }
  }

  private final class FakeMethods implements PaymentMethodRepository {
    private final Map<UUID, MerchantPaymentMethod> values = new LinkedHashMap<>();
    private final Set<UUID> paid = new java.util.HashSet<>();
    @Override public List<MerchantPaymentMethod> list(TenantId tenant) {
      return values.values().stream().filter(method -> method.tenantId().equals(tenant)).toList();
    }
    @Override public Optional<MerchantPaymentMethod> find(TenantId tenant, UUID id) {
      return Optional.ofNullable(values.get(id)).filter(method -> method.tenantId().equals(tenant));
    }
    @Override public Optional<MerchantPaymentMethod> projection(TenantId tenant, UUID configId) {
      return list(tenant).stream().filter(method -> configId.equals(method.mockQrConfigurationId())
          && method.supersededAt() == null).findFirst();
    }
    @Override public Optional<MerchantPaymentMethod> lock(TenantId tenant, UUID id) { return find(tenant, id); }
    @Override public boolean hasPayments(TenantId tenant, UUID id) { return paid.contains(id); }
    @Override public void supersede(TenantId tenant, UUID id, Instant at, UUID actorId) {
      MerchantPaymentMethod old = find(tenant, id).orElseThrow();
      values.put(id, copy(old, old.enabled(), old.currency(), old.bankName(), at));
    }
    @Override public boolean establishmentExists(TenantId tenant, UUID id) { return repository.establishmentExists(tenant, id); }
    @Override public MerchantPaymentMethod insert(MerchantPaymentMethod method) { values.put(method.id(), method); return method; }
    @Override public boolean update(MerchantPaymentMethod method) {
      if (find(method.tenantId(), method.id()).isEmpty()) return false;
      values.put(method.id(), method);
      return true;
    }
    private MerchantPaymentMethod copy(MerchantPaymentMethod method, boolean enabled, String currency,
        String bank, Instant superseded) {
      return new MerchantPaymentMethod(method.id(), method.tenantId(), method.establishmentId(), method.displayName(),
          method.country(), currency, method.provider(), bank, method.accountReference(), method.staticQrImage(), enabled,
          method.createdAt(), method.updatedAt(), method.createdBy(), method.updatedBy(), method.accountHolderName(),
          method.mockQrConfigurationId(), superseded);
    }
  }
}
