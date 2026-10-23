package com.mapit.spaces.domain.sector;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.time.Instant;
import java.util.UUID;

import org.junit.jupiter.api.Test;

import com.mapit.shared.tenant.TenantId;
import com.mapit.spaces.domain.Slug;
import com.mapit.spaces.domain.layout.Geometry;
import com.mapit.spaces.domain.layout.Placement;

class SectorTest {

  private static final TenantId TENANT = TenantId.of("tenant-a");
  private static final Instant NOW = Instant.parse("2026-10-11T00:00:00Z");

  private Sector newSector() {
    return Sector.register(
        SectorId.of(UUID.randomUUID()), TENANT, UUID.randomUUID(),
        "  Terraza  ", 40, Slug.of("terraza"), NOW, null);
  }

  @Test
  void al_registrar_la_geometria_y_la_colocacion_son_los_defaults() {
    Sector s = newSector();
    assertEquals(Geometry.defaultSector(), s.geometry());
    assertEquals(Placement.origin(), s.placement());
  }

  @Test
  void moveTo_cambia_solo_la_colocacion_y_toca_auditoria() {
    Sector s = newSector();
    Instant later = NOW.plusSeconds(60);
    Sector moved = s.moveTo(Placement.of(120, 40, 90), later, null);
    assertEquals(120, moved.placement().x());
    assertEquals(90, moved.placement().rotation());
    assertEquals(s.geometry(), moved.geometry(), "RN-2: la geometría interna no cambia al mover");
    assertEquals(later, moved.audit().updatedAt());
  }

  @Test
  void resize_cambia_solo_la_geometria() {
    Sector resized = newSector().resize(Geometry.of(500, 300), NOW, null);
    assertEquals(500, resized.geometry().width());
    assertEquals(Placement.origin(), resized.placement());
  }

  @Test
  void no_se_puede_colocar_ni_redimensionar_un_sector_dado_de_baja() {
    Sector deleted = newSector().softDelete(NOW, null);
    assertThrows(IllegalStateException.class,
        () -> deleted.moveTo(Placement.of(1, 1, 0), NOW, null));
    assertThrows(IllegalStateException.class,
        () -> deleted.resize(Geometry.of(100, 100), NOW, null));
  }

  @Test
  void la_construccion_sigue_validando_nombre_y_capacidad() {
    SectorId id = SectorId.of(UUID.randomUUID());
    UUID floorId = UUID.randomUUID();
    assertNotNull(new Sector(id, TENANT, floorId, "Barra", 10, Slug.of("barra"),
        Geometry.of(300, 200), Placement.of(50, 50, 45), com.mapit.spaces.domain.AuditTrail.created(NOW, null)));
    assertThrows(IllegalArgumentException.class, () ->
        new Sector(id, TENANT, floorId, "  ", 10, Slug.of("barra"),
            Geometry.defaultSector(), Placement.origin(),
            com.mapit.spaces.domain.AuditTrail.created(NOW, null)));
    assertThrows(IllegalArgumentException.class, () ->
        Sector.register(id, TENANT, floorId, "X", 0, Slug.of("x"), NOW, null));
  }
}
