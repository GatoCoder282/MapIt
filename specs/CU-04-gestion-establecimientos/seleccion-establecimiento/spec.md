# CU-04 — Selección obligatoria de establecimiento en Console

Estado: spec y plan aprobados por el usuario; implementación y validación funcional completadas. Evidencia y límites en [tasks.md](tasks.md).

## Intención y alcance

Antes de operar en Console, el usuario de staff debe tener un establecimiento activo autorizado. La selección es una preferencia de interfaz, nunca una fuente de permisos ni un cambio de tenant/JWT. Se conserva el modal de dos paneles de la imagen facilitada por el usuario, sin sustituirlo por una página ni un select convencional.

## Decisiones aprobadas

- Consultar `GET /api/v1/establishments/accessible`, no el listado administrativo del tenant.
- Persistir únicamente el ID elegido en localStorage, con clave separada por tenant y usuario.
- Revalidar contra una respuesta nueva al entrar; restaurar sin modal si sigue autorizado.
- Sin preferencia válida, exigir selección explícita y Continuar, incluso con un solo establecimiento.
- Modal nativo no descartable por Escape, clic exterior ni botón de cierre/omisión.
- Mantener composición de la referencia, con miniatura gráfica neutral y sin categorías/fotografías inventadas. La API no expone foto ni tipo.
- Permitir excepciones visuales locales del modal, sin cambiar tokens globales ni documentos del editor.
- Backend, contrato, permisos y selectores específicos de otras features fuera del cambio.

## Criterios de aceptación

- [x] Dado staff autenticado sin preferencia, cuando entra incluso por URL profunda, entonces ve el shell y un modal bloqueante; las pantallas operativas no se instancian hasta confirmar una opción autorizada.
- [x] Dado un ID recordado, cuando el endpoint lo incluye, entonces se restaura sin mostrar el selector ni exigir otro clic.
- [x] Dado un ID borrado, revocado o manipulado en storage, cuando no figura en la respuesta, entonces se descarta y no habilita acceso al contenido operativo.
- [x] Dadas dos identidades/tenants, cuando cambia la sesión durante una petición, entonces no se mezcla su selección, no se aceptan respuestas tardías de la anterior y se limpia el estado en memoria al salir.
- [x] Dada una opción disponible, cuando se marca, entonces la tarjeta muestra radio, borde azul y fondo sutil; solo Continuar confirma y persiste el ID.
- [x] Dado storage bloqueado, cuando confirma una opción, entonces puede trabajar en esa sesión sin que el fallo de persistencia rompa el flujo.
- [x] Dada carga, error o lista vacía, cuando se abre el modal, entonces conserva su composición, comunica el estado y no permite continuar sin opción válida. Error/vacío permiten reintentar; cerrar sesión sale de Console, no elude la selección.
- [x] Dado el modal abierto, cuando se usa teclado, entonces el foco queda dentro, radios y CTA son operables, Escape no lo cierra y lectores de pantalla reciben título/estado.
- [x] Dado viewport estrecho o poca altura, cuando se muestra, entonces opciones y CTA siguen accesibles con scroll y sin desbordamiento horizontal.
- [x] Dado SUPER_ADMIN en el shell de plataforma, cuando administra tenants, entonces este selector de staff no interviene.

## Diseño y alternativas

Una pantalla independiente y un guard con redirección fueron descartados porque contradicen el modal sobre la consola. Se elige un contexto de Console en `core/` y un modal del shell en `layout/`, evitando imports entre features. Se reutilizan signals, el cliente generado, `<dialog>` y Lucide existentes; no se necesitan nuevas dependencias.

Documentación visual específica: `apps/console/design/establishment-selector/`. Valores aproximados de la captura se marcan como inferidos. No se afirma coincidencia pixel-perfect sin comparación ejecutada con un archivo baseline original disponible.

## Límites conocidos

El dashboard y los selectores de reservas/check-in mantienen su alcance actual: este cambio exige contexto de entrada, no convierte sus consultas en filtros globales. Un usuario con cero establecimientos no puede operar; el aprovisionamiento inicial o la concesión de permisos deben resolverse fuera del selector. Los endpoints continúan siendo responsables de la autorización real.

## Datos y esquema

Sin migraciones ni modificaciones de backend. Las únicas preferencias locales son IDs, sin copiar nombres, direcciones, JWT ni listas del servidor a la nueva clave.

## Ampliación aprobada — reemplazar `/establishments`

El usuario aprobó sustituir la pantalla de gestión de esa ruta por el popup existente para elegir/cambiar el establecimiento activo, con regreso a Inicio al confirmar. No es asignación de permisos a usuarios. No se borran datos ni se traslada el CRUD a otra ruta.

- [x] Abrir `/establishments`, incluso con selección recordada válida, abre el mismo popup sobre Inicio en lugar del CRUD.
- [x] El enlace Negocios y los enlaces existentes a `/establishments` abren ese flujo, sin duplicar el componente modal.
- [x] Se actualiza la lista autorizada al solicitar el cambio; solo un ID válido puede confirmarse y guardarse para tenant/usuario actual.
- [x] Confirmar actualiza el contexto y localStorage, cierra el popup y deja `/home` sin el marcador de selección explícita.
- [x] El acceso normal a `/home` mantiene la restauración sin modal y el bloqueo inicial sin selección.
- [x] Se retira el código exclusivo de la pantalla CRUD que quede sin referencias; se conservan backend, datos y el wizard `/spaces/setup`.

Implementación mínima: `/establishments` redirige a `/home?selectEstablishment=1`; el shell interpreta ese estado de UI y reutiliza su selector. El parámetro pide abrir el popup, nunca autoriza un establecimiento. La confirmación elimina el parámetro navegando a `/home`.

## Ajuste visual y cierre opcional — aprobado

El usuario aprobó acercar el popup a su segunda imagen: composición compacta de dos paneles, azul intenso, jerarquía y espaciado de la referencia, tarjetas horizontales y CTA destacado. Se ajusta el componente existente; no se reconstruye el shell ni se añaden dependencias, fotos o categorías ficticias. Las miniaturas continúan siendo neutras porque el contrato no expone foto/tipo.

La nueva X aparece **solo durante el cambio de establecimiento cuando existe una selección anterior revalidada**. Cerrar conserva ese establecimiento y vuelve a `/home` sin `selectEstablishment=1`; no confirma el candidato marcado en el popup. Sin selección anterior válida (primera entrada, revocación, carga o error), no aparece X ni se habilita Escape para eludir el selector. Esto sustituye la prohibición absoluta de cierre únicamente para esa reapertura opcional.

Refinamiento solicitado con una captura del panel izquierdo: conservar posiciones relativas de icono/título/descripción; azul intenso con ondas rellenas, retícula de puntos blancos y bloque inferior con ilustración de mapa/pin junto a tres checks de mapas, reservas/ocupación y pagos/check-in. No cambiar panel derecho, dimensiones generales ni comportamiento de cierre.

- [x] Comparar captura real y ajustar composición/azul/tipografía/tarjetas al diseño aprobado, conservando responsive y foco visible de teclado.
- [x] Mostrar X con nombre accesible únicamente con selección previa revalidada; cancelar conserva ámbito y preferencia anteriores aunque se marque otra tarjeta.
- [x] No permitir cierre inicial, durante carga/error o si se revocó la selección anterior.
- [x] Verificar cierre, Escape condicional, teclado y viewport estrecho con tests y capturas reales; no afirmar fidelidad pixel-perfect sin baseline local original.
