/**
 * Base de TODOS los subproyectos Java: toolchain, codificación, tests, formato.
 * Best practice de Gradle: "Use Convention Plugins" en vez de subprojects {}.
 */
import org.gradle.accessors.dm.LibrariesForLibs

plugins {
    java
    jacoco
    id("com.diffplug.spotless")
}

// Acceso al version catalog desde un precompiled script plugin.
val libs = the<LibrariesForLibs>()

group = "com.mapit"
version = "0.1.0"

java {
    toolchain {
        // Gradle descarga este JDK si la máquina no lo tiene:
        // el build funciona igual en las 5 computadoras.
        languageVersion = JavaLanguageVersion.of(libs.versions.java.get().toInt())
    }
}

dependencies {
    // Null-safety con JSpecify (nuevo en Spring Framework 7).
    "implementation"(libs.jspecify)

    "testImplementation"(platform("org.junit:junit-bom:5.11.4"))
    "testImplementation"("org.junit.jupiter:junit-jupiter")
    "testImplementation"("org.assertj:assertj-core:3.27.3")
    "testRuntimeOnly"("org.junit.platform:junit-platform-launcher")
}

tasks.withType<JavaCompile>().configureEach {
    options.encoding = "UTF-8"
    options.compilerArgs.addAll(
        listOf(
            "-Xlint:all,-processing,-serial",
            "-parameters", // Spring necesita los nombres de parámetro en runtime
        )
    )
}

tasks.withType<Test>().configureEach {
    useJUnitPlatform()
    testLogging {
        events("failed", "skipped")
        exceptionFormat = org.gradle.api.tasks.testing.logging.TestExceptionFormat.FULL
        showStackTraces = true
    }
    // Los tests de integración (Testcontainers) se separan del ciclo rápido.
    systemProperty("java.util.logging.manager", "java.util.logging.LogManager")
}

// `pnpm be:it` — tests que necesitan Docker, fuera del `test` normal.
val integrationTest by tasks.registering(Test::class) {
    group = "verification"
    description = "Tests de integración con Testcontainers (requieren Docker)."
    useJUnitPlatform { includeTags("integration") }
    shouldRunAfter(tasks.test)
}

tasks.test {
    useJUnitPlatform { excludeTags("integration") }
}

jacoco {
    toolVersion = libs.versions.jacoco.get()
}

tasks.jacocoTestReport {
    dependsOn(tasks.test)
    reports {
        xml.required = true   // lo consume SonarQube
        html.required = true
    }
}

spotless {
    java {
        target("src/**/*.java")

        // Deliberadamente SIN un motor de formato completo:
        //
        //  - google-java-format depende de internals de javac (com.sun.tools.javac.*)
        //    que JDK 25 ya no expone: falla con NoSuchMethodError.
        //  - El formateador de Eclipse (JDT) sí funciona, pero arrastra decenas de
        //    megas de dependencias que hay que descargar en cada máquina y en CI,
        //    y bloqueaba el build varios minutos.
        //
        // A cambio se aplican los pasos que sí aportan y son gratis: orden de
        // imports, imports sin usar fuera, espacios finales y salto final.
        // La indentación y el ancho de línea los aplica el editor a partir de
        // .editorconfig (4 espacios), que ya está versionado y funciona igual
        // en VS Code, Orca e IntelliJ.
        importOrder("java", "javax", "jakarta", "org", "com", "")
        removeUnusedImports("cleanthat-javaparser-unnecessaryimport")
        trimTrailingWhitespace()
        leadingTabsToSpaces(4)
        endWithNewline()
        toggleOffOn()
    }

    kotlinGradle {
        target("*.gradle.kts")
        trimTrailingWhitespace()
        endWithNewline()
    }
}
