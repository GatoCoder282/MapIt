// bootstrap — la aplicación Spring Boot.
// ÚNICO módulo con `main`. Solo configuración y wiring: sin lógica de negocio.
plugins {
    id("mapit.spring-boot-app")
    alias(libs.plugins.flyway)
}

// El plugin de Gradle de Flyway corre en el classloader del buildscript, aparte
// del classpath de la app. Desde Flyway 10, el soporte de cada motor de BD es
// una dependencia separada (`flyway-database-postgresql`) que además hay que
// declarar acá, o el plugin no encuentra qué driver usar al correr flywayMigrate/Info.
buildscript {
    dependencies {
        classpath("org.flywaydb:flyway-database-postgresql:11.16.0")
    }
}

dependencies {
    implementation(project(":shared-kernel"))

    // Todos los módulos de negocio. Al estar aquí (y solo aquí), el grafo de
    // dependencias converge en un único punto y ningún módulo puede importar a otro.
    listOf("platform", "identity", "spaces", "operations", "reservations", "payments").forEach { m ->
        implementation(project(":modules:$m:$m-domain"))
        implementation(project(":modules:$m:$m-application"))
        implementation(project(":modules:$m:$m-infrastructure"))
    }

    implementation(libs.spring.boot.starter.security)
    implementation(libs.spring.boot.starter.data.jpa)
    implementation(libs.spring.boot.starter.validation)
    implementation(libs.spring.boot.starter.websocket)
    implementation(libs.spring.boot.starter.mail)
    implementation(libs.springdoc.openapi)
    implementation(libs.bundles.jwt)
    implementation(libs.flyway.core)
    implementation(libs.spring.boot.flyway)

    testImplementation(libs.spring.boot.starter.test)
    testImplementation(libs.spring.security.test)
    testImplementation(libs.archunit.junit5)
    testImplementation(libs.bundles.testcontainers)
    testImplementation(libs.spring.boot.testcontainers)
}

// MAP-286 no puede aplicar V41 antes de integrar la migración V40 de MAP-285.
// Protege también el CLI de Gradle, que no utiliza el wiring Spring de arranque.
tasks.named("flywayMigrate") {
    doFirst {
        check(file("src/main/resources/db/migration/V40__agregar_contacto_e_idioma_al_perfil_personal.sql").isFile &&
            fileTree("src/main/resources/db/migration") { include("V40__*.sql") }.files.size == 1) {
            "MAP-286 requiere integrar V40 de MAP-285 antes de migrar V41-V43."
        }
    }
}

// Flyway se configura desde el .env de la raíz del monorepo.
flyway {
    url = System.getenv("DB_URL") ?: "jdbc:postgresql://localhost:5433/mapit"
    user = System.getenv("POSTGRES_USER") ?: "mapit"
    password = System.getenv("POSTGRES_PASSWORD") ?: "changeme_local"
    locations = arrayOf("filesystem:src/main/resources/db/migration")
    // MAP-175: la contraseña de mapit_app llega del entorno, nunca del repo.
    placeholders = mapOf("mapitAppDbPassword" to (System.getenv("MAPIT_APP_DB_PASSWORD") ?: ""))
}
