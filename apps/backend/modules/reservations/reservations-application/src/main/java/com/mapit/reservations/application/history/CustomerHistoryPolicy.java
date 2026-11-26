package com.mapit.reservations.application.history;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import com.mapit.shared.settings.PlatformSetting;
import com.mapit.shared.settings.PlatformSettingOverrides;

/**
 * Valores de política centralizados y configurables por despliegue.
 *
 * <p>HU-7.07: la vigencia de enlaces y sesiones nuevos admite un valor guardado por el Super
 * Admin; la ventana y los límites anti abuso siguen siendo solo del despliegue.
 */
@Component
public class CustomerHistoryPolicy {
  private final int linkMinutes;
  private final int sessionMinutes;
  private final int windowMinutes;
  private final int personLimit;
  private final int ipLimit;
  private final PlatformSettingOverrides overrides;

  @Autowired
  public CustomerHistoryPolicy(
      @Value("${mapit.customer-history.link-ttl-minutes:15}") int linkMinutes,
      @Value("${mapit.customer-history.session-ttl-minutes:30}") int sessionMinutes,
      @Value("${mapit.customer-history.window-minutes:15}") int windowMinutes,
      @Value("${mapit.customer-history.person-limit:3}") int personLimit,
      @Value("${mapit.customer-history.ip-limit:10}") int ipLimit,
      PlatformSettingOverrides overrides) {
    if (linkMinutes < 1 || sessionMinutes < 1 || windowMinutes < 1 || personLimit < 1 || ipLimit < 1) {
      throw new IllegalArgumentException("Customer history limits must be positive");
    }
    this.linkMinutes = linkMinutes;
    this.sessionMinutes = sessionMinutes;
    this.windowMinutes = windowMinutes;
    this.personLimit = personLimit;
    this.ipLimit = ipLimit;
    this.overrides = overrides;
  }

  /** Solo con los valores del despliegue, sin cambios guardados. */
  public CustomerHistoryPolicy(
      int linkMinutes, int sessionMinutes, int windowMinutes, int personLimit, int ipLimit) {
    this(linkMinutes, sessionMinutes, windowMinutes, personLimit, ipLimit,
        setting -> java.util.OptionalInt.empty());
  }

  public int linkMinutes() {
    return overrides.override(PlatformSetting.CUSTOMER_HISTORY_LINK_TTL).orElse(linkMinutes);
  }

  public int sessionMinutes() {
    return overrides.override(PlatformSetting.CUSTOMER_HISTORY_SESSION_TTL).orElse(sessionMinutes);
  }

  public int windowMinutes() { return windowMinutes; }
  public int personLimit() { return personLimit; }
  public int ipLimit() { return ipLimit; }
}
