package com.mapit.spaces.application;

import java.util.UUID;

/**
 * Indica que el establecimiento no existe dentro del tenant actual.
 *
 * <p>Se lanza también cuando el identificador pertenece a otro tenant o cuando la fila
 * está dada de baja: en los tres casos la respuesta es un 404. Devolver 403 confirmaría
 * que el recurso existe, que es justo lo que no queremos filtrar entre empresas.
 */
public class EstablishmentNotFoundException extends RuntimeException {

  public EstablishmentNotFoundException(UUID id) {
    super("No existe el establecimiento " + id);
  }
}
