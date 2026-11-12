# Selector obligatorio — tareas y notas de ejecución

- [x] Reconocer auth, rutas, primitivas, tokens y endpoint autorizado.
- [x] Acordar localStorage por tenant/usuario y restauración sin modal tras validar.
- [x] Aprobar alternativa neutral a foto/tipo y excepciones visuales locales.
- [x] Revisar spec/plan y documentos de diseño antes de código.
- [x] Contexto con tests: persistencia, invalidez, cambios de sesión, carreras y error.
- [x] Modal accesible, estados y shell sin operaciones hasta confirmar/restaurar.
- [x] E2E focalizado y capturas responsive.
- [x] QA visual/a11y, validación agregada y revisión de diff.

## Notas de ejecución

- Usuario aprobó spec/plan e implementación con especialistas. Ámbitos paralelos separados: contexto en `core/`, UI/shell y test E2E nuevo.
- Se conserva el workspace/rama actual sin commits; no se traslada ni modifica el trabajo ajeno presente. La evidencia de validación se registra por ámbito y se consolida al final.
- Servidores existentes detectados: Console `:4200` y public-web `:4300` responden 200; API `:8080` responde 401 sin sesión. Se reutilizan, no se reinician.
- Motion: la entrada de 180 ms quedó como recomendación opcional, no se aplica; selección y acción permanecen inmediatas.
- Contexto: 13 tests focalizados verdes según ejecución del implementador; revisión independiente de spec y calidad aprobada. Incluye reintento vacío, limpieza de preferencia inválida, nueva sesión del mismo actor y lectura de `active()` antes del primer effect. Validación agregada pendiente de reconciliar UI.
- Fixtures E2E existentes de home, plantillas y editor adaptados con IDs reales del tenant/usuario/establecimiento; validación del listado sigue siendo del servidor. Archivos payment-live ajenos no se editan.
- La revisión independiente de UI y el checklist Web Interface Guidelines quedaron sin hallazgos pendientes tras corregir nombre accesible, foco, safe areas y cancelación accidental del click nativo de radios.
- `pnpm check` ejecutado una vez: formato, tipos, 500 tests frontend (314 console, 119 público, 67 libs), ambos builds, hash del contrato y build backend verdes. Falló únicamente lint nuevo; después de corregir tipos de DOM, interfaces lifecycle y `ngSrc`, `pnpm fe:lint` y `pnpm fe:typecheck` completos pasaron. No se repitió toda la suite innecesariamente; los 10 tests selector/shell pasaron tras esos cambios mecánicos.
- E2E focalizado final: 14/14 verdes en console y console-tablet. Navegación/recarga esperan la respuesta de establecimientos accesibles, no un sleep: el arranque frío podía superar los 5 s de la aserción anterior. Se verificó selección, persistencia/recarga, restauración, revocación, aislamiento, vacío/reintento, URL profunda, Escape/foco y capturas a 390 px sin overflow horizontal.
- Se inspeccionaron capturas reales de escritorio y móvil. No hay archivo local original de referencia: no se ejecutó ni se afirma un diff de píxeles al umbral 0.02. Miniaturas neutrales siguen siendo la excepción aprobada por ausencia de fotos/tipo en API.
- Regresión real de fixtures modificados: 5/5 E2E verdes de home visual, plantillas CRUD y editor de planta, contra el backend existente; no se alteraron snapshots para hacerlos pasar.
- Compatibilidad pendiente de coordinación: los E2E payment-live con cambios ajenos inyectan sesión sin preferencia y ahora deben seleccionar un establecimiento autorizado. No se modifica ese trabajo ajeno ni se introduce una excepción de producción para eludir el selector.
- La API `listAccessibleEstablishments` ya aplica tenant y permisos del actor; no usar el listado administrativo como sustituto.
- La API accesible no tiene foto/tipo. Usuario aprobó miniatura neutral y no inventar categorías.
- No existe contexto global activo; los strings `establishmentContext` ya existen y pueden reutilizarse.
- `libs/ui-kit/DESIGN.md` y tokens SCSS siguen siendo autoridad global; documentos existentes en `apps/console/design/` describen el editor, no sobrescribirlos.
- Cambios previos ajenos en E2E payment-live y documentación de pagos quedan fuera del alcance.
- Pendiente validación; no hay medición de diferencia visual contra la imagen original.

## Ampliación — `/establishments` abre el selector

Usuario aprobó reemplazar la pantalla, sin mover CRUD a otra ruta, sin borrar datos ni modificar backend. El popup existente selecciona contexto activo, no concede permisos.

- [x] Aprobar flujo: `/establishments` abre popup; confirmar guarda selección y vuelve a Inicio.
- [x] Sustituir ruta y conectar apertura explícita en shell, con pruebas focalizadas.
- [x] Retirar código exclusivo de gestión que quede huérfano y sin modificaciones ajenas.
- [x] Probar acceso directo y Negocios, cambio/persistencia, errores y restauración normal.
- [x] Revisión y validación agregada; documentar resultados.

