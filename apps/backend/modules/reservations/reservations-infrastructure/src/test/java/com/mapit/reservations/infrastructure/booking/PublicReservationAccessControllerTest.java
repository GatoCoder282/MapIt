package com.mapit.reservations.infrastructure.booking;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.client.RestTestClient;

import com.mapit.reservations.application.reservation.CreatePublicReservation;
import com.mapit.reservations.application.reservation.PublicReservationAccessService;
import com.mapit.reservations.domain.booking.PublicEstablishment;
import com.mapit.reservations.domain.booking.ReservationAccessRepository;
import com.mapit.reservations.domain.person.PersonId;
import com.mapit.reservations.domain.reservation.Reservation;
import com.mapit.reservations.domain.reservation.ReservationId;
import com.mapit.reservations.domain.reservation.ReservationTimeRange;
import com.mapit.shared.tenant.TenantId;

/** Verifica la frontera HTTP; autenticación, RLS y atomicidad requieren integración PostgreSQL. */
class PublicReservationAccessControllerTest {
  private static final TenantId TENANT=TenantId.of("tenant-a");
  private static final UUID VENUE=UUID.randomUUID();
  private static final UUID ELEMENT=UUID.randomUUID();
  private static final Instant NOW=Instant.parse("2026-10-25T12:00:00Z");

  @Test void entrega_capability_solo_en_creacion_sin_cache_ni_datos_personales() {
    CreatePublicReservation useCase=mock(CreatePublicReservation.class);
    String token="A".repeat(43);
    Reservation reservation=Reservation.create(ReservationId.generate(),TENANT,VENUE,
        PersonId.of(UUID.randomUUID()),List.of(ELEMENT),ReservationTimeRange.of(NOW.plusSeconds(60),NOW.plusSeconds(3600)),NOW,null);
    when(useCase.execute(any())).thenReturn(new CreatePublicReservation.Result(reservation,
        new PublicEstablishment(TENANT,VENUE,"UTC"),LocalDate.parse("2026-10-25"),LocalTime.NOON,
        LocalTime.of(13,0),new PublicReservationAccessService.IssuedAccess(token,NOW.plusSeconds(90000))));
    RestTestClient client=RestTestClient.bindToController(new PublicReservationController(useCase)).build();
    client.post().uri("/api/v1/public/tenants/tenant-a/establishments/venue/reservations")
        .contentType(MediaType.APPLICATION_JSON)
        .body(Map.of("date","2026-10-25","startTime","12:00","endTime","13:00",
            "spaceElementIds",List.of(ELEMENT),"customer",Map.of("fullName","Ana Pérez","email","ana@example.test")))
        .exchange().expectStatus().isCreated()
        .expectHeader().valueEquals("Cache-Control","no-store")
        .expectHeader().valueEquals("Referrer-Policy","no-referrer")
        .expectBody().jsonPath("$.accessToken").isEqualTo(token)
        .jsonPath("$.accessExpiresAt").isNotEmpty()
        .jsonPath("$.customer").doesNotExist()
        .jsonPath("$.personId").doesNotExist();
  }

  @Test void catalogo_devuelve_solo_datos_publicos_reales_del_puerto() {
    PublicReservationAccessService access=mock(PublicReservationAccessService.class);
    when(access.catalogue("Venue",null,20,0)).thenReturn(List.of(new ReservationAccessRepository.PublicVenue(
        VENUE,"Venue","RESTAURANT",null,"tenant-a","venue","UTC","Empresa")));
    RestTestClient client=RestTestClient.bindToController(new PublicEstablishmentCatalogueController(access)).build();
    client.get().uri("/api/v1/public/establishments?query=Venue").exchange().expectStatus().isOk()
        .expectBody().jsonPath("$[0].tenantSlug").isEqualTo("tenant-a")
        .jsonPath("$[0].establishmentSlug").isEqualTo("venue")
        .jsonPath("$[0].rating").doesNotExist()
        .jsonPath("$[0].tenantId").doesNotExist();
  }

  @Test void denegacion_y_ausencia_no_exponen_referencias_o_credenciales() {
    ReservationAccessProblemAdvice advice=new ReservationAccessProblemAdvice();
    assertThat(advice.notFound().getStatusCode().value()).isEqualTo(404);
    assertThat(advice.notFound().getHeaders().getCacheControl()).isEqualTo("no-store");
    assertThat(advice.notFound().getBody().getDetail()).isEqualTo("La reserva solicitada no está disponible");
    assertThat(advice.conflict().getStatusCode().value()).isEqualTo(409);
  }
  @Test void catalogo_respeta_empresa_paginacion_y_consulta_del_local(){
    PublicReservationAccessService access=mock(PublicReservationAccessService.class);
    var venue=new ReservationAccessRepository.PublicVenue(VENUE,"Norte","RESTAURANT","Avenida Norte","empresa","norte","UTC","Empresa Real");
    when(access.catalogue(null,"empresa",10,20)).thenReturn(List.of(venue));
    when(access.publicEstablishment("empresa","norte")).thenReturn(venue);
    when(access.catalogue(null,null,0,0)).thenThrow(new IllegalArgumentException());
    RestTestClient client=RestTestClient.bindToController(new PublicEstablishmentCatalogueController(access)).build();
    client.get().uri("/api/v1/public/establishments?tenantSlug=empresa&limit=10&offset=20").exchange().expectStatus().isOk().expectBody().jsonPath("$[0].tenantName").isEqualTo("Empresa Real");
    client.get().uri("/api/v1/public/tenants/empresa/establishments/norte").exchange().expectStatus().isOk().expectBody().jsonPath("$.establishmentSlug").isEqualTo("norte").jsonPath("$.address").isEqualTo("Avenida Norte");
    client.get().uri("/api/v1/public/establishments?limit=0").exchange().expectStatus().isBadRequest().expectHeader().valueEquals("Cache-Control","no-store");
  }
}
