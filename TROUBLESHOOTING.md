# Problemas frecuentes

Antes que nada: **`pnpm doctor`**. Verifica el entorno completo y te dice qué falta
y con qué comando arreglarlo.

---

## Instalación y entorno

### `JAVA_HOME is not set` / el editor no reconoce Java

winget instala el JDK pero no siempre crea la variable.

**Windows:** Panel de Control → _Editar variables de entorno del sistema_ → _Variables de
entorno_ → **Nueva** variable del sistema:

- Nombre: `JAVA_HOME`
- Valor: `C:\Program Files\Eclipse Adoptium\jdk-25.x.x-hotspot`

Añade `%JAVA_HOME%\bin` al `Path`. Reabre la terminal.

**macOS / Linux:** añade a tu `~/.zshrc` o `~/.bashrc`:

```bash
export JAVA_HOME=$(/usr/libexec/java_home -v 25)   # macOS
export JAVA_HOME=/usr/lib/jvm/temurin-25-jdk       # Linux
```

### El editor muestra métodos inexistentes, pero `pnpm check` pasa

En VS Code o Kiro, revisa `java.import.gradle.java.home` en la configuración de usuario
y del workspace. La importación de Gradle necesita un **JDK 25**, aunque la terminal ya
tenga `JAVA_HOME` correcto. Un valor antiguo como `jre-1.8` deja al editor con un modelo
de dependencias desactualizado: aparecen métodos, constructores o paquetes inexistentes
que sí están en el código fuente.

Selecciona la carpeta del JDK 25 instalado (no su subcarpeta `bin`), ejecuta
**Java: Reload Projects** para los módulos del backend y **Java: Rebuild Projects**.
Si el servidor sigue usando el modelo anterior, ejecuta **Developer: Reload Window**.
Abre un archivo Java y espera a que el servidor termine de importar y compilar en modo
estándar antes de evaluar el panel Problems.

### `pnpm: command not found` después de `corepack enable`

La terminal guarda el `PATH` de cuando se abrió. **Ciérrala y ábrela de nuevo.**

### `ERR_PNPM_IGNORED_BUILDS`

No debería pasar: `pnpm-workspace.yaml` ya autoriza los paquetes que lo necesitan.
Si aparece, `pnpm approve-builds` y avisa en el chat del equipo — significa que se
añadió una dependencia nueva con scripts de instalación.

---

## Docker

### `Cannot connect to the Docker daemon`

Docker Desktop está cerrado. Ábrelo y espera a que diga **Running** abajo a la izquierda.

### `port is already allocated` / `address already in use`

Otro programa o una instancia anterior ocupa el puerto. `pnpm dev`, `dev:front` y
`dev:back` comprueban primero los puertos que necesitan, en IPv4 e IPv6. Si están
ocupados, muestran la aplicación y el puerto y no inician procesos adicionales.

Si ya hay una sesión funcionando, úsala o pulsa **Ctrl+C en la terminal que la inició**
antes de ejecutar `pnpm dev` otra vez. `pnpm stop` baja los contenedores Docker;
**no detiene** los servidores Angular/Java iniciados directamente en el host.

Para un conflicto entre contenedores puedes usar `pnpm stop`. También puedes cambiar
el puerto en tu `.env` (solo afecta a tu máquina):

```bash
POSTGRES_PORT=5434
BACKEND_PORT=8081
```

`pnpm doctor` te dice exactamente qué puerto está ocupado.

### SonarQube no arranca o tumba la máquina

Necesita ~2 GB de RAM y Elasticsearch. Súbele memoria a Docker Desktop
(Settings → Resources → 8 GB) o simplemente **no lo levantes**: solo corre en la
máquina de calidad y cada varias semanas. Para el día a día basta SonarLint en el editor.

---

## Base de datos

### La app no arranca: `Schema-validation: missing table` / `wrong column type`

