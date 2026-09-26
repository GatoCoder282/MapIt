package com.mapit.operations.infrastructure.state;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;

import com.mapit.operations.application.state.ListSpaceElementStateChanges;
import com.mapit.operations.application.state.UpdateSpaceElementState;
import com.mapit.operations.domain.state.InvalidSpaceElementStateTransitionException;
import com.mapit.shared.realtime.SpaceElementState;

class SpaceElementStateControllerTest {

  @Test
  void traduce_una_transicion_invalida_a_problem_details_409() {
    SpaceElementStateController controller =
        new SpaceElementStateController(
            mock(UpdateSpaceElementState.class), mock(ListSpaceElementStateChanges.class));

    var response =
        controller.handleInvalidTransition(
            new InvalidSpaceElementStateTransitionException(
                SpaceElementState.OUT_OF_SERVICE, SpaceElementState.RESERVED));

    assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
    assertThat(response.getBody()).isNotNull();
    assertThat(response.getBody().getTitle()).isEqualTo("Transición de estado no permitida");
    assertThat(response.getBody().getProperties())
        .containsEntry("currentState", SpaceElementState.OUT_OF_SERVICE)
        .containsEntry("requestedState", SpaceElementState.RESERVED);
  }
}
