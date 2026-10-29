package com.mapit.reservations.infrastructure.booking;

import java.net.URI;

import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import com.mapit.reservations.application.reservation.PublicReservationAccessService;

/** Mapea solo errores propios, también cuando bootstrap orquesta pagos y operaciones. */
@RestControllerAdvice
public class ReservationAccessProblemAdvice {
  @ExceptionHandler({PublicReservationAccessService.AccessDenied.class, PublicReservationAccessService.NotFound.class})
  public ResponseEntity<ProblemDetail> notFound() {
    return response(HttpStatus.NOT_FOUND,"reservation-not-available","La reserva solicitada no está disponible");
  }

  @ExceptionHandler(PublicReservationAccessService.Conflict.class)
  public ResponseEntity<ProblemDetail> conflict() {
    return response(HttpStatus.CONFLICT,"reservation-arrival-conflict","La reserva no admite registrar llegada en su estado u horario actual");
  }

  private static ResponseEntity<ProblemDetail> response(HttpStatus status,String type,String detail) {
    ProblemDetail problem=ProblemDetail.forStatusAndDetail(status,detail);
    problem.setType(URI.create("https://mapit.dev/problems/"+type));
    return ResponseEntity.status(status).header("Cache-Control","no-store")
        .header("Referrer-Policy","no-referrer").body(problem);
  }
}
