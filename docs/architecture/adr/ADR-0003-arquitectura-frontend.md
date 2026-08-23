# ADR-0003 — MVVM con Signals y organización feature-first

- **Estado:** Aceptado
- **Fecha:** 2026-08-23

## Contexto

El frontend tiene dos superficies muy distintas —consola de staff y vista pública— y una
pantalla exigente: un editor de mapas que debe manejar 50+ elementos sin degradarse (RNF06)
y reflejar cambios de estado en menos de 2 segundos (RNF04).

El planteamiento inicial pedía **MVVM**. La pregunta era cómo se traduce eso a Angular 22.

## Decisión

**MVVM implementado con Signals**, sobre una organización **feature-first**.

| Capa MVVM     | En Angular 22                                                                                                                                               |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **View**      | componente standalone + plantilla. Solo binding y eventos, sin lógica.                                                                                      |
| **ViewModel** | un _store_ con Signals (`signal`, `computed`, `linkedSignal`) inyectado en el componente. Expone estado derivado y comandos. Testeable sin renderizar nada. |
| **Model**     | servicios de dominio + el cliente de API generado del contrato.                                                                                             |

Estructura de cada feature:

```
features/<nombre>/
├── ui/     componentes y plantillas
├── model/  el ViewModel (signal store)
└── data/   llamadas al api-client
```

Decisiones que acompañan:

- **Zoneless** — es el default desde Angular 21. Ayuda directamente al RNF06.
- **Feature-first, no type-first.** El style guide oficial de Angular pide explícitamente
  evitar carpetas `components/`, `services/`, `directives/`. Además, así el frontend es el
  espejo de los bounded contexts del backend.
- **Dos aplicaciones**, no una con rutas: `console` y `public-web` tienen autenticación,
  audiencia y presupuesto de bundle distintos, y se despliegan por separado.

## Alternativas consideradas

| Opción                                | Por qué no                                                                                                                                                                           |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **MVVM con RxJS (`BehaviorSubject`)** | Es el MVVM "clásico" de Angular, pero obliga a `async` en plantillas, gestión manual de suscripciones y convive mal con zoneless. Los signals expresan lo mismo con menos ceremonia. |
| **NgRx / Redux**                      | Potente para estado global complejo. Aquí la mayor parte del estado es local a una feature; el boilerplate no se paga. Se puede adoptar después si el estado del editor lo pide.     |
| **Una sola app con rutas lazy**       | Menos setup, pero mezcla la superficie pública con la interna en un mismo bundle y despliegue.                                                                                       |
| **Organización por tipo de archivo**  | Contradice el style guide oficial y dispersa cada feature por cuatro carpetas.                                                                                                       |

## Consecuencias

**A favor**

- El ViewModel se testea sin DOM: tests rápidos y estables.
- Signals + zoneless reducen los ciclos de detección de cambios, que es lo que el canvas necesita.
- La estructura hace evidente dónde va cada cosa, que es lo que importa con 5 personas y agentes.

**En contra**

- Alguna librería de terceros puede asumir Zone.js y fallar de forma sutil. Es un motivo más
  para mantener el motor de mapa detrás de su puerto (ADR-0006).
- El equipo debe resistir la tentación de meter lógica en los componentes. ESLint ayuda,
  pero esta parte sí depende del review.
