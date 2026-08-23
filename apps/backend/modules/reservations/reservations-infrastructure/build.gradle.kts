// reservations-infrastructure — Adaptadores: JPA, REST, STOMP, clientes HTTP.
// Casos de uso del módulo: CU-11..CU-13, CU-15, CU-16, CU-18
plugins {
    id("mapit.hexagon-infrastructure")
}

dependencies {
    implementation(project(":modules:reservations:reservations-domain"))
    implementation(project(":modules:reservations:reservations-application"))
    implementation(project(":shared-kernel"))
}
