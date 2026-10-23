package com.mapit.config.logging;

import java.io.IOException;
import java.util.Set;
import java.util.UUID;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import org.jspecify.annotations.Nullable;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;
import org.springframework.web.servlet.HandlerMapping;

/** Outermost request scope: correlation exists even when Spring Security rejects a request. */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE + 10)
public final class RequestLoggingFilter extends OncePerRequestFilter {
  public static final String HEADER = "X-Request-ID";
  public static final String TENANT_ATTRIBUTE = "mapit.logging.tenant_id";
  private static final String COMPLETED = "mapit.logging.completed";
  private static final Logger LOG = LoggerFactory.getLogger(RequestLoggingFilter.class);
  private static final Set<String> METHODS = Set.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD", "TRACE");

  @Override
  protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
      FilterChain chain) throws IOException, ServletException {
    var previous = MDC.getCopyOfContextMap();
    MDC.clear();
    String requestId = canonicalRequestId(request.getHeader(HEADER));
    MDC.put("request_id", requestId);
    response.setHeader(HEADER, requestId);
    long started = System.nanoTime();
    boolean failed = false;
    try {
      chain.doFilter(request, response);
    } catch (Exception exception) {
      failed = true;
      if (request.getAttribute(TENANT_ATTRIBUTE) instanceof String tenant) MDC.put("tenant_id", tenant);
      LOG.atError().addKeyValue("event", "http.request.failed")
          .setCause(exception).log("Request processing failed");
      if (!response.isCommitted()) response.sendError(500);
    } finally {
      try {
        if (request.getAttribute(COMPLETED) == null) {
          request.setAttribute(COMPLETED, true);
          Object tenant = request.getAttribute(TENANT_ATTRIBUTE);
          if (tenant instanceof String value) MDC.put("tenant_id", value);
          String route = request.getAttribute(HandlerMapping.BEST_MATCHING_PATTERN_ATTRIBUTE) instanceof String value ? value : "unmatched";
          int status = failed ? 500 : response.getStatus();
          boolean health = route.startsWith("/actuator/health") || route.equals("/api/v1/health");
          var event = health ? LOG.atDebug() : status >= 500 ? LOG.atError() : status == 401 || status == 403 ? LOG.atWarn() : status >= 400 ? LOG.atDebug() : LOG.atInfo();
          event.addKeyValue("event", "http.request.completed")
              .addKeyValue("method", METHODS.contains(request.getMethod()) ? request.getMethod() : "OTHER")
              .addKeyValue("route", route).addKeyValue("status", status)
              .addKeyValue("duration_ms", (System.nanoTime() - started) / 1_000_000L)
              .log("HTTP request completed");
        }
      } finally {
        if (previous == null) MDC.clear(); else MDC.setContextMap(previous);
      }
    }
  }

  static String canonicalRequestId(@Nullable String value) {
    if (value != null && value.matches("[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}")) {
      return UUID.fromString(value).toString();
    }
    return UUID.randomUUID().toString();
  }
}
