/**
 * CAPA APPLICATION — casos de uso.
 *
 * Orquesta el dominio: recibe comandos, coordina entidades, delimita
 * transacciones. Depende del dominio, NUNCA de la infraestructura.
 * Habla con el exterior solo a través de los puertos definidos en `domain`.
 *
 * Se permite lo mínimo de Spring: anotaciones de transacción e inyección.
 * Deliberadamente NO se incluyen los starters web ni de JPA: si un caso de uso
 * necesita eso, la lógica pertenece a infrastructure.
 */
import org.gradle.accessors.dm.LibrariesForLibs

plugins {
    id("mapit.java-conventions")
    id("io.spring.dependency-management")
}

val libs = the<LibrariesForLibs>()

// El BOM de Spring Boot da la versión de cada artefacto.
// Sin esto, `spring-tx` se resuelve sin versión y el build falla.
dependencyManagement {
    imports {
        mavenBom("org.springframework.boot:spring-boot-dependencies:${libs.versions.springBoot.get()}")
    }
}

dependencies {
    "implementation"("org.springframework:spring-tx")
    "implementation"("org.springframework:spring-context")
    "implementation"("jakarta.validation:jakarta.validation-api")
}
