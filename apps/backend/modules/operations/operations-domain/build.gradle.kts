// operations-domain — Entidades, value objects, reglas de negocio y puertos. SIN frameworks.
// Casos de uso del módulo: CU-09, CU-10, CU-14
plugins {
    id("mapit.hexagon-domain")
}

dependencies {
    implementation(project(":shared-kernel"))
}
