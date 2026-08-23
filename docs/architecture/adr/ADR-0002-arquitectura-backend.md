# ADR-0002 — Hexagonal Modular con módulos Gradle

- **Estado:** Aceptado
- **Fecha:** 2026-08-23

## Contexto

El backend debe soportar 24 casos de uso repartidos entre 5 personas, con un modelo de
dominio no trivial (jerarquía espacial, estados, reservas, multi-tenant) y la ambición de
que un mismo motor sirva a 4 industrias distintas.

Con varias personas tocando el mismo código, el riesgo real no es elegir mal la arquitectura:
es que la arquitectura elegida **se erosione** porque nadie recuerda dónde va cada cosa.

## Decisión

**Hexagonal (Ports & Adapters) modular**, con un módulo Gradle por bounded context y cada
uno partido en tres subproyectos:

```
modules/<contexto>/
  <contexto>-domain/          entidades, value objects, PUERTOS. Java puro.
  <contexto>-application/     casos de uso, transacciones
  <contexto>-infrastructure/  adaptadores: JPA, REST, STOMP, HTTP
```

Contextos: `platform`, `identity`, `spaces`, `operations`, `reservations`, `payments`.
Más `shared-kernel` (tipos comunes) y `bootstrap` (la app Spring Boot: solo wiring).

**La clave está en el build, no en la convención:** el módulo `*-domain` **no declara Spring
como dependencia**. Importar `org.springframework.*` o `jakarta.persistence.*` ahí
simplemente no compila. La regla la impone el compilador.

ArchUnit cubre lo que Gradle no ve: dependencias entre contextos y saltos de capa dentro de
un mismo subproyecto.

## Alternativas consideradas

| Opción                                             | Por qué no                                                                                                                                                                                                                                                           |
| -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Un solo módulo, capas por paquete**              | Más simple de arrancar, pero los límites dependen de la disciplina. Con 5 personas y agentes generando código, se erosionan en semanas.                                                                                                                              |
| **Spring Modulith**                                | Buena herramienta, documentada como opción de primera clase en Spring Boot 4. Pero verifica los límites en _tests_, mientras que los módulos Gradle los verifican en _compilación_: es más estricto y da feedback antes. Queda registrado como alternativa evaluada. |
| **Microservicios**                                 | Desproporcionado. Todo corre en localhost y el equipo tiene un semestre.                                                                                                                                                                                             |
| **Capas clásicas (controller-service-repository)** | Es lo que pedía el planteamiento original (RNF08). Se cumple su intención —separación de responsabilidades— con más rigor: hexagonal es una forma estricta de arquitectura en capas.                                                                                 |

## Consecuencias

**A favor**

- Una fuga de arquitectura no compila. Es la garantía más fuerte posible.
- Los 5 pueden trabajar en contextos distintos sin pisarse.
- El dominio se puede testear en milisegundos, sin levantar Spring.

**En contra**

- Más ceremonia: 18 subproyectos Gradle y sus `build.gradle.kts`. Mitigado con convention
  plugins en `build-logic`, donde la configuración se escribe una vez.
- Curva de aprendizaje al principio: hay que pensar dónde va cada clase. Es precisamente el
  hábito que se quiere adquirir.
- **Riesgo a vigilar: el Anemic Domain Model.** Entidades que son solo getters y setters con
  toda la lógica en un "Service" dan hexagonal por fuera y capas anémicas por dentro.
