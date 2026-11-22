package com.mapit.identity.infrastructure;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.mockito.ArgumentCaptor;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.JavaMailSenderImpl;

class SmtpAdminRecoveryMailTest {
  @Test
  void entrega_enlace_al_correo_del_destinatario_sin_contrasena() {
    JavaMailSender mail = mock(JavaMailSender.class);
    var adapter = new SmtpAdminRecoveryMail(mail, "no-reply@mapit.local",
        "https://mapit.example");
    adapter.send("admin@tenant.test", "tenant-a", "recover.secret");
    ArgumentCaptor<SimpleMailMessage> captured = ArgumentCaptor.forClass(SimpleMailMessage.class);
    verify(mail).send(captured.capture());
    assertThat(captured.getValue().getTo()).containsExactly("admin@tenant.test");
    assertThat(captured.getValue().getText()).contains(
        "https://mapit.example/activar?tenant=tenant-a&token=recover.secret");
    assertThat(captured.getValue().getText()).doesNotContain("password=");
  }

  @Test
  void rechaza_enlace_http_fuera_de_localhost() {
    JavaMailSender mail = mock(JavaMailSender.class);
    var adapter = new SmtpAdminRecoveryMail(mail, "no-reply@mapit.local",
        "http://mapit.example");
    assertThatThrownBy(() -> adapter.send("admin@tenant.test", "tenant-a", "recover.secret"))
        .isInstanceOf(IllegalStateException.class);
    verifyNoInteractions(mail);
  }

  @Test
  @EnabledIfEnvironmentVariable(named = "MAPIT_MAILPIT_SMOKE", matches = "true")
  void entrega_ficticia_en_mailpit_local() throws Exception {
    var sender = new JavaMailSenderImpl();
    sender.setHost("localhost");
    sender.setPort(1025);
    String recipient = "ca05-" + UUID.randomUUID() + "@invalid.test";
    new SmtpAdminRecoveryMail(sender, "no-reply@mapit.local", "http://localhost:4300")
        .send(recipient, "tenant-prueba", "recover.test-only");

    var request = HttpRequest.newBuilder(URI.create("http://localhost:8025/api/v1/messages"))
        .GET().build();
    var response = HttpClient.newHttpClient().send(request, HttpResponse.BodyHandlers.ofString());
    assertThat(response.statusCode()).isEqualTo(200);
    assertThat(response.body()).contains(recipient);
  }
}
