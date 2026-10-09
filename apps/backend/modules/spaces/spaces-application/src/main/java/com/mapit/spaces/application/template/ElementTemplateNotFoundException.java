package com.mapit.spaces.application.template;

import java.util.UUID;

/** Lanzada cuando una plantilla no existe o no pertenece al tenant activo (HU-4.02). */
public class ElementTemplateNotFoundException extends RuntimeException {

  public ElementTemplateNotFoundException(UUID id) {
    super("Plantilla de elemento no encontrada: " + id);
  }
}
