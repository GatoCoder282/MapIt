// payments-infrastructure — Adaptadores: JPA, REST, STOMP, clientes HTTP.
// Casos de uso del módulo: CU-17
plugins {
    id("mapit.hexagon-infrastructure")
}

dependencies {
    implementation(project(":modules:payments:payments-domain"))
    implementation(project(":modules:payments:payments-application"))
    implementation(project(":shared-kernel"))
}
