package com.mapit.spaces.infrastructure.sector;

import java.util.Map;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

import org.jspecify.annotations.Nullable;

import com.mapit.spaces.domain.sector.SectorAppearance;

import tools.jackson.databind.ObjectMapper;

@Converter
public class SectorAppearanceConverter implements AttributeConverter<Map<String, Object>, String> {
  private static final ObjectMapper JSON = new ObjectMapper();

  @Override
  public String convertToDatabaseColumn(@Nullable Map<String, Object> appearance) {
    return JSON.writeValueAsString(SectorAppearance.normalize(appearance));
  }

  @Override
  public Map<String, Object> convertToEntityAttribute(@Nullable String value) {
    return SectorAppearance.normalize(value == null ? null : JSON.readValue(value, Object.class));
  }
}
