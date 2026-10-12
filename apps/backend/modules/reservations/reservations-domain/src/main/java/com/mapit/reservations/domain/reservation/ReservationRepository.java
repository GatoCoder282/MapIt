package com.mapit.reservations.domain.reservation;

/** Puerto para guardar una reserva y todas sus asociaciones de forma atómica. */
public interface ReservationRepository {

  Reservation save(Reservation reservation);
}
