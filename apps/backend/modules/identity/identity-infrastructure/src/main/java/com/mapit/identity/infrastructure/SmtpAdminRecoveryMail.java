package com.mapit.identity.infrastructure;

import java.net.URI;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Component;

import com.mapit.identity.domain.AdminRecoveryMail;

@Component
class SmtpAdminRecoveryMail implements AdminRecoveryMail {
  private final JavaMailSender mail;
  private final String sender;
  private final String publicUrl;

  SmtpAdminRecoveryMail(JavaMailSender mail,
      @Value("${mapit.mail.from:no-reply@mapit.local}") String sender,
      @Value("${mapit.public-web-url:http://localhost:4300}") String publicUrl) {
    this.mail = mail;
    this.sender = sender;
    this.publicUrl = publicUrl;
  }

  @Override
  public void send(String email, String tenantSlug, String token) {
    URI base = URI.create(publicUrl);
    if (!"https".equalsIgnoreCase(base.getScheme())
        && !("http".equalsIgnoreCase(base.getScheme())
            && ("localhost".equalsIgnoreCase(base.getHost())
                || "127.0.0.1".equals(base.getHost())))) {
      throw new IllegalStateException("La recuperación requiere URL pública HTTPS");
    }
    String url = publicUrl + "/activar?tenant="
        + URLEncoder.encode(tenantSlug, StandardCharsets.UTF_8)
        + "&token=" + URLEncoder.encode(token, StandardCharsets.UTF_8);
    SimpleMailMessage message = new SimpleMailMessage();
    message.setFrom(sender);
    message.setTo(email);
    message.setSubject("Recupera tu acceso ADMIN a MapIt");
    message.setText("Se solicitó recuperar tu cuenta ADMIN de MapIt.\n\n"
        + "Abre este enlace y establece personalmente una contraseña nueva:\n" + url
        + "\n\nEl enlace vence en 15 minutos o antes si vence la aprobación. "
        + "No lo compartas. Si no solicitaste la recuperación, informa a plataforma.");
    mail.send(message);
  }
}