Notas de ampliación:

- Los enlaces existentes a `/establishments` se conservan como accesos al selector. Se ajustan los textos de acceso rápido/CTA que antes prometían registrar o gestionar negocios, para no anunciar funciones que ya no ofrece ese destino.
- Retirados los cuatro archivos exclusivos de la antigua pantalla (UI, store, spec del store y adaptador). Se comprobaron referencias y ausencia de cambios ajenos antes de eliminarlos; no se borraron datos ni endpoints.
- `pnpm check` completo en verde: formato, lint, tipos, 498 tests frontend (312 console, 119 público, 67 libs), builds frontend, contrato y build/tests/ArchUnit backend. Persisten advertencias no bloqueantes de tamaño de bundles/estilos y dependencias CommonJS; no se alteraron presupuestos para ocultarlas.
- E2E final: 20/20 verdes en console y console-tablet, incluidos acceso directo a ruta antigua, clic Negocios, cambio de selección, persistencia tras recarga y error/reintento al refrescar lista autorizada. La fixture no sobrescribe el nuevo ID al recargar.
- Revisión independiente del cambio y checklist Web Interface Guidelines: sin defectos accionables; diseño/estilos del popup se reutilizan sin cambios. Backend, contrato y dependencias intactos; sin commits ni push.

## Ajuste visual y X opcional

- [x] Usuario aprobó acercar el popup a la segunda imagen con miniaturas neutras.
- [x] Usuario eligió X solo con selección previa válida; sin cierre en primera selección.
- [x] Documentar alcance, cancelación segura y archivos antes de implementar.
- [x] Implementar cierre condicional y pruebas de revalidación/candidato descartado.
- [x] Aplicar visual de referencia y comprobar capturas responsive/a11y.
- [x] Reconciliar, ejecutar verificación agregada y registrar evidencia.

El refresh actual vacía `active`: la X no debe depender solo de su valor durante esa carga ni restaurar un ID sin revalidarlo. No hay aprobación para cambiar backend/contrato ni para inventar fotos/tipos de establecimiento. No se afirma que el CSS existente ya coincide con la referencia sin comparar navegador real.

Refinamiento posterior solicitado por el usuario: ajustar exclusivamente el panel izquierdo a su recorte de referencia (ondas rellenas, puntos, icono de mapa/pin y beneficios agrupados). Se conservan derecha y X. La comprobación agregada iniciada antes de este refinamiento no sustituye verificar los últimos estilos y textos; se reutiliza solo para código que no cambió.

Evidencia del ajuste y cierre:

- Tests propios selector/shell: **22/22 verdes**, incluido test rojo→verde que limpia el ID previo al cambiar usuario/tenant; la X no hereda la selección de otra identidad.
- E2E ejecutado por el orquestador: `pnpm --filter @mapit/e2e exec playwright test tests/console/establishment-selector.spec.ts --project=console --project=console-tablet --workers=1`: **22/22 verdes**, con revocación, cierre conservando preferencia, aislamiento, entrada obligatoria, Escape/Tab y móvil.
- `pnpm check` completo verde antes del último refinamiento izquierdo: **535 tests frontend** (349 console, 119 público, 67 libs), lint, tipos, ambos builds, hash y backend aprobados; Gradle reutilizó tareas up-to-date. Persisten advertencias no bloqueantes de tamaño y CommonJS, sin alterar presupuestos.
- Refinamiento izquierdo implementado en HTML/SCSS y strings: fondo eléctrico/azul noche con ondas rellenas, puntos blancos, tienda outlined, mapa/pin decorativo junto a tres beneficios. La derecha y el cierre no se modificaron. Capturas reales desktop y390 inspeccionadas; E2E focalizado visual del diseñador **1/1 verde** con comprobación de overflow.
- No existe baseline original local para un diff de píxeles: no se afirma identidad pixel-perfect. Sin nuevas fotos, categorías, dependencias, persistencia ni cambios backend/contrato. Sin commits/push.
- Verificación propia posterior al refinamiento izquierdo detectó CSS de 12,43 kB frente al límite de error de 12 kB (432 bytes de exceso). Se solicita eliminar redundancias sin alterar diseño ni elevar presupuesto; no se considera cerrado ese build hasta repetirlo verde. Retirado además el import LucideShieldCheck ya no utilizado por la nueva tercera línea.
- Cierre verificado por el orquestador sobre el estado final: `pnpm exec ng build console`, ESLint focalizado, Prettier y `git diff --check` **verdes**. Al retirar CSS redundante el selector queda en **11,73 kB**, sin elevar límites; persiste solo su warning de 4 kB. E2E final de tarjetas/responsive y cierre en console/console-tablet: **4/4 verdes**. Se reutiliza la comprobación agregada anterior para lógica/backend no modificados por este último refinamiento visual.
