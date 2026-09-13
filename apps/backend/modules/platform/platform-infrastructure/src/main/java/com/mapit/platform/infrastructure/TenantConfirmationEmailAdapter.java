package com.mapit.platform.infrastructure;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Component;

import com.mapit.platform.domain.Tenant;
import com.mapit.platform.domain.TenantConfirmationEmailPort;

/** Adaptador SMTP; en desarrollo el correo es capturado por Mailpit. */
@Component
class TenantConfirmationEmailAdapter implements TenantConfirmationEmailPort {

  private final JavaMailSender mailSender;
  private final String sender;

  TenantConfirmationEmailAdapter(
      JavaMailSender mailSender,
      @Value("${mapit.mail.from:no-reply@mapit.local}") String sender) {
    this.mailSender = mailSender;
    this.sender = sender;
  }

  @Override
  public void send(Tenant tenant, String recipient) {
    SimpleMailMessage message = new SimpleMailMessage();
    message.setFrom(sender);
    message.setTo(recipient);
    message.setSubject("Confirmación de registro de Tenant en MapIt");
    message.setText(
        "Se registró la organización "
            + tenant.name()
            + " con el identificador "
            + tenant.id()
            + ".\n\n"
            + "Vertical: "
            + tenant.vertical()
            + "\n"
            + "Slug: "
            + tenant.slug());
    mailSender.send(message);
  }
}
