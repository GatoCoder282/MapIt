/**
 * CAPA INFRASTRUCTURE — adaptadores.
 *
 * Aquí vive todo lo que toca el mundo exterior: repositorios JPA,
 * controladores REST, listeners STOMP, clientes HTTP, Unleash.
 * Implementa los puertos que declara `domain`.
 *
 * Es la única capa que puede importar frameworks libremente.
 */
import org.gradle.accessors.dm.LibrariesForLibs

plugins {
    id("mapit.java-conventions")
    id("io.spring.dependency-management")
}

val libs = the<LibrariesForLibs>()

dependencyManagement {
    imports {
        mavenBom("org.springframework.boot:spring-boot-dependencies:${libs.versions.springBoot.get()}")
    }
}

dependencies {
    "implementation"(libs.spring.boot.starter.web)
    "implementation"(libs.spring.boot.starter.data.jpa)
    "implementation"(libs.spring.boot.starter.validation)
    "implementation"(libs.mapstruct)
    "annotationProcessor"(libs.mapstruct.processor)

    "testImplementation"(libs.spring.boot.starter.test)
    "testImplementation"(libs.bundles.testcontainers)
}
