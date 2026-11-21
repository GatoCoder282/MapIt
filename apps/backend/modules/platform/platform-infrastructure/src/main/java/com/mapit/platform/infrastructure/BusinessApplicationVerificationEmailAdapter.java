package com.mapit.platform.infrastructure;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Component;

import com.mapit.platform.domain.BusinessApplicationVerificationEmailPort;

/** Envía el token solo al correo del solicitante, nunca a la respuesta HTTP. */
@Component
class BusinessApplicationVerificationEmailAdapter implements BusinessApplicationVerificationEmailPort {

  private static final Logger LOG = LoggerFactory.getLogger(BusinessApplicationVerificationEmailAdapter.class);

  private final JavaMailSender mail;
  private final String sender;

  BusinessApplicationVerificationEmailAdapter(
      JavaMailSender mail,
      @Value("${mapit.mail.from:no-reply@mapit.local}") String sender) {
    this.mail = mail;
    this.sender = sender;
  }

  @Override
  public void send(String email, String businessName, String verificationUrl) {
    SimpleMailMessage message = new SimpleMailMessage();
    message.setFrom(sender);
    message.setTo(email);
    message.setSubject("Verifica tu solicitud de incorporación a MapIt");
    message.setText(
        "Recibimos una solicitud para incorporar \"" + businessName + "\" a MapIt.\n\n"
            + "Verifica el correo de contacto abriendo este enlace (válido por 24 horas):\n"
            + verificationUrl + "\n\n"
            + "Si no hiciste esta solicitud, ignora este mensaje.\n");
    try {
      mail.send(message);
    } catch (RuntimeException failure) {
      // El siguiente envío, sujeto al mismo rate limit, renueva el token.
      LOG.atWarn().addKeyValue("event", "business_application.verification_delivery_failed")
          .addKeyValue("error_type", failure.getClass().getName())
          .log("No se entregó la verificación de incorporación");
    }
  }
}
