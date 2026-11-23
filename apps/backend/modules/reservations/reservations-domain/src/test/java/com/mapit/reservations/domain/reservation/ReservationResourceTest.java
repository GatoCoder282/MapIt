package com.mapit.reservations.domain.reservation;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Instant;
import java.util.UUID;

import org.junit.jupiter.api.Test;

import com.mapit.shared.vertical.Vertical;

class ReservationResourceTest {
  private static ReservationResource resource(Vertical vertical, ReservationResource.Kind kind) {
    return new ReservationResource(UUID.randomUUID(), UUID.randomUUID(), kind,
        ReservationResource.OperationalState.AVAILABLE, null, vertical, "America/La_Paz");
  }

  private static ReservationTimeRange range(String start, String end) {
    return ReservationTimeRange.of(Instant.parse(start), Instant.parse(end));
  }

  @Test
  void reservabilityUsesTheEstablishmentProfile() {
    assertThat(resource(Vertical.EVENT_HALL, ReservationResource.Kind.STAGE).isReservable()).isFalse();
    assertThat(resource(Vertical.HOTEL, ReservationResource.Kind.TABLE).isReservable()).isFalse();
    assertThat(resource(Vertical.HOTEL, ReservationResource.Kind.ROOM).isReservable()).isTrue();
    assertThat(resource(Vertical.EVENT_HALL, ReservationResource.Kind.SEAT).isReservable()).isTrue();
    var legacy = new ReservationResource(UUID.randomUUID(), UUID.randomUUID(),
        ReservationResource.Kind.STAGE, ReservationResource.OperationalState.AVAILABLE);
    assertThat(legacy.isReservable()).isFalse();
  }

  @Test
  void nightclubCanCrossMidnightWithinTwelveHours() {
    var nightclub = resource(Vertical.NIGHTCLUB, ReservationResource.Kind.TABLE);
    assertThatCode(() -> nightclub.validateBookingRange(range(
        "2026-11-23T02:00:00Z", "2026-11-23T10:00:00Z"))).doesNotThrowAnyException();
    assertThatThrownBy(() -> nightclub.validateBookingRange(range(
        "2026-11-23T02:00:00Z", "2026-11-23T15:00:00Z")))
        .isInstanceOf(IllegalArgumentException.class);
  }

  @Test
  void restaurantUsesLocalDateAndSixHourLimit() {
    var restaurant = resource(Vertical.RESTAURANT, ReservationResource.Kind.TABLE);
    assertThatCode(() -> restaurant.validateBookingRange(range(
        "2026-11-23T02:00:00Z", "2026-11-23T03:00:00Z"))).doesNotThrowAnyException();
    assertThatThrownBy(() -> restaurant.validateBookingRange(range(
        "2026-11-23T03:00:00Z", "2026-11-23T05:00:00Z")))
        .isInstanceOf(IllegalArgumentException.class);
    assertThatThrownBy(() -> restaurant.validateBookingRange(range(
        "2026-11-23T14:00:00Z", "2026-11-23T21:00:00Z")))
        .isInstanceOf(IllegalArgumentException.class);
  }

  @Test
  void hotelCountsLocalNightsRatherThanHours() {
    var room = resource(Vertical.HOTEL, ReservationResource.Kind.ROOM);
    assertThatCode(() -> room.validateBookingRange(range(
        "2026-11-23T19:00:00Z", "2026-11-24T16:00:00Z"))).doesNotThrowAnyException();
    assertThatThrownBy(() -> room.validateBookingRange(range(
        "2026-11-23T19:00:00Z", "2026-11-23T23:00:00Z")))
        .isInstanceOf(IllegalArgumentException.class);
    assertThatThrownBy(() -> room.validateBookingRange(range(
        "2026-11-23T19:00:00Z", "2026-12-24T16:00:00Z")))
        .isInstanceOf(IllegalArgumentException.class);
  }
}
