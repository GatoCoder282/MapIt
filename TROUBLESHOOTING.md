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

Otro programa ocupa el puerto. Dos salidas:

```bash
pnpm stop        # si es una sesión previa de MapIt
```

O cambia el puerto en tu `.env` (solo afecta a tu máquina):

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
