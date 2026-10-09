package com.mapit.spaces.application.template;

/**
 * Comando para crear una plantilla de elemento (HU-4.02 / MAP-204).
 *
 * @param name nombre descriptivo de la plantilla
 * @param type tipo de SpaceElement (TABLE, BAR, etc.) como String — el caso de uso valida
 */
public record CreateElementTemplateCommand(String name, String type) {

  public CreateElementTemplateCommand {
    if (name == null || name.isBlank()) {
      throw new IllegalArgumentException("name es obligatorio");
    }
    if (type == null || type.isBlank()) {
      throw new IllegalArgumentException("type es obligatorio");
    }
  }
}
