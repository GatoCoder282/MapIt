// platform-domain — Entidades, value objects, reglas de negocio y puertos. SIN frameworks.
// Casos de uso del módulo: CU-01..CU-03
plugins {
    id("mapit.hexagon-domain")
}

dependencies {
    implementation(project(":shared-kernel"))
}
