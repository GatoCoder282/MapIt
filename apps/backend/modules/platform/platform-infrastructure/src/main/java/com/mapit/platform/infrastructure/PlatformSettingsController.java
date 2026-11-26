package com.mapit.platform.infrastructure;

import java.net.URI;
import java.util.Arrays;
import java.util.List;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import org.jspecify.annotations.Nullable;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.env.Environment;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.mapit.platform.application.PlatformSettingConflict;
import com.mapit.platform.application.PlatformSettingsDisabled;
import com.mapit.platform.application.PlatformSettingsService;
import com.mapit.platform.application.UnknownPlatformSetting;
import com.mapit.platform.domain.PlatformServiceStatus;
import com.mapit.platform.domain.PlatformSettingChange;
import com.mapit.shared.flags.FeatureFlag;
import com.mapit.shared.flags.FeatureFlagPort;

/** Configuración global; SecurityConfig exige SUPER_ADMIN antes de este controlador. */
@RestController
@RequestMapping("/api/v1/platform/settings")
class PlatformSettingsController {

  private static final String PROBLEMS = "https://mapit.local/problems/";
  private static final List<String> READ_ONLY_PROPERTIES =
      List.of(
          "customer-history.window-minutes",
          "customer-history.person-limit",
          "customer-history.ip-limit");

  private final PlatformSettingsService settings;
  private final PlatformServiceStatus status;
  private final FeatureFlagPort flags;
  private final Environment environment;
  private final String environmentName;

  PlatformSettingsController(
      PlatformSettingsService settings,
      PlatformServiceStatus status,
      FeatureFlagPort flags,
      Environment environment,
      @Value("${APP_ENV:development}") String environmentName) {
    this.settings = settings;
    this.status = status;
    this.flags = flags;
    this.environment = environment;
    this.environmentName = environmentName;
  }

  @GetMapping
  Overview overview() {
    List<SettingResponse> values = settings.values().stream().map(SettingResponse::from).toList();
    return new Overview(
        environmentName,
        new Services(status.databaseAvailable(), status.flagProvider()),
        values,
        // Allowlist explícita: nunca se recorre el entorno completo.
        READ_ONLY_PROPERTIES.stream()
            .map(key -> new ReadOnlyValue(key, environment.getProperty("mapit." + key, "")))
            .toList(),
        Arrays.stream(FeatureFlag.values())
            .map(
                flag ->
                    new FlagResponse(
                        flag.clave(),
                        flag.tipo().name(),
                        flags.isEnabled(flag),
                        flag.valorPorDefecto()))
            .toList());
  }

  @PutMapping("/{key}")
  SettingResponse change(@PathVariable String key, @Valid @RequestBody ChangeRequest request) {
    return SettingResponse.from(
        settings.change(key, request.value(), request.expectedValue(), request.reason()));
  }

  @GetMapping("/changes")
  List<PlatformSettingChange> changes() {
    return settings.changes();
  }

  @ExceptionHandler(PlatformSettingsDisabled.class)
  ResponseEntity<ProblemDetail> disabled(PlatformSettingsDisabled failure) {
    return problem(HttpStatus.NOT_FOUND, "platform-settings-disabled", failure.getMessage());
  }

  @ExceptionHandler(UnknownPlatformSetting.class)
  ResponseEntity<ProblemDetail> unknown(UnknownPlatformSetting failure) {
    return problem(HttpStatus.NOT_FOUND, "platform-setting-unknown", failure.getMessage());
  }

  @ExceptionHandler(PlatformSettingConflict.class)
  ResponseEntity<ProblemDetail> conflict(PlatformSettingConflict failure) {
    return problem(HttpStatus.CONFLICT, "platform-setting-conflict", failure.getMessage());
  }

  @ExceptionHandler(IllegalArgumentException.class)
  ResponseEntity<ProblemDetail> invalid(IllegalArgumentException failure) {
    return problem(HttpStatus.BAD_REQUEST, "platform-setting-invalid", failure.getMessage());
  }

  private static ResponseEntity<ProblemDetail> problem(
      HttpStatus httpStatus, String type, String detail) {
    ProblemDetail problem = ProblemDetail.forStatusAndDetail(httpStatus, detail);
    problem.setType(URI.create(PROBLEMS + type));
    return ResponseEntity.status(httpStatus).body(problem);
  }

  record ChangeRequest(
      @Nullable Integer value,
      @NotNull Integer expectedValue,
      @NotBlank @Size(max = 200) String reason) {}

  record Overview(
      String environment,
      Services services,
      List<SettingResponse> settings,
      List<ReadOnlyValue> readOnly,
      List<FlagResponse> flags) {}

  record Services(boolean databaseAvailable, PlatformServiceStatus.FlagProvider flagProvider) {}

  record SettingResponse(
      String key, int value, int defaultValue, boolean overridden, int min, int max) {
    static SettingResponse from(PlatformSettingsService.Value value) {
      return new SettingResponse(
          value.setting().key(),
          value.value(),
          value.defaultValue(),
          value.overridden(),
          value.setting().min(),
          value.setting().max());
    }
  }

  record ReadOnlyValue(String key, String value) {}

  record FlagResponse(String key, String type, boolean enabled, boolean defaultValue) {}
}
