package com.mapit.operations.domain.state;

import java.util.EnumMap;
import java.util.Map;
import java.util.Set;

import com.mapit.shared.realtime.SpaceElementState;

/** Máquina de estados única para la operación diaria de elementos espaciales. */
public final class SpaceElementStateMachine {

  private static final Map<SpaceElementState, Set<SpaceElementState>> ALLOWED = allowedTransitions();

  private SpaceElementStateMachine() {}

  public static boolean allows(SpaceElementState current, SpaceElementState requested) {
    return current == requested || ALLOWED.get(current).contains(requested);
  }

  public static void requireAllowed(
      SpaceElementState current, SpaceElementState requested) {
    if (!allows(current, requested)) {
      throw new InvalidSpaceElementStateTransitionException(current, requested);
    }
  }

  public static Set<SpaceElementState> destinationsFrom(SpaceElementState current) {
    return ALLOWED.get(current);
  }

  private static Map<SpaceElementState, Set<SpaceElementState>> allowedTransitions() {
    EnumMap<SpaceElementState, Set<SpaceElementState>> transitions =
        new EnumMap<>(SpaceElementState.class);
    transitions.put(
        SpaceElementState.AVAILABLE,
        Set.of(
            SpaceElementState.OCCUPIED,
            SpaceElementState.RESERVED,
            SpaceElementState.OUT_OF_SERVICE));
    transitions.put(
        SpaceElementState.RESERVED,
        Set.of(
            SpaceElementState.AVAILABLE,
            SpaceElementState.OCCUPIED,
            SpaceElementState.OUT_OF_SERVICE));
    transitions.put(
        SpaceElementState.OCCUPIED,
        Set.of(
            SpaceElementState.AVAILABLE,
            SpaceElementState.CLEANING,
            SpaceElementState.OUT_OF_SERVICE));
    transitions.put(
        SpaceElementState.CLEANING,
        Set.of(SpaceElementState.AVAILABLE, SpaceElementState.OUT_OF_SERVICE));
    transitions.put(
        SpaceElementState.OUT_OF_SERVICE, Set.of(SpaceElementState.AVAILABLE));
    return Map.copyOf(transitions);
  }
}
