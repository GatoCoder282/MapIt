package com.mapit.spaces.infrastructure.spaceelement;

import java.net.URI;
import java.util.List;
import java.util.UUID;

import jakarta.servlet.http.HttpServletRequest;

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
import org.springframework.web.server.ResponseStatusException;

import com.mapit.spaces.application.sector.SectorNotFoundException;
import com.mapit.spaces.application.spaceelement.CreateSpaceElementCommand;
import com.mapit.spaces.application.spaceelement.CreateSpaceElementUseCase;
import com.mapit.spaces.application.spaceelement.DeleteSpaceElementUseCase;
import com.mapit.spaces.application.spaceelement.InvalidElementTypeForVerticalException;
import com.mapit.spaces.application.spaceelement.SpaceElementHasActiveReservationsException;
import com.mapit.spaces.application.spaceelement.SpaceElementNotFoundException;
import com.mapit.spaces.application.spaceelement.SpaceElementQueryService;
import com.mapit.spaces.application.spaceelement.SpaceElementResponse;
import com.mapit.spaces.application.spaceelement.UpdateSpaceElementCommand;
import com.mapit.spaces.application.spaceelement.UpdateSpaceElementUseCase;
import com.mapit.spaces.infrastructure.SpacesProblemTypes;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

/**
 * Adaptador REST de elementos espaciales (HU-2.03 / MAP-115).
 *
 * <p>La base path es {@code /api/v1}, como el resto de controllers de spaces.
 * El tenant nunca viaja en el cuerpo: se resuelve del contexto en el caso de uso.
 * El {@code sectorId} del path se re-verifica contra el tenant actual: un id ajeno
 * y uno inexistente responden igual (404), para no filtrar existencia entre tenants.
 */
@RestController
@RequestMapping("/api/v1")
public class SpaceElementController {
  private final ObjectMapper mapper;
  private final com.mapit.shared.security.ActorContext actors;

  private final CreateSpaceElementUseCase create;
  private final UpdateSpaceElementUseCase update;
  private final SpaceElementQueryService query;
  private final DeleteSpaceElementUseCase deleteElement;

  public SpaceElementController(
      CreateSpaceElementUseCase create,
      UpdateSpaceElementUseCase update,
      SpaceElementQueryService query,
       DeleteSpaceElementUseCase deleteElement, ObjectMapper mapper, com.mapit.shared.security.ActorContext actors) {
    this.create = create;
    this.update = update;
    this.query = query;
    this.deleteElement = deleteElement;
    this.mapper = mapper;
    this.actors = actors;
  }

  /** Body de POST /sectors/{sectorId}/elements. Tenant y sectorId van por contexto/path. */
  public record CreateSpaceElementRequest(
      String type, Double x, Double y, Double width, Double height, Double rotation, String initialState, String label, Integer capacity) {}

  /** Body de PUT …/elements/{elementId}: reemplazo completo de los editables. */
  public record UpdateSpaceElementRequest(String type, Double x, Double y, Double width, Double height, Double rotation, String label, Integer capacity) {}

  @PostMapping("/sectors/{sectorId}/elements")
  public ResponseEntity<SpaceElementResponse> create(
      @PathVariable UUID sectorId, @RequestBody JsonNode body, HttpServletRequest http) {
    authorize(http);
    validateMetadata(body);
    var request = mapper.treeToValue(body, CreateSpaceElementRequest.class);
    SpaceElementResponse response =
        create.create(
            new CreateSpaceElementCommand(
                sectorId, request.type(), request.x(), request.y(), request.width(), request.height(), request.rotation(), request.initialState(),
                body.hasNonNull("label") ? body.get("label").asString() : null,
                body.hasNonNull("capacity") ? body.get("capacity").intValue() : null));
    return ResponseEntity.status(HttpStatus.CREATED).body(response);
  }

  @GetMapping("/sectors/{sectorId}/elements")
  public ResponseEntity<List<SpaceElementResponse>> getBySector(@PathVariable UUID sectorId, HttpServletRequest http) {
    authorize(http);
    return ResponseEntity.ok(query.bySector(sectorId));
  }

  @GetMapping("/sectors/{sectorId}/elements/{elementId}")
  public ResponseEntity<SpaceElementResponse> getById(
      @PathVariable UUID sectorId, @PathVariable UUID elementId, HttpServletRequest http) {
    authorize(http);
    return ResponseEntity.ok(query.byId(sectorId, elementId));
  }

