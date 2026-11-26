package com.mapit.platform.application;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import org.jspecify.annotations.Nullable;
import org.springframework.stereotype.Service;

import com.mapit.platform.domain.TenantStatus;
import com.mapit.platform.domain.observability.ApiHealthProbe;
import com.mapit.platform.domain.observability.GuardedCount;
import com.mapit.platform.domain.observability.PlatformAccessLog;
import com.mapit.platform.domain.observability.SmallCountSuppression;
import com.mapit.platform.domain.observability.TenantDirectory;
import com.mapit.platform.domain.observability.TenantMetricsReader;
import com.mapit.platform.domain.observability.TenantUsage;
import com.mapit.shared.flags.FeatureFlag;
import com.mapit.shared.flags.FeatureFlagPort;
import com.mapit.shared.security.ActorContext;
import com.mapit.shared.tenant.TenantId;

/**
 * Consultas de solo lectura del Super Admin (HU-7.08). La supresión se aplica aquí, de modo
 * que ningún adaptador de salida llega a ver un conteo que deba ocultarse.
 */
@Service
public class ObserveTenants {

  private static final List<String> STATUSES =
      List.of("CREATED", "CONFIRMED", "ACTIVE", "RELEASED", "CANCELLED");

  private final TenantDirectory directory;
  private final TenantMetricsReader metrics;
  private final ApiHealthProbe health;
  private final PlatformAccessLog accessLog;
  private final FeatureFlagPort flags;
  private final ActorContext actors;
  private final Clock clock;

  public ObserveTenants(
      TenantDirectory directory,
      TenantMetricsReader metrics,
      ApiHealthProbe health,
      PlatformAccessLog accessLog,
      FeatureFlagPort flags,
      ActorContext actors,
      Clock clock) {
    this.directory = directory;
    this.metrics = metrics;
    this.health = health;
    this.accessLog = accessLog;
    this.flags = flags;
    this.actors = actors;
    this.clock = clock;
  }

  public Overview overview(int days) {
    requireEnabled();
    Instant now = clock.instant();
    Instant since = since(now, days);
    long active = 0;
    long suspended = 0;
    long establishments = 0;
    long unreadable = 0;
    Map<String, Long> byStatus = zeros();
    Map<LocalDate, Long> byDay = emptyDays(now, days);
    for (TenantDirectory.Entry tenant : directory.all()) {
      if (tenant.status() == TenantStatus.ACTIVE) {
        active++;
      } else {
        suspended++;
      }
      Optional<TenantUsage> usage = usage(tenant, since);
      if (usage.isEmpty()) {
        unreadable++;
        continue;
      }
      establishments += usage.get().establishments();
      usage.get().reservationsByStatus().forEach((key, count) -> byStatus.merge(key, count, Long::sum));
      usage.get().reservationsByDay().forEach((day, count) -> byDay.computeIfPresent(day, (d, sum) -> sum + count));
    }
    var statuses = SmallCountSuppression.guard(byStatus);
    var daily = SmallCountSuppression.guard(byDay);
    record(PlatformAccessLog.View.OVERVIEW, null);
    return new Overview(
        now,
        days,
        SmallCountSuppression.THRESHOLD,
        health.databaseAvailable(),
        health.read().orElse(null),
        active,
        suspended,
        establishments,
        unreadable,
        statuses.total(),
        statuses.parts(),
        daily.parts());
  }

  public TenantPage tenants(int days, @Nullable String text, @Nullable TenantStatus status, int page, int size) {
    requireEnabled();
    Instant since = since(clock.instant(), days);
    TenantDirectory.Page found = directory.search(text, status, page, size);
    List<TenantRow> rows = new ArrayList<>();
    for (TenantDirectory.Entry tenant : found.content()) {
      Optional<TenantUsage> usage = usage(tenant, since);
      rows.add(
          usage
              .map(value -> row(tenant, value))
              .orElseGet(() -> new TenantRow(tenant, false, 0, null, null, List.of())));
    }
    record(PlatformAccessLog.View.TENANT_LIST, null);
    return new TenantPage(rows, page, size, found.totalElements());
  }

