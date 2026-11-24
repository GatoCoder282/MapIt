package com.mapit.config;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.Test;
import org.springframework.boot.context.properties.bind.Binder;
import org.springframework.boot.context.properties.bind.PropertySourcesPlaceholdersResolver;
import org.springframework.boot.context.properties.source.ConfigurationPropertySources;
import org.springframework.boot.env.YamlPropertySourceLoader;
import org.springframework.boot.mail.autoconfigure.MailProperties;
import org.springframework.core.env.MapPropertySource;
import org.springframework.core.env.PropertySource;
import org.springframework.core.io.ClassPathResource;

/**
 * Valores por defecto del SMTP en {@code application.yml}: Mailpit local sin auth ni TLS, con
 * timeouts acotados, y sobrescribibles por variables de entorno en los entornos desplegados.
 *
 * <p>Solo se resuelven placeholders contra las fuentes del test (no contra el entorno real del
 * proceso), así que el resultado no depende del {@code .env} de la máquina.
 */
class MailDefaultsTest {

    @Test
    void porDefectoSinAuthNiStarttlsYConTimeouts() throws IOException {
        MailProperties mail = mail(binder(Map.of()));

        assertThat(mail.getHost()).isEqualTo("localhost");
        assertThat(mail.getPort()).isEqualTo(1025);
        assertThat(mail.getUsername()).isEmpty();
        assertThat(mail.getPassword()).isEmpty();
        assertThat(mail.getProperties())
                .containsEntry("mail.smtp.auth", "false")
                .containsEntry("mail.smtp.starttls.enable", "false")
                .containsEntry("mail.smtp.starttls.required", "false")
                .containsEntry("mail.smtp.connectiontimeout", "5000")
                .containsEntry("mail.smtp.timeout", "10000")
                .containsEntry("mail.smtp.writetimeout", "10000");
    }

    @Test
    void lasVariablesDeEntornoSobrescribenLosValoresPorDefecto() throws IOException {
        MailProperties mail = mail(binder(Map.of(
                "MAIL_PORT", "2525",
                "MAIL_USERNAME", "smtp-user",
                "MAIL_PASSWORD", "smtp-secret",
                "MAIL_SMTP_AUTH", "true",
                "MAIL_SMTP_STARTTLS", "true",
                "MAIL_TIMEOUT_MS", "15000")));

        assertThat(mail.getPort()).isEqualTo(2525);
        assertThat(mail.getUsername()).isEqualTo("smtp-user");
        assertThat(mail.getPassword()).isEqualTo("smtp-secret");
        assertThat(mail.getProperties())
                .containsEntry("mail.smtp.auth", "true")
                .containsEntry("mail.smtp.starttls.enable", "true")
                .containsEntry("mail.smtp.starttls.required", "true")
                .containsEntry("mail.smtp.connectiontimeout", "5000")
                .containsEntry("mail.smtp.timeout", "15000");
    }

    @Test
    void elHealthPublicoNoAbreConexionesSmtp() throws IOException {
        assertThat(binder(Map.of()).bind("management.health.mail.enabled", Boolean.class).get())
                .isFalse();
    }

    private static MailProperties mail(Binder binder) {
        return binder.bind("spring.mail", MailProperties.class).get();
    }

    /** {@code application.yml} con {@code entorno} por delante, como haría Spring Boot. */
    private static Binder binder(Map<String, Object> entorno) throws IOException {
        List<PropertySource<?>> fuentes = new ArrayList<>();
        fuentes.add(new MapPropertySource("entorno", entorno));
        fuentes.addAll(new YamlPropertySourceLoader()
                .load("application.yml", new ClassPathResource("application.yml")));
        return new Binder(
                ConfigurationPropertySources.from(fuentes),
                new PropertySourcesPlaceholdersResolver(fuentes));
    }
}
