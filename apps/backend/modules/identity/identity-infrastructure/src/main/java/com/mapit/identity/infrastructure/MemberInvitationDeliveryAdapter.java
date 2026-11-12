package com.mapit.identity.infrastructure;

import java.util.UUID;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.mail.MailAuthenticationException;
import org.springframework.stereotype.Component;

import com.mapit.identity.domain.MemberInvitationDelivery;
import com.mapit.shared.invitation.MemberInvitationMail;
import com.mapit.shared.tenant.TenantId;

/** SMTP tras commit: un fallo conserva la invitación y no confunde SMTP con entrega. */
@Component
class MemberInvitationDeliveryAdapter implements MemberInvitationDelivery {
  private static final Logger LOG = LoggerFactory.getLogger(MemberInvitationDeliveryAdapter.class);
  private final MemberInvitationMail mail;
  private final JdbcMemberInvitationDispatch dispatch;

  MemberInvitationDeliveryAdapter(MemberInvitationMail mail, JdbcMemberInvitationDispatch dispatch) {
    this.mail = mail;
    this.dispatch = dispatch;
  }

  @Override
  public Status deliver(TenantId tenant, UUID id, String tenantName, String email, String url) {
    // No se envía si la fila dejó de estar vigente antes de iniciar SMTP.
    try {
      if (!dispatch.start(tenant, id)) return Status.UNKNOWN;
    } catch (RuntimeException exception) {
      logFailure(exception);
      return Status.UNKNOWN;
    }
    Status status;
    try {
      mail.send(tenantName, email, url);
      status = Status.SMTP_ACCEPTED;
    } catch (RuntimeException exception) {
      logFailure(exception);
      status = exception instanceof MailAuthenticationException ? Status.SMTP_FAILED : Status.UNKNOWN;
    }
    try {
      dispatch.finish(tenant, id, status);
    } catch (RuntimeException exception) {
      logFailure(exception);
      return Status.UNKNOWN;
    }
    return status;
  }

  private static void logFailure(RuntimeException exception) {
    LOG.atWarn().addKeyValue("event", "invitation.dispatch.failed")
        .addKeyValue("error_type", exception.getClass().getName())
        .log("Member invitation transport or status update failed");
  }
}