  @PutMapping("/sectors/{sectorId}/elements/{elementId}")
  public ResponseEntity<SpaceElementResponse> update(
      @PathVariable UUID sectorId,
      @PathVariable UUID elementId,
      @RequestBody JsonNode body, HttpServletRequest http) {
    authorize(http);
    validateMetadata(body);
    var request = mapper.treeToValue(body, UpdateSpaceElementRequest.class);
    SpaceElementResponse response =
        update.update(
            new UpdateSpaceElementCommand(
                sectorId, elementId, request.type(), request.x(), request.y(), request.width(), request.height(), request.rotation(),
                body.has("label"), body.hasNonNull("label") ? body.get("label").asString() : null,
                body.has("capacity"), body.hasNonNull("capacity") ? body.get("capacity").intValue() : null));
    return ResponseEntity.ok(response);
  }

  /** HU-4.01: baja lógica del elemento; 409 si tiene reservas activas (RN-1). */
  @DeleteMapping("/sectors/{sectorId}/elements/{elementId}")
  public ResponseEntity<Void> delete(
      @PathVariable UUID sectorId, @PathVariable UUID elementId, HttpServletRequest http) {
    authorize(http);
    query.byId(sectorId, elementId);
    deleteElement.delete(sectorId, elementId);
    return ResponseEntity.noContent().build();
  }

  private void authorize(HttpServletRequest request) {
    if (request.getUserPrincipal() == null || actors.currentUserId().isEmpty()) throw new ResponseStatusException(HttpStatus.UNAUTHORIZED);
    if (!request.isUserInRole("ADMIN") && !request.isUserInRole("MANAGER")) throw new ResponseStatusException(HttpStatus.FORBIDDEN);
  }

  private void validateMetadata(JsonNode body) {
    if (!body.isObject()) throw new IllegalArgumentException("Se requiere objeto JSON");
    if (body.hasNonNull("label") && !body.get("label").isString()) throw new IllegalArgumentException("Label debe ser texto");
    if (body.hasNonNull("capacity") && (!body.get("capacity").isIntegralNumber()
        || !body.get("capacity").canConvertToInt() || body.get("capacity").intValue() <= 0)) {
      throw new IllegalArgumentException("Capacidad debe ser entero positivo");
    }
  }

  @ExceptionHandler(SpaceElementHasActiveReservationsException.class)
  ResponseEntity<ProblemDetail> handleHasReservations(
      SpaceElementHasActiveReservationsException ex) {
    ProblemDetail problem =
        ProblemDetail.forStatusAndDetail(HttpStatus.CONFLICT, ex.getMessage());
    problem.setTitle("El elemento tiene reservas activas");
    problem.setType(URI.create(SpacesProblemTypes.ELEMENT_HAS_ACTIVE_RESERVATIONS));
    return ResponseEntity.status(HttpStatus.CONFLICT).body(problem);
  }

  @ExceptionHandler(SpaceElementNotFoundException.class)
  ResponseEntity<ProblemDetail> handleElementNotFound(SpaceElementNotFoundException ex) {
    ProblemDetail problem =
        ProblemDetail.forStatusAndDetail(HttpStatus.NOT_FOUND, ex.getMessage());
    problem.setTitle("Elemento espacial no encontrado");
    problem.setType(URI.create(SpacesProblemTypes.RESOURCE_NOT_FOUND));
    return ResponseEntity.status(HttpStatus.NOT_FOUND).body(problem);
  }

  @ExceptionHandler(SectorNotFoundException.class)
  ResponseEntity<ProblemDetail> handleSectorNotFound(SectorNotFoundException ex) {
    ProblemDetail problem =
        ProblemDetail.forStatusAndDetail(HttpStatus.NOT_FOUND, ex.getMessage());
    problem.setTitle("Sector no encontrado");
    problem.setType(URI.create(SpacesProblemTypes.RESOURCE_NOT_FOUND));
    return ResponseEntity.status(HttpStatus.NOT_FOUND).body(problem);
  }

  @ExceptionHandler(InvalidElementTypeForVerticalException.class)
  ResponseEntity<ProblemDetail> handleTipoIncompatible(InvalidElementTypeForVerticalException ex) {
    ProblemDetail problem =
        ProblemDetail.forStatusAndDetail(HttpStatus.BAD_REQUEST, ex.getMessage());
    problem.setTitle("Tipo de elemento no permitido");
    problem.setType(URI.create(SpacesProblemTypes.INVALID_INPUT));
    return ResponseEntity.badRequest().body(problem);
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
