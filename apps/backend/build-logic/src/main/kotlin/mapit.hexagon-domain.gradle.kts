/**
 * CAPA DOMAIN — el corazón hexagonal.
 *
 * REGLA CENTRAL DEL PROYECTO: aquí NO entra Spring, ni JPA, ni Jackson.
 * Solo Java puro: entidades, value objects, reglas de negocio y PUERTOS
 * (interfaces que el dominio define y la infraestructura implementa).
 *
 * Esta regla no depende de la disciplina del equipo: como este plugin no
 * declara esas dependencias, importar `org.springframework.*` o `jakarta.persistence.*`
 * simplemente NO COMPILA. ArchUnit da la segunda red en `bootstrap`.
 */
plugins {
    id("mapit.java-conventions")
}

dependencies {
    // Deliberadamente vacío de frameworks.
    // Si necesitas algo aquí, primero pregúntate si de verdad es del dominio:
    // casi siempre la respuesta es que va en `application` o `infrastructure`.
}
