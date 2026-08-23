# ADR-0006 — El motor de mapa vive detrás de un puerto

- **Estado:** **Propuesto** — la elección del motor se decide durante el desarrollo
- **Fecha:** 2026-08-23
- **Deciden:** Equipo MapIt

## Contexto

`project_definition.md` §11 registra que se **descartó** un proveedor externo
(Seats.io, SeatLayer, Sentaste) para el editor de mapas, _"ya que el objetivo académico
del Taller es demostrar la capacidad de diseño y construcción propia del equipo"_,
y eligió **Konva.js** entre los motores de canvas evaluados.

Durante la planificación el equipo planteó una duda razonable: **construir el editor con
Konva puede resultar demasiado costoso** para el tiempo del semestre, en el que además hay
que entregar multi-tenant, tiempo real, reservas, pagos y cuatro verticales. Si eso se
confirma, se cambiaría a una herramienta que facilite la construcción.

La decisión del motor **no bloquea la infraestructura**, pero sí condiciona el frontend
si se toma tarde y mal.

## Decisión

**Aplazar la elección del motor y aislarla tras un puerto.**

- `libs/map-engine` define `MapEnginePort`: montar, seleccionar, cambiar estado,
  exportar layout, destruir.
- Las features (`map-editor`, `operations`) programan **solo** contra esa interfaz.
- Una regla de ESLint impide importar `konva` fuera de su adaptador.
- El modelo `MapLayout` es **nuestro**, no el de ningún proveedor. Si se adopta un SDK
  externo, se escribe un mapper dentro de su adaptador.

Así, cambiar de motor es cambiar el proveedor en la inyección de dependencias, no
reescribir features. El backend, la base de datos y el contrato OpenAPI no se enteran.

## Alternativas consideradas

| Opción                                 | Estado                                                                      |
| -------------------------------------- | --------------------------------------------------------------------------- |
| **Konva.js propio**                    | Candidato inicial. Máximo valor académico; el riesgo es el costo en tiempo. |
| **SDK externo (Seats.io / SeatLayer)** | Abierto. Acelera muchísimo el editor. Ver condiciones abajo.                |
| Decidirlo ya, sin puerto               | Rechazado: obliga a apostar sin información y encarece el cambio.           |

## Condiciones si se opta por un SDK externo

1. **Persistencia del layout.** Debe permitir guardar el mapa en **nuestra** base de datos.
   Algunos proveedores retienen los mapas en su nube: eso incumpliría CU-08 / RF05
   (_"el mapa se persiste como estructura de datos, no como imagen"_) y nos ataría a ellos.
2. **Licencia y costo.** Verificar que el plan gratuito o académico cubra la demo.
3. **Justificación académica.** Hay que actualizar `project_definition.md` §11, que hoy
   dice lo contrario, y sustentar el cambio ante el docente. El argumento defendible:
   el valor de MapIt está en el **motor de gestión espacial** —multi-tenant, estados en
   vivo, reservas, cuatro verticales sobre un mismo modelo— no en el dibujo del canvas.
   Delegar el renderizado libera tiempo para lo que sí se defiende.
4. **Zone.js.** Algunas librerías de terceros lo asumen; MapIt es zoneless. Probarlo pronto.

## Consecuencias

- Se puede construir todo el andamiaje y avanzar en el resto de casos de uso **sin decidir**.
- Conviene resolverlo antes de la Fase 3 del roadmap (editor), no después.
- Coste: una capa de indirección y un mapper si se usa un SDK. Barato comparado con
  reescribir dos features.

## Cuándo se cierra este ADR

Al empezar CU-06. Entonces pasa a _Aceptado_ nombrando el motor elegido, o se sustituye
por un ADR-00XX que documente la elección definitiva.
