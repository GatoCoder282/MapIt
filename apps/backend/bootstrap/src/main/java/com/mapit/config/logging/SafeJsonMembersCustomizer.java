package com.mapit.config.logging;

import java.util.Set;

import org.springframework.boot.json.JsonWriter;
import org.springframework.boot.logging.structured.StructuredLoggingJsonMembersCustomizer;

import ch.qos.logback.classic.spi.ILoggingEvent;

/** Prevent framework SQL/HTTP diagnostics and arbitrary MDC from serializing secrets. */
public final class SafeJsonMembersCustomizer implements StructuredLoggingJsonMembersCustomizer<ILoggingEvent> {
  private static final Set<String> FIELDS = Set.of("safe_timestamp", "@version", "safe_message", "safe_event", "logger_name", "thread_name", "level", "level_value", "stack_trace", "service", "environment", "request_id", "tenant_id", "method", "route", "status", "duration_ms", "event_id", "attempt", "next_attempt", "integration", "error_type", "operation");

  @Override
  public void customize(JsonWriter.Members<ILoggingEvent> members) {
    members.add("safe_timestamp", event -> event.getInstant().toString());
    members.add("safe_message", event -> event.getLoggerName().startsWith("com.mapit.")
        ? event.getMessage() : "Framework event; see logger and exception locations");
    members.add("safe_event", event -> {
      if (event.getLoggerName().startsWith("com.mapit.") && event.getKeyValuePairs() != null) {
        for (var pair : event.getKeyValuePairs()) {
          if (pair.key.equals("event") && pair.value instanceof String name
              && name.matches("[a-z][a-z0-9_.]{0,63}")) return name;
        }
      }
      return "framework.event";
    });
    members.applyingPathFilter(path -> !FIELDS.contains(path.name()));
    members.applyingNameProcessor((path, name) -> switch (name) {
      case "safe_message" -> "message";
      case "safe_event" -> "event";
      case "safe_timestamp" -> "@timestamp";
      default -> name;
    });
  }
}
