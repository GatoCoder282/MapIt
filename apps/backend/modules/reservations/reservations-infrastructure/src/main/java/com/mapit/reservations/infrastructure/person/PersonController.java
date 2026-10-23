package com.mapit.reservations.infrastructure.person;

import java.net.URI;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import org.jspecify.annotations.Nullable;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import com.mapit.reservations.application.person.PersonService;
import com.mapit.reservations.domain.person.Person;
import com.mapit.reservations.domain.person.PersonEmailAlreadyExistsException;

/** API de búsqueda y alta de clientes para el flujo de reservas internas. */
@RestController
@RequestMapping("/api/v1/people")
public class PersonController {

  private static final String INVALID_PERSON = "https://mapit.dev/problems/person-invalid";
  private static final String EMAIL_CONFLICT = "https://mapit.dev/problems/person-email-conflict";

  private final PersonService service;

  public PersonController(PersonService service) {
    this.service = service;
  }

  @GetMapping
  public List<PersonResponse> search(
      @RequestParam(required = false) @Size(max = 120) @Nullable String query) {
    return service.search(query).stream().map(PersonResponse::fromDomain).toList();
  }

  @PostMapping
  @ResponseStatus(HttpStatus.CREATED)
  public PersonResponse create(@Valid @RequestBody PersonCreateRequest request) {
    return PersonResponse.fromDomain(
        service.create(request.fullName(), request.email(), request.phone()));
  }

  @ExceptionHandler(PersonEmailAlreadyExistsException.class)
  ResponseEntity<ProblemDetail> handleEmailConflict(PersonEmailAlreadyExistsException exception) {
    ProblemDetail problem =
        ProblemDetail.forStatusAndDetail(HttpStatus.CONFLICT, exception.getMessage());
    problem.setTitle("Correo de cliente ya registrado");
    problem.setType(URI.create(EMAIL_CONFLICT));
    return ResponseEntity.status(HttpStatus.CONFLICT).body(problem);
  }

  @ExceptionHandler(IllegalArgumentException.class)
  ResponseEntity<ProblemDetail> handleInvalidPerson(IllegalArgumentException exception) {
    ProblemDetail problem =
        ProblemDetail.forStatusAndDetail(HttpStatus.BAD_REQUEST, exception.getMessage());
    problem.setTitle("Datos del cliente inválidos");
    problem.setType(URI.create(INVALID_PERSON));
    return ResponseEntity.badRequest().body(problem);
  }

  public record PersonCreateRequest(
      @NotBlank @Size(max = 120) String fullName,
      @Email @Size(max = 254) @Nullable String email,
      @Size(max = 32) @Nullable String phone) {}

  public record PersonResponse(
      UUID id,
      String fullName,
      @Nullable String email,
      @Nullable String phone,
      Instant createdAt,
      UUID createdBy,
      Instant updatedAt,
      UUID updatedBy) {

    static PersonResponse fromDomain(Person person) {
      return new PersonResponse(
          person.id().value(),
          person.fullName(),
          person.email(),
          person.phone(),
          person.createdAt(),
          person.createdBy(),
          person.updatedAt(),
          person.updatedBy());
    }
  }
}
