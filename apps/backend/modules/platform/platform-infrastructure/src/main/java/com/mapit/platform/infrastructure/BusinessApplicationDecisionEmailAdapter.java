package com.mapit.platform.infrastructure;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Component;

import com.mapit.platform.domain.BusinessApplicationDecisionEmailPort;
import com.mapit.platform.domain.BusinessApplicationStatus;

/** Correo de resultado con contenido mínimo, sin motivo interno ni tokens. */
@Component
class BusinessApplicationDecisionEmailAdapter implements BusinessApplicationDecisionEmailPort {
  private static final Logger LOG = LoggerFactory.getLogger(BusinessApplicationDecisionEmailAdapter.class);
  private final JavaMailSender mail;
  private final String sender;

  BusinessApplicationDecisionEmailAdapter(JavaMailSender mail,
      @Value("${mapit.mail.from:no-reply@mapit.local}") String sender) {
    this.mail = mail;
    this.sender = sender;
  }

  @Override
  public void send(String email, String businessName, BusinessApplicationStatus status) {
    if (status == BusinessApplicationStatus.PENDING) {
      throw new IllegalArgumentException("Solo se notifican decisiones finales");
    }
    SimpleMailMessage message = new SimpleMailMessage();
    message.setFrom(sender);
    message.setTo(email);
    message.setSubject("Resultado de tu solicitud de incorporación a MapIt");
    message.setText(status == BusinessApplicationStatus.APPROVED
        ? "La solicitud de \"" + businessName + "\" fue aprobada. Recibirás por separado la invitación para activar la cuenta administradora.\n"
        : "La solicitud de \"" + businessName + "\" fue rechazada. Puedes contactar al equipo de MapIt para más información.\n");
    try {
      mail.send(message);
    } catch (RuntimeException failure) {
      LOG.atWarn().addKeyValue("event", "business_application.decision_delivery_failed")
          .addKeyValue("error_type", failure.getClass().getName())
          .log("No se entregó el resultado de incorporación");
    }
  }
}
