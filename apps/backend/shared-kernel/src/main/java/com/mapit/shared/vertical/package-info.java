/**
 * Catálogo de verticales (HU-7.01/7.02): la regla que spaces y reservations deben compartir.
 *
 * <p>Vive en el shared kernel y no en un módulo porque es lenguaje publicado entre dos
 * contextos: si el editor (spaces) y la reserva (reservations) tuvieran cada uno su copia, el
 * editor podría ofrecer un elemento que la reserva rechaza después.
 */
@org.jspecify.annotations.NullMarked
package com.mapit.shared.vertical;
