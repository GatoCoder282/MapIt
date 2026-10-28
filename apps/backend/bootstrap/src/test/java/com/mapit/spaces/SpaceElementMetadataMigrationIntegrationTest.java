package com.mapit.spaces;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.Map;
import java.util.UUID;

import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

@Tag("integration") @Testcontainers
class SpaceElementMetadataMigrationIntegrationTest {
  @Container static final PostgreSQLContainer<?> DATABASE=new PostgreSQLContainer<>("postgres:17-alpine")
      .withDatabaseName("mapit").withUsername("mapit").withPassword("metadata_upgrade_only");
  @Test void upgrade_legado_null_sin_backfill_conserva_geometria_rls_y_restricciones() {
    var config=Flyway.configure().dataSource(DATABASE.getJdbcUrl(),DATABASE.getUsername(),DATABASE.getPassword())
        .locations("classpath:db/migration").placeholders(Map.of("mapitAppDbPassword","metadata_runtime_only"));
    config.target("27").load().migrate();
    var jdbc=new JdbcTemplate(new DriverManagerDataSource(DATABASE.getJdbcUrl(),DATABASE.getUsername(),DATABASE.getPassword()));
    UUID venue=UUID.randomUUID(),floor=UUID.randomUUID(),sector=UUID.randomUUID(),element=UUID.randomUUID();
    jdbc.update("insert into tenant(id,name,slug,status,vertical) values('metadata-upgrade','Metadata','metadata-upgrade','ACTIVE','RESTAURANT')");
    jdbc.update("insert into establishment(id,tenant_id,name,type,slug) values(?,'metadata-upgrade','Local','RESTAURANT','local')",venue);
    jdbc.update("insert into floor(id,tenant_id,establishment_id,name,level) values(?,'metadata-upgrade',?,'Piso',0)",floor,venue);
    jdbc.update("insert into sector(id,tenant_id,floor_id,name,max_capacity) values(?,'metadata-upgrade',?,'Sector',20)",sector,floor);
    jdbc.update("insert into space_element(id,tenant_id,sector_id,type,state,x,y,width,height,rotation) values(?,'metadata-upgrade',?,'TABLE','AVAILABLE',12,34,80,90,10)",element,sector);
    var before=jdbc.queryForMap("select x,y,width,height,rotation,state,sector_id from space_element where id=?",element);
    var latest=config.target("latest").load(); latest.migrate(); latest.validate();
    assertThat(jdbc.queryForMap("select x,y,width,height,rotation,state,sector_id from space_element where id=?",element)).isEqualTo(before);
    var metadata=jdbc.queryForMap("select label,capacity from space_element where id=?",element);
    assertThat(metadata.get("label")).isNull(); assertThat(metadata.get("capacity")).isNull();
    assertThat(jdbc.queryForObject("select relrowsecurity and relforcerowsecurity from pg_class where oid='space_element'::regclass",Boolean.class)).isTrue();
    for(String sql : new String[]{"update space_element set capacity=0 where id=?","update space_element set label=' ' where id=?","update space_element set label=' padded ' where id=?"}) {
      assertThatThrownBy(() -> jdbc.update(sql,element)).isInstanceOf(DataAccessException.class);
    }
    jdbc.update("update space_element set label='Terraza',capacity=4 where id=?",element);
    assertThat(jdbc.queryForObject("select label from space_element where id=?",String.class,element)).isEqualTo("Terraza");
  }
}
