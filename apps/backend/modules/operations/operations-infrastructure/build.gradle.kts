// operations-infrastructure — Adaptadores: JPA, REST, STOMP, clientes HTTP.
// Casos de uso del módulo: CU-09, CU-10, CU-14
plugins {
    id("mapit.hexagon-infrastructure")
}

dependencies {
    implementation(project(":modules:operations:operations-domain"))
    implementation(project(":modules:operations:operations-application"))
    implementation(project(":shared-kernel"))
}
