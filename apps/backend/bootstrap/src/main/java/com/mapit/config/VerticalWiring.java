package com.mapit.config;

import java.net.URI;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import com.mapit.shared.flags.FeatureFlagPort;
import com.mapit.shared.vertical.VerticalDisabledException;
import com.mapit.shared.vertical.VerticalGate;

/**
 * Wiring de las verticales (HU-7.01/7.02).
 *
 * <p>{@link VerticalGate} es Java puro del shared kernel; aquí se publica como bean para que
 * spaces y reservations lo inyecten. La traducción a HTTP vive en bootstrap porque la
 * excepción la lanzan ambos contextos y ninguno debe conocer al otro.
 */
@Configuration
public class VerticalWiring {

  static final String VERTICAL_DISABLED = "https://mapit.local/problems/vertical-disabled";

  @Bean
  VerticalGate verticalGate(FeatureFlagPort flags) {
    return new VerticalGate(flags);
  }

  /** {@code 403 vertical-disabled}: la vertical existe, pero Unleash la tiene apagada. */
  @RestControllerAdvice
  static class VerticalProblemAdvice {

    @ExceptionHandler(VerticalDisabledException.class)
    ResponseEntity<ProblemDetail> handle(VerticalDisabledException exception) {
      ProblemDetail problem =
          ProblemDetail.forStatusAndDetail(HttpStatus.FORBIDDEN, exception.getMessage());
      problem.setTitle("Vertical deshabilitada");
      problem.setType(URI.create(VERTICAL_DISABLED));
      problem.setProperty("vertical", exception.vertical().name());
      return ResponseEntity.status(HttpStatus.FORBIDDEN).body(problem);
    }
  }
}
