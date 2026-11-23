package com.mapit.spaces.domain.sector;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.regex.Pattern;

import org.jspecify.annotations.Nullable;

/** Validated visual properties, independent of operational state and executable content. */
public final class SectorAppearance {
  private static final Pattern COLOR = Pattern.compile("^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$");
  private static final Pattern IDENTIFIER = Pattern.compile("^[a-zA-Z0-9_-]{1,64}$");
  private static final Set<String> ROOM = Set.of("floorColor", "wallColor", "floorPattern");
  private static final Set<String> ELEMENT = Set.of(
      "color", "variant", "preset", "boardColor", "boardMaterial", "boardEdge",
      "chairStyle", "chairArms", "showName", "showCapacity", "labelStyle", "labelPosition",
      "seatColor", "visualScale", "fillOpacity", "cornerRadius", "zoneBorder", "zoneBorderColor");
  private static final Set<String> BOOLEANS = Set.of("chairArms", "showName", "showCapacity");
  private static final Set<String> COLORS = Set.of(
      "color", "boardColor", "floorColor", "wallColor", "seatColor", "zoneBorderColor");
  private static final Map<String, Integer> LIMITS = Map.of("fillOpacity", 100, "cornerRadius", 40);
  private static final Map<String, Set<String>> OPTIONS = Map.of(
      "labelPosition", Set.of("top", "center", "bottom"),
      "visualScale", Set.of("small", "medium", "large"),
      "zoneBorder", Set.of("solid", "dashed", "none"));

  private SectorAppearance() {}

  public static Map<String, Object> normalize(@Nullable Object value) {
    if (value == null) return Map.of("elements", Map.of());
    if (!(value instanceof Map<?, ?> source) || !Set.of("room", "elements").containsAll(source.keySet())) {
      throw invalid();
    }
    Map<String, Object> result = new LinkedHashMap<>();
    if (source.containsKey("room")) result.put("room", properties(source.get("room"), ROOM));
    Map<String, Object> elements = new LinkedHashMap<>();
    Object styles = source.get("elements");
    if (styles != null) {
      if (!(styles instanceof Map<?, ?> entries) || entries.size() > 2000) throw invalid();
      for (var entry : entries.entrySet()) {
        if (!(entry.getKey() instanceof String id)) throw invalid();
        if (!UUID.fromString(id).toString().equals(id)) throw invalid();
        elements.put(id, properties(entry.getValue(), ELEMENT));
      }
    } else if (source.containsKey("elements")) {
      throw invalid();
    }
    result.put("elements", Map.copyOf(elements));
    return Map.copyOf(result);
  }

  private static Map<String, Object> properties(@Nullable Object value, Set<String> allowed) {
    if (!(value instanceof Map<?, ?> source) || !allowed.containsAll(source.keySet())) throw invalid();
    Map<String, Object> result = new LinkedHashMap<>();
    for (var entry : source.entrySet()) {
      String key = entry.getKey().toString();
      Object property = entry.getValue();
      if (BOOLEANS.contains(key)) {
        if (!(property instanceof Boolean)) throw invalid();
      } else if (LIMITS.containsKey(key)) {
        if (!(property instanceof Number number)) throw invalid();
        double n = number.doubleValue();
        if (n < 0 || n > LIMITS.get(key) || n != Math.rint(n)) throw invalid();
        property = (int) n;
      } else if (OPTIONS.containsKey(key)) {
        if (!(property instanceof String text) || !OPTIONS.get(key).contains(text)) throw invalid();
      } else {
        if (!(property instanceof String text) ||
            !(COLORS.contains(key) ? COLOR : IDENTIFIER).matcher(text).matches()) throw invalid();
      }
      result.put(key, property);
    }
    return Map.copyOf(result);
  }

  public static Map<String, Object> forElements(
      Map<String, Object> appearance, Set<UUID> liveIds, Set<UUID> deletedIds) {
    Map<String, Object> result = new LinkedHashMap<>(normalize(appearance));
    Map<String, Object> retained = new LinkedHashMap<>();
    if (result.get("elements") instanceof Map<?, ?> styles) {
      for (var entry : styles.entrySet()) {
        String key = entry.getKey().toString();
        UUID id = UUID.fromString(key);
        if (deletedIds.contains(id)) continue;
        if (!liveIds.contains(id)) {
          throw new IllegalArgumentException("La apariencia referencia un elemento ajeno al sector");
        }
        retained.put(key, entry.getValue());
      }
    }
    result.put("elements", Map.copyOf(retained));
    return Map.copyOf(result);
  }

  private static IllegalArgumentException invalid() {
    return new IllegalArgumentException("Apariencia de sector inválida");
  }
}
