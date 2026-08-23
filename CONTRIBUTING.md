# Cómo trabajamos en MapIt

Somos 5 y desarrollamos con **Spec-Driven Development**: la especificación es el
entregable valioso, y el código es su consecuencia. Este documento es el flujo real.

---

## El ciclo: spec → plan → tasks → código

Cada caso de uso (CU-01 … CU-24) tiene su carpeta en `specs/`.

```bash
git switch -c feat/CU-12-crear-reserva
pnpm new:spec CU-12-crear-reserva
```

Eso crea tres archivos, y se llenan **en orden**:

| Archivo    | Responde                                                                            | Antes de         |
| ---------- | ----------------------------------------------------------------------------------- | ---------------- |
| `spec.md`  | **QUÉ** y **POR QUÉ**: criterios de aceptación, reglas de negocio, fuera de alcance | pensar en código |
| `plan.md`  | **CÓMO**: módulos, contrato, migraciones, **patrones de diseño**                    | escribir código  |
| `tasks.md` | tareas ejecutables y verificables, en orden                                         | empezar          |

> **La sección "Patrones de diseño aplicados" de `plan.md` es obligatoria.**
> Tiene columnas _por qué aquí_ y _alternativa descartada_ a propósito: meter
> patrones para lucirlos hace daño. Catálogo: `docs/architecture/design-patterns.md`.

### Por qué esto importa más trabajando con agentes

Si el código lo escribe mayormente un agente, el trabajo intelectual se mueve a la
especificación. De ahí dos reglas del equipo:

1. **Cada quien es dueño de sus CU** y debe poder explicar su `spec.md` y su `plan.md`
   sin ayuda. Si no entiendes lo que se construyó, no puedes defenderlo ante el docente.
2. **Las barreras automáticas no son burocracia.** ArchUnit, el lint, `ddl-auto: validate`
   y `api:check` son lo que impide que un agente meta una fuga de arquitectura sin que
   nadie lo note en el review.

Anota en `tasks.md` → _Notas de ejecución_ lo que descubriste sobre la marcha. Eso es
lo que hace defendible el trabajo hecho con agentes.

---

## Reglas que el build hace cumplir

No hace falta recordarlas: si las rompes, algo se pone rojo. Pero conviene saber por qué.

| Regla                                                    | Qué la impone                                | Por qué                                          |
| -------------------------------------------------------- | -------------------------------------------- | ------------------------------------------------ |
| `*-domain` no importa Spring ni JPA                      | el compilador (no declara esas dependencias) | el dominio sobrevive a un cambio de framework    |
| `*-application` no importa `*-infrastructure`            | ArchUnit                                     | las dependencias apuntan hacia el dominio        |
| Una feature Angular no importa de otra                   | ESLint                                       | si es compartido, va a `libs/`                   |
| No se importa `konva` fuera de su adaptador              | ESLint                                       | el motor de mapa aún no está decidido (ADR-0006) |
| Nada de `*ngIf`, `NgClass`, `provideZoneChangeDetection` | ESLint                                       | style guide oficial de Angular 22                |
| Toda tabla lleva `tenant_id` + RLS                       | revisión de PR + test de aislamiento         | CU-02: el aislamiento entre empresas             |
| El esquema solo cambia por migración Flyway              | `ddl-auto: validate` rompe el arranque       | los 5 tenemos la misma BD                        |
| El código va después del contrato                        | `pnpm api:check` en CI                       | front y back avanzan en paralelo sin bloquearse  |

---

## Flujo de trabajo

### Ramas

```
main                    protegida: solo por PR con 1 aprobación
feat/CU-12-crear-reserva
fix/reserva-no-libera-mesa
docs/adr-motor-de-mapa
chore/actualizar-angular
```

### Commits — Conventional Commits

```
feat(reservations): crear reserva asociada a un SpaceElement
fix(spaces): el editor perdía la rotación al guardar
docs(adr): registrar la decisión del motor de mapa
chore(deps): subir Angular a 22.1.5
test(identity): aislamiento entre tenants
```

Tipos: `feat` · `fix` · `docs` · `test` · `refactor` · `chore` · `build` · `ci`
Alcances: `platform` `identity` `spaces` `operations` `reservations` `payments`
`console` `public-web` `infra` `contract`

Hay un hook que valida el formato: un commit mal escrito se rechaza al hacerlo,
no en el PR.

