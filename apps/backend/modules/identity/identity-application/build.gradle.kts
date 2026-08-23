// identity-application — Casos de uso: orquestan el dominio y delimitan transacciones.
// Casos de uso del módulo: CU-23, CU-24
plugins {
    id("mapit.hexagon-application")
}

dependencies {
    implementation(project(":modules:identity:identity-domain"))
    implementation(project(":shared-kernel"))
}
