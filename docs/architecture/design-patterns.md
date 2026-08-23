# Catálogo de patrones de diseño

Referencia para llenar la sección **Patrones de diseño aplicados** de cada `plan.md`.

> **Advertencia deliberada:** la trampa aquí es meter patrones para lucirlos. La plantilla
> pide _"por qué aquí"_ y _"alternativa descartada"_ precisamente para que cada patrón se
> justifique o se caiga. Un CRUD sin complejidad real **no necesita** ningún patrón, y
> decirlo así en el plan es una respuesta perfectamente válida.

## Candidatos identificados en el dominio de MapIt

| Patrón                               | Dónde encaja                                                                        | CU           | Por qué                                                                             |
| ------------------------------------ | ----------------------------------------------------------------------------------- | ------------ | ----------------------------------------------------------------------------------- |
| **Ports & Adapters**                 | arquitectura base del backend                                                       | todos        | Ya es la arquitectura: el dominio define puertos, la infraestructura los implementa |
| **Repository**                       | puertos de persistencia en `*-domain`                                               | todos        | El dominio expresa _qué_ necesita guardar sin saber _cómo_                          |
| **Strategy**                         | las 4 verticales: reserva por turno / por evento / por butaca / por rango de fechas | CU-19…22     | Es **el** patrón central de MapIt: un mismo motor, cuatro comportamientos           |
| **Abstract Factory** o **Prototype** | plantillas de `SpaceElement` según tipo de establecimiento                          | CU-07        | Crear una "zona VIP" o una "habitación" con sus valores por defecto                 |
| **State**                            | ciclo de la reserva y estado del elemento                                           | CU-13, CU-09 | Las transiciones son reglas de negocio; un `if` gigante las esconde                 |
| **Observer / Pub-Sub**               | eventos de dominio → difusión STOMP                                                 | CU-09        | El dominio emite el evento sin saber que hay WebSockets                             |
| **Command**                          | acciones del editor de mapas, con undo/redo                                         | CU-06        | El undo es prácticamente imposible sin esto                                         |
| **Composite**                        | jerarquía `Floor > Sector > SpaceElement` y agrupación                              | CU-05, CU-06 | Tratar un grupo de elementos igual que uno solo                                     |
| **Memento**                          | versiones o snapshots del layout                                                    | CU-08        | Guardar y restaurar el estado del mapa                                              |
| **Specification**                    | reglas de disponibilidad combinables (fecha + capacidad + vertical)                 | CU-15        | Componer filtros sin multiplicar métodos de consulta                                |
| **Adapter**                          | pasarela QR, motor de mapa, Unleash                                                 | CU-17, CU-06 | Aislar lo externo tras una interfaz propia                                          |
| **Decorator**                        | feature toggles envolviendo casos de uso                                            | transversal  | Activar comportamiento sin tocar el caso de uso                                     |
| **Value Object**                     | `TenantId`, `Money`, `TimeRange`                                                    | transversal  | El compilador impide confundir dos identificadores de texto                         |

## Antipatrones a evitar en este proyecto

| Antipatrón                         | Cómo se ve aquí                                                                                                               |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| **Anemic Domain Model**            | Entidades que son solo getters/setters y toda la lógica en el "Service". Es el riesgo nº1 al hacer hexagonal por primera vez. |
| **Singleton como variable global** | Estado mutable compartido. Con multi-tenant es directamente una fuga de datos entre empresas.                                 |
| **God Service**                    | Un `ReservationService` de 800 líneas. Si crece, faltan casos de uso separados.                                               |
| **Patrón por el patrón**           | Una `AbstractFactoryStrategyBuilder` para crear un objeto de tres campos.                                                     |
