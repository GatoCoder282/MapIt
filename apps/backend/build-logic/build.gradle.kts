plugins {
    `kotlin-dsl`
}

dependencies {
    // ── Acceso al Version Catalog desde los precompiled script plugins ──
    // Gradle genera el tipo `LibrariesForLibs` para el build principal, pero NO lo
    // expone automáticamente a build-logic. Este truco (documentado en el issue
    // gradle/gradle#15383) añade al classpath el jar donde vive ese tipo generado,
    // y así los convention plugins pueden usar `libs.…` con autocompletado y
    // verificación de tipos. Sin esta línea: "Unresolved reference 'accessors'".
    implementation(files(libs.javaClass.superclass.protectionDomain.codeSource.location))

    // Plugins que los convention plugins aplican por su id.
    implementation("org.springframework.boot:spring-boot-gradle-plugin:${libs.versions.springBoot.get()}")
    implementation("io.spring.gradle:dependency-management-plugin:${libs.versions.springDepMgmt.get()}")
    implementation("com.diffplug.spotless:spotless-plugin-gradle:${libs.versions.spotless.get()}")
}

// El compilador de Kotlin todavía no soporta JVM target 25 y cae a 24, lo que
// deja `compileJava` (25) y `compileKotlin` (24) desalineados. Gradle avisa de
// ello y en versiones futuras será un error. Como build-logic solo contiene
// scripts de build —nunca código de la aplicación—, se fija todo a 24: no
// afecta a los módulos de negocio, que siguen compilando a Java 25.
kotlin {
    compilerOptions {
        jvmTarget = org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_24
    }
}

tasks.withType<JavaCompile>().configureEach {
    options.release = 24
}
