package com.mapit.platform.application;

/** La solicitud fue decidida en otro sentido o aún no reúne los requisitos. */
public final class BusinessApplicationDecisionConflict extends RuntimeException {
  public BusinessApplicationDecisionConflict(String message) {
    super(message);
  }
}
