package com.mapit.payments.infrastructure;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.*;

import java.io.ByteArrayInputStream;
import java.time.Clock;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletRequestWrapper;

import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.mock.env.MockEnvironment;
import org.springframework.mock.web.DelegatingServletInputStream;
import org.springframework.test.web.servlet.client.RestTestClient;

import com.mapit.payments.application.PaymentAttemptQuery;
import com.mapit.payments.application.PaymentService;

import tools.jackson.databind.ObjectMapper;

class MockPaymentWebhookControllerTest {
  private final PaymentService payments = mock(PaymentService.class);
  private final PaymentAttemptQuery query = mock(PaymentAttemptQuery.class);

  private MockPaymentWebhookController controller(boolean enabled) {
    var env = new MockEnvironment().withProperty("mapit.payments.mock.enabled", Boolean.toString(enabled));
    env.setActiveProfiles("test");
    return new MockPaymentWebhookController(new MockPaymentSettings(env, Clock.systemUTC()),
        new ObjectMapper(), Clock.systemUTC(), payments, query);
  }

  @Test void oversized_body_returns_413_problem_before_processing() {
    var client = RestTestClient.bindToController(controller(true))
        .configureServer(builder -> builder.setControllerAdvice(new PaymentsProblemHandler())).build();
    client.post().uri("/api/v1/public/payments/mock/webhook")
        .contentType(MediaType.APPLICATION_JSON).header("X-Mock-Timestamp", "0")
        .header("X-Mock-Signature", "invalid").body(new byte[16385])
        .exchange().expectStatus().isEqualTo(413)
        .expectHeader().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON)
        .expectBody().jsonPath("$.status").isEqualTo(413);
    verifyNoInteractions(payments, query);
  }

  @Test void unknown_or_underreported_length_reads_only_limit_plus_one() throws Exception {
    for (long length : new long[]{-1, 1}) {
      var request = mock(HttpServletRequest.class);
      var bytes = new ByteArrayInputStream(new byte[1_000_000]);
      when(request.getContentLengthLong()).thenReturn(length);
      when(request.getInputStream()).thenReturn(new DelegatingServletInputStream(bytes));
      assertThatThrownBy(() -> controller(true).receive("0", "invalid", request))
          .isInstanceOf(MockPaymentWebhookController.PayloadTooLarge.class);
      assertThat(bytes.available()).isEqualTo(1_000_000 - 16385);
    }
    verifyNoInteractions(payments, query);
  }

  @Test void unknown_length_returns_413_problem() {
    var client = RestTestClient.bindToController(controller(true))
        .configureServer(builder -> {
          builder.setControllerAdvice(new PaymentsProblemHandler());
          builder.addFilters((request, response, chain) -> chain.doFilter(
              new HttpServletRequestWrapper((HttpServletRequest) request) {
                @Override public long getContentLengthLong() { return -1; }
                @Override public int getContentLength() { return -1; }
              }, response));
        }).build();
    client.post().uri("/api/v1/public/payments/mock/webhook")
        .contentType(MediaType.APPLICATION_JSON).header("X-Mock-Timestamp", "0")
        .header("X-Mock-Signature", "invalid").body(new byte[16385])
        .exchange().expectStatus().isEqualTo(413)
        .expectBody().jsonPath("$.status").isEqualTo(413);
    verifyNoInteractions(payments, query);
  }

  @Test void declared_oversize_and_disabled_mock_do_not_read_stream() throws Exception {
    var request = mock(HttpServletRequest.class);
    when(request.getContentLengthLong()).thenReturn(16385L);
    assertThatThrownBy(() -> controller(true).receive("0", "invalid", request))
        .isInstanceOf(MockPaymentWebhookController.PayloadTooLarge.class);
    verify(request, never()).getInputStream();
    clearInvocations(request);
    assertThatThrownBy(() -> controller(false).receive("0", "invalid", request))
        .isInstanceOf(MockPaymentSettings.Disabled.class);
    verifyNoInteractions(request, payments, query);
  }

  @Test void boundary_size_is_not_413_and_invalid_signatures_are_401_before_processing() throws Exception {
    var client = RestTestClient.bindToController(controller(true))
        .configureServer(builder -> builder.setControllerAdvice(new PaymentsProblemHandler())).build();
    client.post().uri("/api/v1/public/payments/mock/webhook")
        .contentType(MediaType.APPLICATION_JSON).header("X-Mock-Timestamp", "0")
        .header("X-Mock-Signature", "invalid").body(new byte[16384])
        .exchange().expectStatus().isUnauthorized();
    var request = mock(HttpServletRequest.class);
    when(request.getContentLengthLong()).thenReturn(-1L);
    when(request.getInputStream()).thenReturn(new DelegatingServletInputStream(new ByteArrayInputStream(new byte[16384])));
    assertThatThrownBy(() -> controller(true).receive("0", "invalid", request)).isInstanceOf(SecurityException.class);
    verifyNoInteractions(payments, query);
  }
}
