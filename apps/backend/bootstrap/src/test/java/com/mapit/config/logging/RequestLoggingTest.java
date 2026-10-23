package com.mapit.config.logging;

import static org.assertj.core.api.Assertions.assertThat;

import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.CyclicBarrier;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;
import org.springframework.boot.logging.logback.StructuredLogEncoder;
import org.springframework.core.env.Environment;
import org.springframework.mock.env.MockEnvironment;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.web.servlet.HandlerMapping;

import com.mapit.identity.domain.AuthenticatedPrincipal;
import com.mapit.identity.domain.UserRole;
import com.mapit.identity.infrastructure.JwtAuthenticationFilter;
import com.mapit.shared.tenant.TenantId;

import ch.qos.logback.classic.Level;
import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.LoggerContext;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.AppenderBase;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/** Exercises the actual Boot encoder, including MDC and privacy at the output boundary. */
class RequestLoggingTest {
  private final List<String> output = Collections.synchronizedList(new ArrayList<>());
  private final Logger logger = (Logger) LoggerFactory.getLogger("com.mapit.config.logging");
  private final Logger framework = (Logger) LoggerFactory.getLogger("org.hibernate.mapitPrivacyTest");
  private final LoggerContext encoderContext = new LoggerContext();
  private final StructuredLogEncoder encoder = new StructuredLogEncoder();
  private final AppenderBase<ILoggingEvent> appender = new AppenderBase<>() {
    @Override protected void append(ILoggingEvent event) {
      event.prepareForDeferredProcessing();
      output.add(new String(encoder.encode(event), StandardCharsets.UTF_8));
    }
  };
  private Level previousLevel;
  private boolean previousAdditivity;

  @BeforeEach
  void setup() {
    encoderContext.putObject(Environment.class.getName(), new MockEnvironment()
        .withProperty("logging.structured.json.customizer", SafeJsonMembersCustomizer.class.getName())
        .withProperty("logging.structured.json.stacktrace.printer", SafeStackTracePrinter.class.getName())
        .withProperty("logging.structured.json.add.service", "mapit-backend")
        .withProperty("logging.structured.json.add.environment", "test"));
    encoder.setContext(encoderContext);
    encoder.setFormat("logstash");
    encoder.start();
    appender.setContext(encoderContext);
    appender.start();
    previousLevel = logger.getLevel();
    previousAdditivity = logger.isAdditive();
    logger.setLevel(Level.DEBUG);
    logger.setAdditive(false);
    logger.addAppender(appender);
    framework.setAdditive(false);
    framework.addAppender(appender);
  }

  @AfterEach
  void cleanup() {
    logger.detachAppender(appender);
    logger.setLevel(previousLevel);
    logger.setAdditive(previousAdditivity);
    framework.detachAppender(appender);
    framework.setAdditive(true);
    appender.stop();
    encoder.stop();
    encoderContext.stop();
    MDC.clear();
  }

  private JsonNode json(int index) {
    return JsonMapper.builder().build().readTree(output.get(index));
  }

  @Test
  void canonicalizesIdAndLogsOnlyTemplateAndRestoresPreviousContext() throws Exception {
    var request = new MockHttpServletRequest("GET", "/private-user-secret");
    request.addHeader("X-Request-ID", "ABCDEF01-1234-5678-9012-ABCDEF012345");
    request.setQueryString("token=secret-canary");
    request.addHeader("Cookie", "secret-canary");
    var response = new MockHttpServletResponse();
    MDC.setContextMap(Map.of("tenant_id", "outer", "private", "outer-secret"));
    new RequestLoggingFilter().doFilter(request, response, (req, res) -> {
      assertThat(MDC.get("tenant_id")).isNull();
      req.setAttribute(HandlerMapping.BEST_MATCHING_PATTERN_ATTRIBUTE, "/api/v1/tenants/{id}");
      response.setStatus(404);
    });
    assertThat(response.getHeader("X-Request-ID")).isEqualTo("abcdef01-1234-5678-9012-abcdef012345");
    assertThat(output).hasSize(1);
    assertThat(json(0).path("@timestamp").asString()).endsWith("Z");
    assertThat(json(0).path("event").asString()).isEqualTo("http.request.completed");
    assertThat(json(0).path("route").asString()).isEqualTo("/api/v1/tenants/{id}");
    assertThat(json(0).path("status").asInt()).isEqualTo(404);
    assertThat(json(0).has("tenant_id")).isFalse();
    assertThat(output.getFirst()).doesNotContain("secret", "Cookie", "private-user");
    assertThat(MDC.getCopyOfContextMap()).isEqualTo(Map.of("tenant_id", "outer", "private", "outer-secret"));
  }

