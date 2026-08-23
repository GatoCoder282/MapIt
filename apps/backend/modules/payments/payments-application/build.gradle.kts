// payments-application — Casos de uso: orquestan el dominio y delimitan transacciones.
// Casos de uso del módulo: CU-17
plugins {
    id("mapit.hexagon-application")
}

dependencies {
    implementation(project(":modules:payments:payments-domain"))
    implementation(project(":shared-kernel"))
}
