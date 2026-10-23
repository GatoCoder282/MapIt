package com.mapit.spaces.infrastructure.template;

import java.net.URI;
import java.util.List;
import java.util.UUID;

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
import org.springframework.web.bind.annotation.RestController;

import com.mapit.spaces.application.template.CreateElementTemplateCommand;
import com.mapit.spaces.application.template.ElementTemplateNameConflictException;
import com.mapit.spaces.application.template.ElementTemplateNotFoundException;
import com.mapit.spaces.application.template.ElementTemplateResponse;
import com.mapit.spaces.application.template.ElementTemplateService;
import com.mapit.spaces.application.template.UpdateElementTemplateCommand;
import com.mapit.spaces.infrastructure.SpacesProblemTypes;

/**
 * Adaptador REST de plantillas de elemento (HU-4.02 / MAP-204).
 *
 * <p>Base path {@code /api/v1} — consistente con el resto de controllers de spaces.
 * El tenant nunca viaja en el body: se resuelve del contexto en el servicio.
 *
 * <pre>
 * GET    /api/v1/element-templates          → listar plantillas del tenant
 * POST   /api/v1/element-templates          → crear plantilla
 * GET    /api/v1/element-templates/{id}     → detalle
 * PUT    /api/v1/element-templates/{id}     → actualizar
 * DELETE /api/v1/element-templates/{id}     → baja lógica
 * </pre>
 */
@RestController
@RequestMapping("/api/v1/element-templates")
public class ElementTemplateController {

  private final ElementTemplateService service;

  public ElementTemplateController(ElementTemplateService service) {
    this.service = service;
  }

  /** Body de POST — solo name y type. */
  public record CreateTemplateRequest(String name, String type) {}

  /** Body de PUT — solo name y type (reemplazo completo de los editables). */
  public record UpdateTemplateRequest(String name, String type) {}

  @GetMapping
  public ResponseEntity<List<ElementTemplateResponse>> list() {
    return ResponseEntity.ok(service.listAll());
  }

  @PostMapping
  public ResponseEntity<ElementTemplateResponse> create(
      @RequestBody CreateTemplateRequest request) {
    ElementTemplateResponse response =
        service.create(new CreateElementTemplateCommand(request.name(), request.type()));
    return ResponseEntity.status(HttpStatus.CREATED).body(response);
  }

  @GetMapping("/{id}")
  public ResponseEntity<ElementTemplateResponse> getById(@PathVariable UUID id) {
    return ResponseEntity.ok(service.getById(id));
  }

  @PutMapping("/{id}")
  public ResponseEntity<ElementTemplateResponse> update(
      @PathVariable UUID id, @RequestBody UpdateTemplateRequest request) {
    ElementTemplateResponse response =
        service.update(new UpdateElementTemplateCommand(id, request.name(), request.type()));
    return ResponseEntity.ok(response);
  }

  @DeleteMapping("/{id}")
  public ResponseEntity<Void> delete(@PathVariable UUID id) {
    service.delete(id);
    return ResponseEntity.noContent().build();
  }

  // ===== Exception handlers =====

  @ExceptionHandler(ElementTemplateNotFoundException.class)
  ResponseEntity<ProblemDetail> handleNotFound(ElementTemplateNotFoundException ex) {
    ProblemDetail problem =
        ProblemDetail.forStatusAndDetail(HttpStatus.NOT_FOUND, ex.getMessage());
    problem.setTitle("Plantilla de elemento no encontrada");
    problem.setType(URI.create(SpacesProblemTypes.RESOURCE_NOT_FOUND));
    return ResponseEntity.status(HttpStatus.NOT_FOUND).body(problem);
  }

  @ExceptionHandler(ElementTemplateNameConflictException.class)
  ResponseEntity<ProblemDetail> handleNameConflict(ElementTemplateNameConflictException ex) {
    ProblemDetail problem =
        ProblemDetail.forStatusAndDetail(HttpStatus.CONFLICT, ex.getMessage());
    problem.setTitle("Nombre de plantilla en conflicto");
    problem.setType(URI.create(SpacesProblemTypes.RESOURCE_CONFLICT));
    return ResponseEntity.status(HttpStatus.CONFLICT).body(problem);
  }

  @ExceptionHandler(IllegalArgumentException.class)
  ResponseEntity<ProblemDetail> handleBadRequest(IllegalArgumentException ex) {
    ProblemDetail problem =
        ProblemDetail.forStatusAndDetail(HttpStatus.BAD_REQUEST, ex.getMessage());
    problem.setTitle("Datos inválidos");
    problem.setType(URI.create(SpacesProblemTypes.INVALID_INPUT));
    return ResponseEntity.badRequest().body(problem);
  }
}