  /** Vacío si no existe una empresa de negocio con ese slug. */
  public Optional<TenantDetail> tenant(String slug, int days) {
    requireEnabled();
    Instant now = clock.instant();
    Optional<TenantDirectory.Entry> found = directory.findBySlug(slug);
    if (found.isEmpty()) {
      return Optional.empty();
    }
    TenantDirectory.Entry tenant = found.get();
    Optional<TenantUsage> usage = usage(tenant, since(now, days));
    record(PlatformAccessLog.View.TENANT_DETAIL, tenant.id());
    return Optional.of(
        usage
            .map(
                value -> {
                  var statuses = SmallCountSuppression.guard(complete(value.reservationsByStatus()));
                  return new TenantDetail(
                      now,
                      days,
                      row(tenant, value),
                      value.establishmentsByVertical(),
                      statuses.total(),
                      statuses.parts(),
                      value.pendingDeliveries(),
                      value.failingDeliveries(),
                      value.paymentMethodEnabled());
                })
            .orElseGet(
                () ->
                    new TenantDetail(
                        now, days, new TenantRow(tenant, false, 0, null, null, List.of()),
                        Map.of(), null, Map.of(), 0, 0, false)));
  }

  private TenantRow row(TenantDirectory.Entry tenant, TenantUsage usage) {
    List<Alert> alerts = new ArrayList<>();
    // Poca actividad comercial no es una alerta (spec: salud técnica ≠ actividad).
    if (usage.failingDeliveries() > 0) {
      alerts.add(Alert.DELIVERY_FAILURES);
    }
    if (tenant.status() == TenantStatus.ACTIVE && usage.establishments() == 0) {
      alerts.add(Alert.NO_ESTABLISHMENTS);
    }
    return new TenantRow(
        tenant,
        true,
        usage.establishments(),
        SmallCountSuppression.guard(complete(usage.reservationsByStatus())).total(),
        usage.lastActivity(),
        alerts);
  }

  /** Un fallo de lectura es «sin datos», nunca cero. */
  private Optional<TenantUsage> usage(TenantDirectory.Entry tenant, Instant since) {
    try {
      return Optional.of(metrics.read(TenantId.of(tenant.id()), since));
    } catch (RuntimeException failure) {
      return Optional.empty();
    }
  }

  private void requireEnabled() {
    if (!flags.isEnabled(FeatureFlag.MAPIT_S6_TENANT_OBSERVABILITY)) {
      throw new TenantObservabilityDisabled();
    }
  }

  private void record(PlatformAccessLog.View view, @Nullable String subject) {
    accessLog.record(actors.requireUserId(), view, subject);
  }

  private static Instant since(Instant now, int days) {
    if (days != 7 && days != 30) {
      throw new IllegalArgumentException("La ventana debe ser de 7 o 30 días");
    }
    return now.atZone(ZoneOffset.UTC).toLocalDate().minusDays(days - 1L).atStartOfDay(ZoneOffset.UTC).toInstant();
  }

  private static Map<String, Long> zeros() {
    Map<String, Long> counts = new LinkedHashMap<>();
    STATUSES.forEach(status -> counts.put(status, 0L));
    return counts;
  }

  private static Map<String, Long> complete(Map<String, Long> partial) {
    Map<String, Long> counts = zeros();
    counts.putAll(partial);
    return counts;
  }

  private static Map<LocalDate, Long> emptyDays(Instant now, int days) {
    LocalDate today = now.atZone(ZoneOffset.UTC).toLocalDate();
    Map<LocalDate, Long> counts = new LinkedHashMap<>();
    for (long back = days - 1L; back >= 0; back--) {
      counts.put(today.minus(back, ChronoUnit.DAYS), 0L);
    }
    return counts;
  }

  public enum Alert {
    DELIVERY_FAILURES,
    NO_ESTABLISHMENTS
  }

  public record Overview(
      Instant generatedAt,
      int windowDays,
      int suppressionThreshold,
      boolean databaseAvailable,
      ApiHealthProbe.@Nullable ApiHealth api,
      long activeTenants,
      long suspendedTenants,
      long establishments,
      long unreadableTenants,
      GuardedCount reservations,
      Map<String, GuardedCount> reservationsByStatus,
      Map<LocalDate, GuardedCount> reservationsByDay) {}

  public record TenantRow(
      TenantDirectory.Entry tenant,
      boolean dataAvailable,
      long establishments,
      @Nullable GuardedCount reservations,
      @Nullable LocalDate lastActivity,
      List<Alert> alerts) {}

  public record TenantPage(List<TenantRow> content, int page, int size, long totalElements) {}

  public record TenantDetail(
      Instant generatedAt,
      int windowDays,
      TenantRow summary,
      Map<String, Long> establishmentsByVertical,
      @Nullable GuardedCount reservations,
      Map<String, GuardedCount> reservationsByStatus,
      long pendingDeliveries,
      long failingDeliveries,
      boolean paymentMethodEnabled) {}
}
