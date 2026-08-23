// identity-infrastructure — Adaptadores: JPA, REST, STOMP, clientes HTTP.
// Casos de uso del módulo: CU-23, CU-24
plugins {
    id("mapit.hexagon-infrastructure")
}

dependencies {
    implementation(project(":modules:identity:identity-domain"))
    implementation(project(":modules:identity:identity-application"))
    implementation(project(":shared-kernel"))
}
