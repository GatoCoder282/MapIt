// operations-application — Casos de uso: orquestan el dominio y delimitan transacciones.
// Casos de uso del módulo: CU-09, CU-10, CU-14
plugins {
    id("mapit.hexagon-application")
}

dependencies {
    implementation(project(":modules:operations:operations-domain"))
    implementation(project(":shared-kernel"))
}
