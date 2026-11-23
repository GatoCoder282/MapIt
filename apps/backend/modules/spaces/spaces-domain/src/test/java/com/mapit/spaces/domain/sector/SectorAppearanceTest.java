package com.mapit.spaces.domain.sector;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.util.Map;
import java.util.Set;
import java.util.UUID;

import org.junit.jupiter.api.Test;

class SectorAppearanceTest {
  @Test
  void validatesPropertiesAndOwnElementIdsAndRemovesDeletedIds() {
    UUID table = UUID.randomUUID();
    UUID removed = UUID.randomUUID();
    var appearance = SectorAppearance.normalize(Map.of(
        "room", Map.of("floorColor", "#a1b2c3", "wallColor", "#abcdef", "floorPattern", "wood"),
        "elements", Map.of(table.toString(), Map.of("boardMaterial", "wood", "chairArms", true),
            removed.toString(), Map.of("showName", false))));

    var retained = SectorAppearance.forElements(appearance, Set.of(table), Set.of(removed));
    assertEquals(Map.of(table.toString(), Map.of("boardMaterial", "wood", "chairArms", true)),
        retained.get("elements"));
    assertThrows(IllegalArgumentException.class,
        () -> SectorAppearance.forElements(appearance, Set.of(), Set.of(removed)));
    assertThrows(UnsupportedOperationException.class, () -> retained.put("state", "OCCUPIED"));
    assertEquals(Map.of("elements", Map.of()), SectorAppearance.normalize(null));
  }

  @Test
  void rejectsUnrecognizedKeysInvalidColorAndIncorrectBooleanTypes() {
    var id = UUID.randomUUID().toString();
    assertThrows(IllegalArgumentException.class,
        () -> SectorAppearance.normalize(Map.of("state", "AVAILABLE")));
    assertThrows(IllegalArgumentException.class,
        () -> SectorAppearance.normalize(Map.of("room", Map.of("floorColor", "url(evil)"))));
    assertThrows(IllegalArgumentException.class,
        () -> SectorAppearance.normalize(Map.of("elements", Map.of(id, Map.of("showName", "true")))));
    assertThrows(IllegalArgumentException.class,
        () -> SectorAppearance.normalize(Map.of("elements", Map.of("bad-id", Map.of()))));
  }

  @Test
  void validatesZoneRangesAndCategoryOptions() {
    var id = UUID.randomUUID().toString();
    var valid = Map.of("elements", Map.of(id, Map.of(
        "fillOpacity", 0, "cornerRadius", 40, "zoneBorder", "dashed",
        "zoneBorderColor", "#2563eb", "labelPosition", "center",
        "visualScale", "large", "seatColor", "#e2d7bd")));
    assertEquals(valid, SectorAppearance.normalize(valid));
    for (var changes : Set.of(
        Map.of("fillOpacity", 101), Map.of("cornerRadius", 10.5),
        Map.of("labelPosition", "elsewhere"), Map.of("zoneBorderColor", "arbitrary"))) {
      assertThrows(IllegalArgumentException.class,
          () -> SectorAppearance.normalize(Map.of("elements", Map.of(id, changes))));
    }
  }
}
