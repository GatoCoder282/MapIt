package com.mapit.spaces.infrastructure;

import java.net.URI;
import java.util.List;
import java.util.UUID;

import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.mapit.spaces.application.CreateSpaceElementCommand;
import com.mapit.spaces.application.CreateSpaceElementUseCase;
import com.mapit.spaces.application.InvalidElementTypeForVerticalException;
import com.mapit.spaces.application.SectorNotFoundException;
import com.mapit.spaces.application.SpaceElementNotFoundException;
import com.mapit.spaces.application.SpaceElementQueryService;
import com.mapit.spaces.application.SpaceElementResponse;
import com.mapit.spaces.application.UpdateSpaceElementCommand;
import com.mapit.spaces.application.UpdateSpaceElementUseCase;

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

  private final CreateSpaceElementUseCase create;
  private final UpdateSpaceElementUseCase update;
  private final SpaceElementQueryService query;

  public SpaceElementController(
      CreateSpaceElementUseCase create,
      UpdateSpaceElementUseCase update,
      SpaceElementQueryService query) {
    this.create = create;
    this.update = update;
    this.query = query;
  }

  /** Body de POST /sectors/{sectorId}/elements. Tenant y sectorId van por contexto/path. */
  public record CreateSpaceElementRequest(
      String type, Double x, Double y, String initialState) {}

  /** Body de PUT …/elements/{elementId}: reemplazo completo de los editables. */
  public record UpdateSpaceElementRequest(String type, Double x, Double y) {}

  @PostMapping("/sectors/{sectorId}/elements")
  public ResponseEntity<SpaceElementResponse> create(
      @PathVariable UUID sectorId, @RequestBody CreateSpaceElementRequest request) {
    SpaceElementResponse response =
        create.create(
            new CreateSpaceElementCommand(
                sectorId, request.type(), request.x(), request.y(), request.initialState()));
    return ResponseEntity.status(HttpStatus.CREATED).body(response);
  }

  @GetMapping("/sectors/{sectorId}/elements")
  public ResponseEntity<List<SpaceElementResponse>> getBySector(@PathVariable UUID sectorId) {
    return ResponseEntity.ok(query.bySector(sectorId));
  }

  @GetMapping("/sectors/{sectorId}/elements/{elementId}")
  public ResponseEntity<SpaceElementResponse> getById(
      @PathVariable UUID sectorId, @PathVariable UUID elementId) {
    return ResponseEntity.ok(query.byId(sectorId, elementId));
  }

  @PutMapping("/sectors/{sectorId}/elements/{elementId}")
  public ResponseEntity<SpaceElementResponse> update(
      @PathVariable UUID sectorId,
      @PathVariable UUID elementId,
      @RequestBody UpdateSpaceElementRequest request) {
    SpaceElementResponse response =
        update.update(
            new UpdateSpaceElementCommand(
                sectorId, elementId, request.type(), request.x(), request.y()));
    return ResponseEntity.ok(response);
  }

  @ExceptionHandler(SpaceElementNotFoundException.class)
  ResponseEntity<ProblemDetail> handleElementNotFound(SpaceElementNotFoundException ex) {
    ProblemDetail problem =
        ProblemDetail.forStatusAndDetail(HttpStatus.NOT_FOUND, ex.getMessage());
    problem.setTitle("Elemento espacial no encontrado");
    problem.setType(URI.create("https://mapit.local/problems/resource-not-found"));
    return ResponseEntity.status(HttpStatus.NOT_FOUND).body(problem);
  }

  @ExceptionHandler(SectorNotFoundException.class)
  ResponseEntity<ProblemDetail> handleSectorNotFound(SectorNotFoundException ex) {
    ProblemDetail problem =
        ProblemDetail.forStatusAndDetail(HttpStatus.NOT_FOUND, ex.getMessage());
    problem.setTitle("Sector no encontrado");
    problem.setType(URI.create("https://mapit.local/problems/resource-not-found"));
    return ResponseEntity.status(HttpStatus.NOT_FOUND).body(problem);
  }

  @ExceptionHandler(InvalidElementTypeForVerticalException.class)
  ResponseEntity<ProblemDetail> handleTipoIncompatible(InvalidElementTypeForVerticalException ex) {
    ProblemDetail problem =
        ProblemDetail.forStatusAndDetail(HttpStatus.BAD_REQUEST, ex.getMessage());
    problem.setTitle("Tipo de elemento no permitido");
    problem.setType(URI.create("https://mapit.local/problems/invalid-input"));
    return ResponseEntity.badRequest().body(problem);
  }

  @ExceptionHandler(IllegalArgumentException.class)
  ResponseEntity<ProblemDetail> handleBadRequest(IllegalArgumentException ex) {
    ProblemDetail problem =
        ProblemDetail.forStatusAndDetail(HttpStatus.BAD_REQUEST, ex.getMessage());
    problem.setTitle("Datos inválidos");
    problem.setType(URI.create("https://mapit.local/problems/invalid-input"));
    return ResponseEntity.badRequest().body(problem);
  }
}
