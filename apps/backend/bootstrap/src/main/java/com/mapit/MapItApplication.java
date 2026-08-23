package com.mapit;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

/**
 * Punto de entrada de MapIt.
 *
 * <p>El escaneo arranca en {@code com.mapit}, así que recoge los adaptadores de todos los
 * módulos. Cada módulo es responsable de declarar sus propios beans en su capa de
 * infraestructura: aquí no se configura nada específico de negocio.
 */
@SpringBootApplication
public class MapItApplication {

  public static void main(String[] args) {
    SpringApplication.run(MapItApplication.class, args);
  }
}
