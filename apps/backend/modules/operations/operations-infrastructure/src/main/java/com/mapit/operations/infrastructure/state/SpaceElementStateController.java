package com.mapit.operations.infrastructure.state;

import java.net.URI;
import java.util.List;
import java.util.UUID;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;

import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.mapit.operations.application.state.ListSpaceElementStateChanges;
import com.mapit.operations.application.state.OperationalSpaceElementNotFoundException;
import com.mapit.operations.application.state.SpaceElementStateChangeResult;
import com.mapit.operations.application.state.SpaceElementStateResult;
import com.mapit.operations.application.state.UpdateSpaceElementState;
import com.mapit.operations.application.state.UpdateSpaceElementStateCommand;
import com.mapit.shared.realtime.SpaceElementState;

/** Adaptador REST de MAP-124; tenant y permisos se resuelven en el servidor. */
@RestController
@RequestMapping("/api/v1")
public class SpaceElementStateController {

  private static final String RESOURCE_NOT_FOUND =
      "https://mapit.local/problems/resource-not-found";

  private final UpdateSpaceElementState updateState;
  private final ListSpaceElementStateChanges listChanges;

  public SpaceElementStateController(
      UpdateSpaceElementState updateState, ListSpaceElementStateChanges listChanges) {
    this.updateState = updateState;
    this.listChanges = listChanges;
  }

  public record StateRequest(@NotNull SpaceElementState state) {}

  @PatchMapping("/sectors/{sectorId}/elements/{elementId}/state")
  public ResponseEntity<SpaceElementStateResult> update(
      @PathVariable UUID sectorId,
      @PathVariable UUID elementId,
      @Valid @RequestBody StateRequest request) {
    return ResponseEntity.ok(
        updateState.execute(
            new UpdateSpaceElementStateCommand(sectorId, elementId, request.state())));
  }

  @GetMapping("/sectors/{sectorId}/elements/{elementId}/state-history")
  public ResponseEntity<List<SpaceElementStateChangeResult>> history(
      @PathVariable UUID sectorId, @PathVariable UUID elementId) {
    return ResponseEntity.ok(listChanges.execute(sectorId, elementId));
  }

  @ExceptionHandler(OperationalSpaceElementNotFoundException.class)
  ResponseEntity<ProblemDetail> handleNotFound(OperationalSpaceElementNotFoundException exception) {
    ProblemDetail problem =
        ProblemDetail.forStatusAndDetail(HttpStatus.NOT_FOUND, exception.getMessage());
    problem.setTitle("Elemento espacial no encontrado");
    problem.setType(URI.create(RESOURCE_NOT_FOUND));
    return ResponseEntity.status(HttpStatus.NOT_FOUND).body(problem);
  }
}
