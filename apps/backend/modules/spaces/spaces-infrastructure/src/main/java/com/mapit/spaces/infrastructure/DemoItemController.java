package com.mapit.spaces.infrastructure;

import java.net.URI;
import java.util.List;
import java.util.UUID;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import com.mapit.spaces.application.DemoItemNotFoundException;
import com.mapit.spaces.application.DemoItemService;
import com.mapit.spaces.domain.DemoItem;

/** Adaptador REST del CRUD de demostración. */
@RestController
@RequestMapping("/api/v1/demo-items")
public class DemoItemController {

  private final DemoItemService service;

  public DemoItemController(DemoItemService service) {
    this.service = service;
  }

  @GetMapping
  public List<DemoItemResponse> findAll() {
    return service.findAll().stream().map(DemoItemResponse::fromDomain).toList();
  }

  @GetMapping("/{id}")
  public DemoItemResponse findById(@PathVariable UUID id) {
    return DemoItemResponse.fromDomain(service.findById(id));
  }

  @PostMapping
  @ResponseStatus(HttpStatus.CREATED)
  public DemoItemResponse create(@Valid @RequestBody DemoItemRequest request) {
    return DemoItemResponse.fromDomain(
        service.create(request.name(), request.description(), request.active()));
  }

  @PutMapping("/{id}")
  public DemoItemResponse update(
      @PathVariable UUID id, @Valid @RequestBody DemoItemRequest request) {
    return DemoItemResponse.fromDomain(
        service.update(id, request.name(), request.description(), request.active()));
  }

  @DeleteMapping("/{id}")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  public void delete(@PathVariable UUID id) {
    service.delete(id);
  }

  @ExceptionHandler(DemoItemNotFoundException.class)
  ResponseEntity<ProblemDetail> handleNotFound(DemoItemNotFoundException exception) {
    ProblemDetail problem =
        ProblemDetail.forStatusAndDetail(HttpStatus.NOT_FOUND, exception.getMessage());
    problem.setTitle("Elemento no encontrado");
    problem.setType(URI.create("https://mapit.local/problems/demo-item-not-found"));
    return ResponseEntity.status(HttpStatus.NOT_FOUND).body(problem);
  }

  /** Payload de entrada compartido por POST y PUT. */
  public record DemoItemRequest(
      @NotBlank @Size(max = 120) String name,
      @NotNull @Size(max = 500) String description,
      @NotNull Boolean active) {}

  /** Payload de salida del endpoint. */
  public record DemoItemResponse(
      UUID id,
      String name,
      String description,
      boolean active,
      java.time.Instant createdAt,
      java.time.Instant updatedAt) {

    static DemoItemResponse fromDomain(DemoItem item) {
      return new DemoItemResponse(
          item.id(),
          item.name(),
          item.description(),
          item.active(),
          item.createdAt(),
          item.updatedAt());
    }
  }
}
