// =============================================================
//  MapIt backend — estructura del build multi-módulo.
//  Arquitectura: Hexagonal Modular (Ports & Adapters).
// =============================================================

// Best practice de Gradle: "Name Your Root Project".
rootProject.name = "mapit-backend"

// Best practice: "Favor build-logic Composite Builds".
// Los convention plugins viven en un build incluido, no en subprojects {}.
pluginManagement {
    includeBuild("build-logic")
    repositories {
        gradlePluginPortal()
        mavenCentral()
    }
}

// Best practice: "Set Up Repositories in Settings File".
dependencyResolutionManagement {
    repositoriesMode = RepositoriesMode.FAIL_ON_PROJECT_REPOS
    repositories {
        mavenCentral()
    }
}

plugins {
    // Detecta y descarga automáticamente el JDK del toolchain si falta,
    // así el build funciona igual en las 5 máquinas.
    id("org.gradle.toolchains.foojay-resolver-convention") version "1.0.0"
}

// ── Núcleo compartido ────────────────────────────────────────
include(":shared-kernel")

// ── Módulos de negocio (bounded contexts) ────────────────────
//  Cada uno se parte en tres subproyectos. La separación NO es
//  cosmética: `*-domain` no declara Spring como dependencia, así
//  que una fuga de capa no compila. Ver plan §3.
val modulosDeNegocio = listOf(
    "platform",     // CU-01..CU-03  tenants, super admin
    "identity",     // CU-23, CU-24  auth JWT, roles
    "spaces",       // CU-04..CU-08  Establishment/Floor/Sector/SpaceElement
    "operations",   // CU-09, CU-10, CU-14  estados, tiempo real, bitácora, dashboard
    "reservations", // CU-11..CU-13, CU-15, CU-16, CU-18
    "payments",     // CU-17  pasarela QR
)

modulosDeNegocio.forEach { modulo ->
    listOf("domain", "application", "infrastructure").forEach { capa ->
        include(":modules:$modulo:$modulo-$capa")
        project(":modules:$modulo:$modulo-$capa").projectDir =
            file("modules/$modulo/$modulo-$capa")
    }
}

// ── Aplicación ───────────────────────────────────────────────
// Único módulo con `main`: solo configuración y wiring.
include(":bootstrap")
