// reservations-application — Casos de uso: orquestan el dominio y delimitan transacciones.
// Casos de uso del módulo: CU-11..CU-13, CU-15, CU-16, CU-18
plugins {
    id("mapit.hexagon-application")
}

dependencies {
    implementation(project(":modules:reservations:reservations-domain"))
    implementation(project(":shared-kernel"))
}
