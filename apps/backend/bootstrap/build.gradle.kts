// bootstrap — la aplicación Spring Boot.
// ÚNICO módulo con `main`. Solo configuración y wiring: sin lógica de negocio.
plugins {
    id("mapit.spring-boot-app")
    alias(libs.plugins.flyway)
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
    implementation(libs.unleash.client)
    implementation(libs.bundles.jwt)

    testImplementation(libs.spring.boot.starter.test)
    testImplementation(libs.spring.security.test)
    testImplementation(libs.archunit.junit5)
    testImplementation(libs.bundles.testcontainers)
    testImplementation(libs.spring.boot.testcontainers)
}

// Flyway se configura desde el .env de la raíz del monorepo.
flyway {
    url = System.getenv("DB_URL") ?: "jdbc:postgresql://localhost:5433/mapit"
    user = System.getenv("POSTGRES_USER") ?: "mapit"
    password = System.getenv("POSTGRES_PASSWORD") ?: "changeme_local"
    locations = arrayOf("filesystem:src/main/resources/db/migration")
}
