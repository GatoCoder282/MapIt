package com.mapit.spaces.infrastructure.establishment;

import java.util.List;
import java.util.UUID;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;

import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.mapit.spaces.application.establishment.EstablishmentAccessService;
import com.mapit.spaces.domain.establishment.EstablishmentAccessRepository.AccessibleEstablishment;
import com.mapit.spaces.domain.establishment.EstablishmentAccessRepository.StaffAccess;

@RestController
@RequestMapping("/api/v1/establishments")
public class EstablishmentAccessController {
  private final EstablishmentAccessService service;
  public EstablishmentAccessController(EstablishmentAccessService service){this.service=service;}
  @GetMapping("/accessible")
  public ResponseEntity<List<AccessibleEstablishment>> accessible(){return response(service.accessible());}
  @GetMapping("/{establishmentId}/staff-access")
  public ResponseEntity<List<StaffAccess>> staff(@PathVariable UUID establishmentId){return response(service.staff(establishmentId));}
  @PutMapping("/{establishmentId}/staff-access/{userId}")
  public ResponseEntity<StaffAccess> grant(@PathVariable UUID establishmentId,@PathVariable UUID userId,@Valid @RequestBody Write request){
    return response(service.grant(establishmentId,userId,request.canCheckIn()));
  }
  @ExceptionHandler(EstablishmentAccessService.NotFound.class)
  public ResponseEntity<ProblemDetail> missing(){
    ProblemDetail problem=ProblemDetail.forStatusAndDetail(HttpStatus.NOT_FOUND,"Establecimiento o personal no disponible");
    problem.setType(java.net.URI.create("https://mapit.dev/problems/establishment-access-not-found"));
    return ResponseEntity.status(HttpStatus.NOT_FOUND).cacheControl(CacheControl.noStore()).body(problem);
  }
  private <T> ResponseEntity<T> response(T value){return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(value);}
  public record Write(@NotNull Boolean canCheckIn){}
}
