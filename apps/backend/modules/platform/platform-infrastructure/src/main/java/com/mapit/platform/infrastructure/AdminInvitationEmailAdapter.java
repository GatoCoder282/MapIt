package com.mapit.platform.infrastructure;

import java.util.concurrent.atomic.AtomicBoolean;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Component;

import com.mapit.platform.domain.AdminInvitationEmailPort;
import com.mapit.platform.domain.Tenant;

/**
 * Envía la invitación del primer ADMIN (CU-25). En desarrollo, Mailpit captura
 * el correo: el enlace se puede abrir desde http://localhost:8025.
 */
@Component
class AdminInvitationEmailAdapter implements AdminInvitationEmailPort {

  private static final Logger LOG = LoggerFactory.getLogger(AdminInvitationEmailAdapter.class);
  private final AtomicBoolean degraded = new AtomicBoolean();
  private final JavaMailSender mailSender;
  private final String sender;

  AdminInvitationEmailAdapter(
      JavaMailSender mailSender,
      @Value("${mapit.mail.from:no-reply@mapit.local}") String sender) {
    this.mailSender = mailSender;
    this.sender = sender;
  }

  @Override
  public void send(Tenant tenant, String email, String activationUrl) {
    SimpleMailMessage message = new SimpleMailMessage();
    message.setFrom(sender);
    message.setTo(email);
    message.setSubject("Activa tu cuenta de MapIt");
    message.setText(
        "Hola,\n\n"
            + "Tu organización \"" + tenant.name() + "\" ya está registrada en MapIt.\n\n"
            + "Para activar tu cuenta y definir tu contraseña, abre este enlace (válido por 24 horas):\n"
            + activationUrl + "\n\n"
            + "Si no esperabas este correo, ignóralo: el token caduca solo.\n\n"
            + "— Equipo MapIt");
    try {
      mailSender.send(message);
      if (degraded.getAndSet(false)) {
        LOG.atInfo().addKeyValue("event", "integration.recovered").addKeyValue("integration", "smtp")
            .log("Mail transport recovered");
      }
    } catch (RuntimeException exception) {
      var log = degraded.getAndSet(true) ? LOG.atDebug() : LOG.atWarn();
      log.addKeyValue("event", "integration.failed").addKeyValue("integration", "smtp")
          .addKeyValue("error_type", exception.getClass().getName()).log("Invitation delivery failed");
      throw exception;
    }
  }
}
