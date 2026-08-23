// reservations-domain — Entidades, value objects, reglas de negocio y puertos. SIN frameworks.
// Casos de uso del módulo: CU-11..CU-13, CU-15, CU-16, CU-18
plugins {
    id("mapit.hexagon-domain")
}

dependencies {
    implementation(project(":shared-kernel"))
}
