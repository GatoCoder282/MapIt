/**
 * APLICACIÓN SPRING BOOT — solo para `bootstrap`.
 *
 * Es el único módulo con método `main`. No contiene lógica de negocio:
 * únicamente configuración, wiring de los módulos y migraciones.
 */
import org.gradle.accessors.dm.LibrariesForLibs

plugins {
    id("mapit.java-conventions")
    id("org.springframework.boot")
    id("io.spring.dependency-management")
}

val libs = the<LibrariesForLibs>()

dependencies {
    "implementation"(libs.spring.boot.starter.web)
    "implementation"(libs.spring.boot.starter.actuator)
    "runtimeOnly"(libs.postgresql)
    "runtimeOnly"(libs.bundles.flyway)
}

tasks.named<org.springframework.boot.gradle.tasks.bundling.BootJar>("bootJar") {
    archiveFileName = "mapit-backend.jar"
}

// Imagen OCI sin escribir Dockerfile (Cloud Native Buildpacks).
tasks.named<org.springframework.boot.gradle.tasks.bundling.BootBuildImage>("bootBuildImage") {
    imageName = "mapit/backend:${project.version}"
}
