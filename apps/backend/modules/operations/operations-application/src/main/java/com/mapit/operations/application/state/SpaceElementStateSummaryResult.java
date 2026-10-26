package com.mapit.operations.application.state;

import java.util.EnumMap;
import java.util.Map;

import com.mapit.shared.realtime.SpaceElementState;

/**
 * Proyección agregada de los estados operativos del tenant.
 *
 * <p>Las cinco claves de estado están siempre presentes (0 cuando no hay elementos
 * en ese estado) para que el cliente nunca trate claves ausentes.
 */
public record SpaceElementStateSummaryResult(int total, Map<SpaceElementState, Integer> byState) {

  static SpaceElementStateSummaryResult from(Map<SpaceElementState, Long> counts) {
    Map<SpaceElementState, Integer> byState = new EnumMap<>(SpaceElementState.class);
    long total = 0;
    for (SpaceElementState state : SpaceElementState.values()) {
      long count = counts.getOrDefault(state, 0L);
      byState.put(state, Math.toIntExact(count));
      total += count;
    }
    return new SpaceElementStateSummaryResult(Math.toIntExact(total), byState);
  }
}
