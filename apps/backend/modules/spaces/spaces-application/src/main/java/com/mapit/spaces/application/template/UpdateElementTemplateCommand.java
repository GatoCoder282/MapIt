package com.mapit.spaces.application.template;

import java.util.UUID;

/**
 * Comando para actualizar una plantilla de elemento (HU-4.02 / MAP-204).
 *
 * @param templateId UUID de la plantilla a actualizar
 * @param name       nuevo nombre descriptivo
 * @param type       nuevo tipo de SpaceElement como String
 */
public record UpdateElementTemplateCommand(UUID templateId, String name, String type) {

  public UpdateElementTemplateCommand {
    if (templateId == null) {
      throw new IllegalArgumentException("templateId es obligatorio");
    }
    if (name == null || name.isBlank()) {
      throw new IllegalArgumentException("name es obligatorio");
    }
    if (type == null || type.isBlank()) {
      throw new IllegalArgumentException("type es obligatorio");
    }
  }
}
