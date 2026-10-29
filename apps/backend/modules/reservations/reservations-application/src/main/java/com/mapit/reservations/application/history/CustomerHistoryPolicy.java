package com.mapit.reservations.application.history;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/** Valores de política centralizados y configurables por despliegue. */
@Component
public class CustomerHistoryPolicy {
  private final int linkMinutes;
  private final int sessionMinutes;
  private final int windowMinutes;
  private final int personLimit;
  private final int ipLimit;

  public CustomerHistoryPolicy(
      @Value("${mapit.customer-history.link-ttl-minutes:15}") int linkMinutes,
      @Value("${mapit.customer-history.session-ttl-minutes:30}") int sessionMinutes,
      @Value("${mapit.customer-history.window-minutes:15}") int windowMinutes,
      @Value("${mapit.customer-history.person-limit:3}") int personLimit,
      @Value("${mapit.customer-history.ip-limit:10}") int ipLimit) {
    if (linkMinutes < 1 || sessionMinutes < 1 || windowMinutes < 1 || personLimit < 1 || ipLimit < 1) {
      throw new IllegalArgumentException("Customer history limits must be positive");
    }
    this.linkMinutes = linkMinutes;
    this.sessionMinutes = sessionMinutes;
    this.windowMinutes = windowMinutes;
    this.personLimit = personLimit;
    this.ipLimit = ipLimit;
  }

  public int linkMinutes() { return linkMinutes; }
  public int sessionMinutes() { return sessionMinutes; }
  public int windowMinutes() { return windowMinutes; }
  public int personLimit() { return personLimit; }
  public int ipLimit() { return ipLimit; }
}