### Antes de cada push

```bash
pnpm check
```

Corre lint, tipos, tests, build y verificación del contrato — front y back. Tarda un
par de minutos y evita un CI en rojo que bloquea a los demás.

Si falla el formato: `pnpm fmt`.

### El Pull Request

La plantilla pide enlazar `specs/CU-XX/` y marcar los criterios de aceptación cumplidos.
Un PR sin spec asociada se devuelve.

---

## Contrato API: se edita ANTES del código

```bash
# 1. Editar el contrato — fuente de verdad
code packages/api-contract/openapi.yaml

# 2. Validar y regenerar
pnpm api:lint
pnpm api:gen

# 3. Ahora sí, implementar
```

Del contrato salen **el cliente TypeScript** y **las interfaces Java** que los
`@RestController` deben implementar. Si cambias el contrato sin regenerar, el build
de Java falla porque el controlador ya no implementa la interfaz.

¿Frontend bloqueado esperando al backend? No hace falta:

```bash
pnpm api:mock      # Prism sirve el contrato en :4010
```

---

## Base de datos

```bash
pnpm db:new "crear tabla reservation"   # crea la migración con la plantilla correcta
pnpm db:migrate
pnpm db:info
```

Tres reglas:

1. **Toda tabla de negocio** nace con `tenant_id TEXT NOT NULL REFERENCES tenant(id)`,
   índice `(tenant_id, id)` y `SELECT enable_tenant_isolation('tabla');`
2. **Una migración mergeada no se edita jamás.** Para corregir, se crea otra.
3. `docs/db/mapit.dbml` se actualiza en el **mismo commit** que la migración.

---

## Feature toggles

```bash
pnpm new:flag payments.qr release
```

Crea la flag coherente en los tres sitios (enum Java, catálogo TS, bootstrap de Unleash).
Luego créala también en la UI: <http://localhost:4242>.

```java
// Backend — nunca se usa Unleash directamente, siempre el puerto
if (flags.isEnabled(FeatureFlag.PAYMENTS_QR)) { … }
```

```html
<!-- Angular -->
@if (flags.isEnabled('payments.qr')()) { … }
<p *featureFlag="'payments.qr'">…</p>
```

**Higiene:** las flags de tipo `release` nacen con fecha de retiro y un issue de limpieza.
Las flags zombis son deuda técnica: cada una es una rama de código que nadie prueba.

---

## Testing

```bash
pnpm be:test    # unit + ArchUnit (rápido, sin Docker)
pnpm be:it      # integración con Testcontainers (necesita Docker)
pnpm fe:test    # Vitest
pnpm e2e        # Playwright
```

Qué se espera de cada caso de uso:

- **Reglas de negocio** → test unitario en `*-domain`, sin contexto Spring (milisegundos)
- **Persistencia** → test de integración con Testcontainers, contra un Postgres real
- **Tabla nueva** → test de aislamiento entre tenants, **obligatorio**
- **ViewModel** → Vitest sobre el signal store, sin renderizar componentes
- **Flujo de usuario completo** → un E2E, no más

---

## Convenciones de código

### Angular (style guide oficial)

```
user-profile.ts        ✅  sin sufijo de tipo
user-profile.component.ts  ❌
```

- Organización **por feature**, no por tipo: nada de `components/`, `services/`
- `inject()`, no parámetros de constructor
- Componentes solo de presentación; la lógica vive en el ViewModel (signal store)
- Miembros usados solo por la plantilla: `protected`
- Inputs, outputs y queries: `readonly`
- Nada de `utils.ts`, `helpers.ts` ni `common.ts`

### Estructura de una feature (MVVM)

```
features/reservations/
├── ui/       componentes y plantillas — solo binding y eventos
├── model/    el ViewModel: signal store con estado y comandos
└── data/     llamadas al api-client
```

### Java

- Un módulo por bounded context; tres capas por módulo
- Los puertos se declaran en `domain`, se implementan en `infrastructure`
- `@NullMarked` a nivel de paquete (JSpecify)
- El formato lo aplica Spotless: `pnpm be:fmt`

---

## ¿Trabajas con agentes de IA?

Lee [`AGENTS.md`](AGENTS.md). Cada carpeta tiene el suyo con el contexto de esa sección,
qué reglas rigen ahí y qué cargar antes de empezar.
