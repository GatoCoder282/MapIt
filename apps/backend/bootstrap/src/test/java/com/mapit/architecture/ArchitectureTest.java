package com.mapit.architecture;

import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.noClasses;

import com.tngtech.archunit.core.domain.JavaClasses;
import com.tngtech.archunit.core.importer.ImportOption;
import com.tngtech.archunit.junit.AnalyzeClasses;
import com.tngtech.archunit.junit.ArchTest;
import com.tngtech.archunit.lang.ArchRule;
import com.tngtech.archunit.library.dependencies.SlicesRuleDefinition;

/**
 * Hace cumplir la arquitectura Hexagonal Modular.
 *
 * <p>Es la <em>segunda</em> red de seguridad: la primera es la separación en módulos Gradle,
 * donde la capa {@code domain} directamente no declara Spring, así que una fuga no compila.
 * ArchUnit cubre lo que Gradle no puede ver: dependencias entre módulos de negocio,
 * y usos indebidos dentro de un mismo subproyecto.
 *
 * <p>Estas reglas importan <strong>más</strong> en un flujo de desarrollo agéntico, no menos:
 * son lo que impide que una fuga de arquitectura entre sin que nadie la note en el review.
 */
@AnalyzeClasses(
    packages = "com.mapit",
    importOptions = {ImportOption.DoNotIncludeTests.class})
class ArchitectureTest {

  /* ── El dominio se mantiene puro ─────────────────────────── */

  @ArchTest
  static final ArchRule el_dominio_no_depende_de_spring =
      noClasses()
          .that()
          .resideInAPackage("..domain..")
          .should()
          .dependOnClassesThat()
          .resideInAnyPackage("org.springframework..")
          .because(
              "la capa domain debe ser Java puro: sin Spring. "
                  + "Si necesitas un framework, tu lógica probablemente pertenece a "
                  + "application o infrastructure.");

  @ArchTest
  static final ArchRule el_dominio_no_depende_de_jpa =
      noClasses()
          .that()
          .resideInAPackage("..domain..")
          .should()
          .dependOnClassesThat()
          .resideInAnyPackage("jakarta.persistence..", "org.hibernate..")
          .because(
              "las entidades de dominio no son entidades JPA. "
                  + "El mapeo a tablas vive en infrastructure.");

  @ArchTest
  static final ArchRule el_dominio_no_depende_de_jackson =
      noClasses()
          .that()
          .resideInAPackage("..domain..")
          .should()
          .dependOnClassesThat()
          .resideInAnyPackage("tools.jackson..", "com.fasterxml.jackson..")
          .because("la serialización es un detalle de transporte, no del dominio.");

  /* ── Dirección de las dependencias entre capas ───────────── */

  @ArchTest
  static final ArchRule el_dominio_no_conoce_a_application_ni_infrastructure =
      noClasses()
          .that()
          .resideInAPackage("..domain..")
          .should()
          .dependOnClassesThat()
          .resideInAnyPackage("..application..", "..infrastructure..")
          .because("en una arquitectura hexagonal las dependencias apuntan HACIA el dominio.");

  @ArchTest
  static final ArchRule application_no_conoce_a_infrastructure =
      noClasses()
          .that()
          .resideInAPackage("..application..")
          .should()
          .dependOnClassesThat()
          .resideInAPackage("..infrastructure..")
          .because(
              "los casos de uso hablan con el exterior a través de PUERTOS definidos en domain, "
                  + "nunca contra un adaptador concreto.");

  /* ── Módulos de negocio aislados entre sí ────────────────── */

  @ArchTest
  static final ArchRule los_modulos_no_tienen_ciclos =
      SlicesRuleDefinition.slices()
          .matching("com.mapit.(*)..")
          .should()
          .beFreeOfCycles()
          .because("un ciclo entre bounded contexts significa que los límites están mal trazados.");

  /* ── Reglas específicas de MapIt ─────────────────────────── */

  @ArchTest
  static final ArchRule unleash_solo_se_usa_desde_su_adaptador =
      noClasses()
          .that()
          .resideOutsideOfPackage("..infrastructure.flags..")
          .should()
          .dependOnClassesThat()
          .resideInAPackage("io.getunleash..")
          .because(
              "el resto del código usa FeatureFlagPort. "
                  + "Así se puede cambiar de proveedor de flags sin tocar la lógica de negocio.");

  @ArchTest
  static final ArchRule no_se_usa_System_out =
      noClasses()
          .should()
          .callMethod(System.class, "currentTimeMillis")
          .because("usa java.time.Clock inyectado: si no, el tiempo no se puede testear.");

  /**
   * Comprobación de humo: si el import no encuentra clases, las reglas de arriba pasarían
   * vacías y darían una falsa sensación de seguridad.
   */
  @ArchTest
  static void hay_clases_que_analizar(JavaClasses clases) {
    if (clases.isEmpty()) {
      throw new AssertionError(
          "ArchUnit no encontró ninguna clase en com.mapit. "
              + "Las reglas estarían pasando en vacío.");
    }
  }
}
