package com.mapit.spaces.application.template;

/** Lanzada al intentar crear una plantilla con un nombre que ya existe en el tenant (HU-4.02). */
public class ElementTemplateNameConflictException extends RuntimeException {

  public ElementTemplateNameConflictException(String name) {
    super("Ya existe una plantilla con el nombre: " + name);
  }
}