Hibernate está en `ddl-auto: validate` **a propósito**: te está avisando de que una
entidad JPA no coincide con el esquema. Casi siempre significa que alguien añadió un
campo y **olvidó la migración**.

```bash
pnpm db:info                          # ¿qué migraciones se aplicaron?
pnpm db:new "añadir columna X a Y"    # crea la que falta
pnpm db:migrate
```

**Nunca** lo "arregles" poniendo `ddl-auto: update`: eso rompe la reproducibilidad
del esquema para los otros 4.

### `Validate failed: migration checksum mismatch`

Alguien editó una migración **ya aplicada**. Flyway guarda un hash de cada archivo.

La regla es: **una migración mergeada no se toca jamás**. Para corregir algo, se crea
una migración nueva. Si el archivo cambió en tu rama sin haberse mergeado, en local:

```bash
pnpm infra:reset && pnpm db:migrate    # borra los datos locales y reaplica todo
```

### Pagos V20–V28 anteriores al merge frente a V23–V31 actuales

Este caso es una renumeración local: los nueve archivos de pagos tienen el mismo
contenido/checksum, pero main introdujo antes las migraciones de auditoría e historial.
Flyway no puede deducir esa equivalencia y rechaza el arranque. No lo resuelvas con
`repair`, desactivando validación o reiniciando la base con pérdida de datos.

Con Docker activo, diagnostica sin modificar:

```bash
node tools/scripts/reconcile-local-payment-migrations.mjs
```

La herramienta solo acepta el historial legacy completo con cada checksum idéntico.
Si corresponde a tu caso, detén el backend y ejecuta:

```bash
node tools/scripts/reconcile-local-payment-migrations.mjs --apply
pnpm db:migrate
```

`--apply` crea primero un respaldo completo en `.tmp/before-payment-history-*.dump`,
comprueba que el historial no cambió bajo bloqueo, reasigna solo las versiones y nombres
equivalentes y deja que Flyway ejecute V20–V22 con `outOfOrder` para esa única recuperación.
Los checksums aplicados se conservan. Después Flyway vuelve a su modo habitual.
Reinicia el backend para cargar el código y esquema actuales; conserva el respaldo local.
No uses esta herramienta para otros conflictos de migraciones ni bases remotas.

### Una consulta no devuelve filas que sé que existen

Es la Row-Level Security haciendo su trabajo (CU-02). Sin `app.tenant_id` fijado en la
sesión, las tablas de negocio devuelven **cero filas** — falla cerrado, no abierto.

Comprueba que la petición pasó por el filtro de tenant y que el JWT trae el claim `tenant`.
Para inspeccionar a mano:

```sql
BEGIN;
SET LOCAL app.tenant_id = 'demo';
SELECT * FROM mi_tabla;
COMMIT;
```

---

## Backend

### La primera compilación tarda muchísimo

Normal: Gradle descarga Spring Boot y sus dependencias (3-5 min, una sola vez).
Las siguientes son de segundos gracias al build cache y al configuration cache.

### `Timeout waiting to lock file hash cache`

Hay dos builds de Gradle corriendo a la vez. Espera a que termine el primero, o cierra
el proceso. Si quedó huérfano:

```bash
# Windows
taskkill /F /IM java.exe
```

### Errores raros de Jackson al copiar código de internet

**Spring Boot 4 usa Jackson 3.** Los paquetes cambiaron:

```java
import com.fasterxml.jackson.databind.ObjectMapper;  // ❌ Jackson 2 (deprecado)
import tools.jackson.databind.ObjectMapper;          // ✅ Jackson 3
```

Es el error nº 1 al pegar snippets escritos para Spring Boot 3.

### La app arranca pero las migraciones NO se ejecutan

Síntoma: no existe la tabla `flyway_schema_history` y en los logs no aparece Flyway.

