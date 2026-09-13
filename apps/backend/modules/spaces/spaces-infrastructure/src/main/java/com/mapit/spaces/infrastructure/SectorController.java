package com.mapit.spaces.infrastructure;

import java.util.List;
import java.util.UUID;

import org.springframework.http.HttpStatus;
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

import com.mapit.spaces.application.CreateSectorCommand;
import com.mapit.spaces.application.CreateSectorUseCase;
import com.mapit.spaces.application.DeleteSectorUseCase;
import com.mapit.spaces.application.GetSectorByIdUseCase;
import com.mapit.spaces.application.GetSectorsByFloorUseCase;
import com.mapit.spaces.application.SectorNotFoundException;
import com.mapit.spaces.application.SectorResponse;
import com.mapit.spaces.application.SectorSlugAlreadyExistsException;
import com.mapit.spaces.application.UpdateSectorCommand;
import com.mapit.spaces.application.UpdateSectorUseCase;

@RestController
@RequestMapping("/v1")
public class SectorController {

  private final CreateSectorUseCase createSectorUseCase;
  private final GetSectorsByFloorUseCase getSectorsByFloorUseCase;
  private final GetSectorByIdUseCase getSectorByIdUseCase;
  private final UpdateSectorUseCase updateSectorUseCase;
  private final DeleteSectorUseCase deleteSectorUseCase;

  public SectorController(
      CreateSectorUseCase createSectorUseCase,
      GetSectorsByFloorUseCase getSectorsByFloorUseCase,
      GetSectorByIdUseCase getSectorByIdUseCase,
      UpdateSectorUseCase updateSectorUseCase,
      DeleteSectorUseCase deleteSectorUseCase) {
    this.createSectorUseCase = createSectorUseCase;
    this.getSectorsByFloorUseCase = getSectorsByFloorUseCase;
    this.getSectorByIdUseCase = getSectorByIdUseCase;
    this.updateSectorUseCase = updateSectorUseCase;
    this.deleteSectorUseCase = deleteSectorUseCase;
  }

  public record CreateSectorRequest(String name, String slug, Integer maxCapacity) {}
  public record UpdateSectorRequest(String name, String slug, Integer maxCapacity) {}

  @PostMapping("/floors/{floorId}/sectors")
  public ResponseEntity<SectorResponse> create(
      @PathVariable UUID floorId,
      @RequestBody CreateSectorRequest request) {

    CreateSectorCommand command = new CreateSectorCommand(
        floorId,
        request.name(),
        request.slug(),
        request.maxCapacity()
    );
    SectorResponse response = createSectorUseCase.create(command);
    return ResponseEntity.status(HttpStatus.CREATED).body(response);
  }

  @GetMapping("/floors/{floorId}/sectors")
  public ResponseEntity<List<SectorResponse>> getByFloor(@PathVariable UUID floorId) {
    List<SectorResponse> response = getSectorsByFloorUseCase.byFloor(floorId);
    return ResponseEntity.ok(response);
  }

  @GetMapping("/sectors/{id}")
  public ResponseEntity<SectorResponse> getById(@PathVariable UUID id) {
    SectorResponse response = getSectorByIdUseCase.byId(id);
    return ResponseEntity.ok(response);
  }

  @PutMapping("/sectors/{id}")
  public ResponseEntity<SectorResponse> update(
      @PathVariable UUID id,
      @RequestBody UpdateSectorRequest request) {

    UpdateSectorCommand command = new UpdateSectorCommand(
        id,
        request.name(),
        request.slug(),
        request.maxCapacity()
    );
    SectorResponse response = updateSectorUseCase.update(command);
    return ResponseEntity.ok(response);
  }

  @DeleteMapping("/sectors/{id}")
  public ResponseEntity<Void> delete(@PathVariable UUID id) {
    deleteSectorUseCase.delete(id);
    return ResponseEntity.noContent().build();
  }

  @ExceptionHandler(SectorNotFoundException.class)
  public ResponseEntity<String> handleNotFound(SectorNotFoundException ex) {
    return ResponseEntity.status(HttpStatus.NOT_FOUND).body(ex.getMessage());
  }

  @ExceptionHandler(SectorSlugAlreadyExistsException.class)
  public ResponseEntity<String> handleConflict(SectorSlugAlreadyExistsException ex) {
    return ResponseEntity.status(HttpStatus.CONFLICT).body(ex.getMessage());
  }

  @ExceptionHandler(IllegalArgumentException.class)
  public ResponseEntity<String> handleBadRequest(IllegalArgumentException ex) {
    return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(ex.getMessage());
  }
}
