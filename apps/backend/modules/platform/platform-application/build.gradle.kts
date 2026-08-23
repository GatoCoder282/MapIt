// platform-application — Casos de uso: orquestan el dominio y delimitan transacciones.
// Casos de uso del módulo: CU-01..CU-03
plugins {
    id("mapit.hexagon-application")
}

dependencies {
    implementation(project(":modules:platform:platform-domain"))
    implementation(project(":shared-kernel"))
}
