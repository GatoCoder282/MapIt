package com.mapit.spaces.application;

import com.mapit.spaces.domain.EstablishmentType;
import com.mapit.spaces.domain.SpaceElementType;
import com.mapit.spaces.domain.SpaceElementTypePolicy;

/** El tipo de elemento no es válido para la vertical del establecimiento (RN-4). */
public class InvalidElementTypeForVerticalException extends RuntimeException {

  public InvalidElementTypeForVerticalException(
      EstablishmentType vertical, SpaceElementType type) {
    super(
        "El tipo '%s' no es válido para un establecimiento '%s'. Tipos válidos: %s"
            .formatted(type, vertical, SpaceElementTypePolicy.permitidos(vertical)));
  }
}