**Spring Boot 4 partió las autoconfiguraciones en módulos separados.** Tener
`org.flywaydb:flyway-core` en el classpath ya **no** activa Flyway por sí solo: hace falta
también `org.springframework.boot:spring-boot-flyway`. Ya está en el Version Catalog
(bundle `flyway`), pero si añades otra integración de Boot 3 por tu cuenta, comprueba si
necesita su módulo de autoconfiguración.

Es un fallo especialmente traicionero porque **no da error**: la aplicación arranca
perfectamente y la base de datos simplemente se queda vacía.

### La app no arranca por una propiedad de `spring.jackson.*`

Ejemplo real:

```
failed to convert java.lang.String to tools.jackson.databind.SerializationFeature
(No enum constant ...SerializationFeature.write-dates-as-timestamps)
```

**Jackson 3** reorganizó sus features: `WRITE_DATES_AS_TIMESTAMPS` salió de
`SerializationFeature` y vive ahora en `DateTimeFeature`. Cualquier propiedad copiada de
una guía de Spring Boot 3 puede impedir el arranque.

No hace falta declararla: Jackson 3 ya serializa las fechas como ISO-8601 por defecto.

### `expected single matching bean but found 2: corsConfigurationSource, mvcHandlerMappingIntrospector`

Spring MVC registra su propio `mvcHandlerMappingIntrospector`, que también implementa
`CorsConfigurationSource`. Hay que cualificar por nombre:

```java
@Qualifier("corsConfigurationSource") CorsConfigurationSource cors
```

### `package org.springframework does not exist` en un módulo `-domain`

**No es un error: es la arquitectura funcionando.** La capa `domain` no declara Spring
como dependencia a propósito (plan §3), así que una fuga de capa no compila.

Tu lógica pertenece a `*-application` (si orquesta un caso de uso) o a
`*-infrastructure` (si toca la BD, HTTP o el exterior).

---

## Frontend

### `The Angular Compiler requires TypeScript >=6.0.0`

Angular 22 exige TypeScript 6. No bajes la versión: está fijada en el `package.json` raíz.
Si aparece, borra `node_modules` y reinstala:

```bash
rm -rf node_modules && pnpm install
```

### `Can't find stylesheet to import` con `@use 'ui-kit/...'`

Los estilos de `libs/` se resuelven vía `stylePreprocessorOptions.includePaths` en
`angular.json`. Si añadiste una app nueva, cópiale esa opción.

### El lint se queja de `*ngIf`, `NgClass` o `provideZoneChangeDetection`

No es un falso positivo. Son reglas deliberadas del proyecto:

| En vez de                      | Usa                       | Por qué                                                |
| ------------------------------ | ------------------------- | ------------------------------------------------------ |
| `*ngIf` / `*ngFor`             | `@if` / `@for`            | Control flow nuevo: más rápido y no hay que importarlo |
| `NgClass` / `NgStyle`          | `[class.x]` / `[style.x]` | Recomendación explícita del style guide oficial        |
| `provideZoneChangeDetection()` | (nada)                    | MapIt es zoneless — es el default desde Angular 21     |

### Los feature flags no cambian al apagarlos en Unleash

1. El frontend consulta el **proxy** (`:3063`), no Unleash directo. Comprueba que el
   contenedor `mapit-unleash-proxy` está arriba: `pnpm infra:ps`.
2. Hay un sondeo cada 15 s: espera un momento o recarga.
3. Si el proxy está caído, la app usa los **valores por defecto** del catálogo y sigue
   funcionando. Eso es deliberado: el servidor de flags no puede tumbar la aplicación.

---

## ¿Nada de esto lo resuelve?

1. `pnpm doctor` y pega la salida completa en el chat del equipo.
2. Reinicio limpio (⚠️ borra los datos locales):
   ```bash
   pnpm stop
   pnpm infra:reset
   pnpm install
   pnpm setup
   ```
3. Si encontraste un problema nuevo, **añádelo a este archivo** en tu PR.
   Es lo que evita que las siguientes 4 personas tropiecen con lo mismo.
