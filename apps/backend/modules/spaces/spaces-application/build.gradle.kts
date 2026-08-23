// spaces-application — Casos de uso: orquestan el dominio y delimitan transacciones.
// Casos de uso del módulo: CU-04..CU-08
plugins {
    id("mapit.hexagon-application")
}

dependencies {
    implementation(project(":modules:spaces:spaces-domain"))
    implementation(project(":shared-kernel"))
}
