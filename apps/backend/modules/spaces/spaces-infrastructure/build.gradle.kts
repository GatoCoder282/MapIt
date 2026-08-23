// spaces-infrastructure — Adaptadores: JPA, REST, STOMP, clientes HTTP.
// Casos de uso del módulo: CU-04..CU-08
plugins {
    id("mapit.hexagon-infrastructure")
}

dependencies {
    implementation(project(":modules:spaces:spaces-domain"))
    implementation(project(":modules:spaces:spaces-application"))
    implementation(project(":shared-kernel"))
}
