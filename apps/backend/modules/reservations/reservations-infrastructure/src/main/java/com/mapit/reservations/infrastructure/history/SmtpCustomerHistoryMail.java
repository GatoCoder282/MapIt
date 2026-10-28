package com.mapit.reservations.infrastructure.history;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Component;

import com.mapit.reservations.domain.history.CustomerHistoryMail;

@Component
class SmtpCustomerHistoryMail implements CustomerHistoryMail {
  private static final Logger LOG = LoggerFactory.getLogger(SmtpCustomerHistoryMail.class);
  private final JavaMailSender sender;
  private final String from;

  SmtpCustomerHistoryMail(JavaMailSender sender,
      @Value("${mapit.mail.from:no-reply@mapit.local}") String from) {
    this.sender = sender;
    this.from = from;
  }

  @Override
  public void send(String email, String link) {
    SimpleMailMessage message = new SimpleMailMessage();
    message.setFrom(from);
    message.setTo(email);
    message.setSubject("Acceso a mis reservas - MapIt");
    message.setText("Para consultar tus reservas, abre este enlace de un solo uso:\n" + link
        + "\nSi no solicitaste el acceso, ignora este mensaje.");
    try {
      sender.send(message);
    } catch (RuntimeException exception) {
      LOG.atWarn().addKeyValue("event", "customer_history.mail_failed")
          .addKeyValue("error_type", exception.getClass().getName())
          .log("History link delivery failed");
    }
  }
}