  @Test
  void generatesIdsAndPreservesSecurityRejections() throws Exception {
    for (String incoming : List.of("", "password=secret-canary", "1-1-1-1-1")) {
      var request = new MockHttpServletRequest("GET", "/api/v1/tenants");
      if (!incoming.isEmpty()) request.addHeader("X-Request-ID", incoming);
      request.addHeader("Authorization", "Bearer secret-canary");
      var response = new MockHttpServletResponse();
      new RequestLoggingFilter().doFilter(request, response, (req, res) ->
          new JwtAuthenticationFilter(token -> Optional.empty()).doFilter(req, res, (a, b) -> {
            throw new AssertionError("Invalid token must not reach endpoint");
          }));
      assertThat(response.getStatus()).isEqualTo(401);
      assertThat(UUID.fromString(response.getHeader("X-Request-ID"))).isNotNull();
    }
    assertThat(output).hasSize(3);
    assertThat(output.toString()).doesNotContain("secret-canary");
    assertThat(MDC.getCopyOfContextMap()).isNullOrEmpty();
  }

  @Test
  void unexpectedFailureProducesSafeCauseAndOneSummary() throws Exception {
    var response = new MockHttpServletResponse();
    new RequestLoggingFilter().doFilter(new MockHttpServletRequest(), response, (req, res) -> {
      throw new IllegalStateException("password=secret-canary", new RuntimeException("Bearer secret-canary"));
    });
    assertThat(response.getStatus()).isEqualTo(500);
    assertThat(output).hasSize(2);
    assertThat(output.toString()).doesNotContain("secret-canary", "password=");
    assertThat(json(0).path("stack_trace").asString()).contains("IllegalStateException", "RequestLoggingTest");
    assertThat(json(0).path("request_id").asString()).isEqualTo(json(1).path("request_id").asString());
    assertThat(MDC.getCopyOfContextMap()).isNullOrEmpty();
  }

  @Test
  void frameworkMessagesArgumentsAndUnknownMdcCannotLeak() {
    MDC.put("password", "secret-canary");
    framework.atError().addKeyValue("Authorization", "secret-canary")
        .setCause(new IllegalArgumentException("secret-canary"))
        .log("SQL parameter {}", "secret-canary");
    assertThat(output).hasSize(1);
    assertThat(output.getFirst()).doesNotContain("secret-canary", "SQL parameter", "Authorization", "password");
    assertThat(json(0).path("message").asString()).contains("Framework");
    assertThat(json(0).path("stack_trace").asString()).contains("IllegalArgumentException");
  }

  @Test
  void concurrentTenantsHaveIndependentContextAndNoLeakAfterCompletion() throws Exception {
    var barrier = new CyclicBarrier(2);
    try (var executor = Executors.newFixedThreadPool(2)) {
      var futures = new ArrayList<java.util.concurrent.Future<?>>();
      for (String tenant : List.of("tenant-a", "tenant-b")) {
        futures.add(executor.submit(() -> {
          var request = new MockHttpServletRequest();
          request.addHeader("Authorization", "Bearer verified-by-test");
          var principal = new AuthenticatedPrincipal(UUID.randomUUID(), TenantId.of(tenant), "private@example.test", UserRole.ADMIN);
          try {
            new RequestLoggingFilter().doFilter(request, new MockHttpServletResponse(), (req, res) ->
                new JwtAuthenticationFilter(token -> Optional.of(principal)).doFilter(req, res, (a, b) -> {
                  try { barrier.await(5, TimeUnit.SECONDS); }
                  catch (Exception ex) { throw new IllegalStateException(ex); }
                  assertThat(MDC.get("tenant_id")).isEqualTo(tenant);
                }));
            assertThat(MDC.getCopyOfContextMap()).isNullOrEmpty();
          } catch (Exception ex) { throw new IllegalStateException(ex); }
        }));
      }
      for (var future : futures) future.get(10, TimeUnit.SECONDS);
    }
    assertThat(output).hasSize(2);
    assertThat(List.of(json(0).path("tenant_id").asString(), json(1).path("tenant_id").asString()))
        .containsExactlyInAnyOrder("tenant-a", "tenant-b");
    assertThat(json(0).path("request_id").asString()).isNotEqualTo(json(1).path("request_id").asString());
    assertThat(output.toString()).doesNotContain("private@example.test", "verified-by-test");
  }
}
