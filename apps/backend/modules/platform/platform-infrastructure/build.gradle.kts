// platform-infrastructure — Adaptadores: JPA, REST, STOMP, clientes HTTP.
// Casos de uso del módulo: CU-01..CU-03
plugins {
    id("mapit.hexagon-infrastructure")
}

dependencies {
    implementation(project(":modules:platform:platform-domain"))
    implementation(project(":modules:platform:platform-application"))
    implementation(project(":shared-kernel"))
    implementation(libs.spring.boot.starter.mail)
}
