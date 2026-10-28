package com.mapit.reservations.application.history;

import java.time.Clock;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Locale;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import com.mapit.reservations.domain.history.CustomerHistoryAccessRepository;
import com.mapit.reservations.domain.history.CustomerHistoryMail;
import com.mapit.reservations.domain.person.PersonRepository;

@Service
public class CustomerHistoryLinks {
  private final CustomerHistoryAccessRepository access;
  private final PersonRepository people;
  private final CustomerHistoryMail mail;
  private final HistorySecrets secrets;
  private final CustomerHistoryPolicy policy;
  private final Clock clock;
  private final String publicUrl;

  public CustomerHistoryLinks(CustomerHistoryAccessRepository access, PersonRepository people,
      CustomerHistoryMail mail, HistorySecrets secrets, CustomerHistoryPolicy policy,
      Clock clock, @Value("${mapit.public-web-url:http://localhost:4300}") String publicUrl) {
    this.access = access;
    this.people = people;
    this.mail = mail;
    this.secrets = secrets;
    this.policy = policy;
    this.clock = clock;
    this.publicUrl = publicUrl;
  }

  @Transactional
  public void request(String tenantSlug, String email) {
    String normalized = email.strip().toLowerCase(Locale.ROOT);
    access.activeTenant(tenantSlug).ifPresent(tenant ->
        people.findAliveByEmail(tenant, normalized).ifPresent(person -> {
          Instant now = clock.instant();
          access.lockPerson(tenant, person.id().value());
          if (access.recentRequests(tenant, person.id().value(),
              now.minus(policy.windowMinutes(), ChronoUnit.MINUTES)) >= policy.personLimit()) return;
          String token = secrets.generate();
          access.issue(tenant, person.id().value(), secrets.hash(token),
              now.plus(policy.linkMinutes(), ChronoUnit.MINUTES), now);
          String link = publicUrl.replaceAll("/+$", "") + "/mis-reservas/" + tenantSlug + "#token=" + token;
          // Tras commit: un fallo SMTP no revierte la solicitud ni cambia su 202 público.
          TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override
            public void afterCommit() {
              // Nunca esperar el transporte SMTP en la respuesta pública: su latencia
              // depende de que exista una persona y permitiría enumeración por tiempos.
              Thread.ofVirtual().name("customer-history-mail").start(() -> {
                try {
                  mail.send(normalized, link);
                } catch (RuntimeException ignored) {
                  // El adaptador registra solo el tipo de fallo, sin correo ni secreto.
                }
              });
            }
          });
        }));
  }

  @Transactional
  public Session exchange(String slug, String linkToken) {
    Instant now = clock.instant();
    var tenant = access.activeTenant(slug).orElseThrow(InvalidHistoryCredentialException::new);
    String sessionToken = secrets.generate();
    Instant expires = now.plus(policy.sessionMinutes(), ChronoUnit.MINUTES);
    access.exchange(tenant, secrets.hash(linkToken), secrets.hash(sessionToken), expires, now)
        .orElseThrow(InvalidHistoryCredentialException::new);
    return new Session(sessionToken, expires);
  }

  public record Session(String sessionToken, Instant expiresAt) {}
}
