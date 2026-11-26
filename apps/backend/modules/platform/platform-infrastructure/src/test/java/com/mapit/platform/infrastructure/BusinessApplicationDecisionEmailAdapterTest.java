package com.mapit.platform.infrastructure;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;

import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;

import com.mapit.platform.domain.BusinessApplicationStatus;

class BusinessApplicationDecisionEmailAdapterTest {
  @Test
  void mensajes_de_resultado_no_contienen_credenciales_ni_motivos_internos() {
    JavaMailSender sender = mock(JavaMailSender.class);
    var email = new BusinessApplicationDecisionEmailAdapter(sender, "no-reply@mapit.local");
    email.send("owner@example.test", "Hotel Norte", BusinessApplicationStatus.APPROVED);
    email.send("owner@example.test", "Hotel Norte", BusinessApplicationStatus.REJECTED);

    var sent = ArgumentCaptor.forClass(SimpleMailMessage.class);
    verify(sender, org.mockito.Mockito.times(2)).send(sent.capture());
    var messages = sent.getAllValues();
    assertThat(messages.get(0).getText()).contains("aprobada", "Hotel Norte");
    assertThat(messages.get(1).getText()).contains("rechazada", "Hotel Norte");
    for (SimpleMailMessage message : messages) {
      assertThat(message.getTo()).containsExactly("owner@example.test");
      assertThat(message.getText()).doesNotContain("token", "contraseña", "password", "http", "@example.test");
    }
  }
}
