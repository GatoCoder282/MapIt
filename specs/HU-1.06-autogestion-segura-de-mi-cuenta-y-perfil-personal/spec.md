# HU-1.06 — Autogestión segura de mi cuenta y perfil personal

> **Estado:** Nombre, teléfono e idioma conectados en backend/UI; correo de solo lectura. V40 preparada, flag OFF. QA PostgreSQL/RLS, E2E y contraseña pendientes · **Creada:** 2026-11-21 · **Responsable:** rodrigo40r · **Ticket:** [MAP-285](https://matiasmv2005.atlassian.net/browse/MAP-285)

## Enunciado

Como usuario autenticado de MapIt, quiero consultar y mantener mi perfil personal y cambiar mi contraseña de forma segura para actualizar mis datos y acceso sin depender del administrador del tenant.

La funcionalidad «Mi cuenta» es distinta de «Usuarios y permisos». Ambas utilizan la cuenta existente en `app_user`, pero tienen operaciones y autorizaciones diferentes.

## 1. Contexto, fuentes y alcance de esta etapa

La entrega inicial `0d11dfa` creó únicamente `spec.md`, `plan.md` y `tasks.md`. La etapa siguiente, autorizada por el solicitante, define OpenAPI y registra la flag OFF con pruebas, sin controladores, migraciones, cambios de autenticación ni revocación. No implementa MAP-286.

El incremento backend posterior a `856e329`, autorizado por el solicitante, implementa únicamente los campos existentes mientras #69 sigue abierto: GET devuelve nombre/correo reales; PATCH persiste solo el nombre. Contacto e idioma se omiten de la respuesta mientras no exista almacenamiento (no se sustituyen por null simulado) y sus escrituras, incluso null, fallan con 503 sin cambios parciales. Se conserva el diseño de sus futuras columnas sin crear migración ni reservar número. Esta entrega no completa MAP-287 ni implementa contraseña.

Fuentes iniciales consultadas el 2026-11-21: Jira, código de `main`, rama remota de MAP-238 y [PR #69](https://github.com/GatoCoder282/MapIt/pull/69). En aquella base `fd22d78903a5a2697c1fc20a4769a2f254d8e526`, #69 estaba abierto con head `20e25e5a5ce34ce1308db8c85c0af78d16a0d8a9`; sus mecanismos aún no estaban disponibles.

Actualización de integración del 2026-11-22: GitHub confirma #69 fusionado, commit `c0de5d7b130b960107e9d909cb8c5a9ebcbd63b2`, incluido en `origin/main` actualizado. Se integra mediante merge normal en la rama publicada de MAP-285, conservando sus 18 commits y V34–V39 sin modificaciones. `CurrentStaffIdentity`, `issuedAt` y `staff_tokens_valid_after` pasan a estar disponibles; no se implementan campos persistidos ni cambio de contraseña en este incremento. Continúan el 503 temporal de contacto/idioma y la ausencia de endpoint operativo de contraseña. Las notas históricas siguientes describen el estado anterior, no bloqueos actuales de disponibilidad del PR.

### Estado técnico actual

Actualización de campos del 2026-11-22: V40 añade `contact_phone` y `preferred_language` opcionales en `app_user`. GET/PATCH devuelven los cuatro campos reales, con null en los opcionales sin valor; ausente conserva y null explícito limpia solo teléfono/idioma mediante una escritura atómica. Se retira el 503 temporal de campos pendientes, manteniendo errores reales de persistencia. La UI edita los tres campos permitidos y aplica un idioma guardado solo tras ACK válido de la misma sesión, sin sustituir la preferencia local al cargar ni al limpiar el idioma de cuenta. La columna persiste entre lecturas; la preferencia local de la barra sigue siendo independiente. Las descripciones de implementación parcial de etapas anteriores se conservan como historia. PostgreSQL no está disponible: la migración y los tests RLS están preparados/compilados, no ejecutados, y no se declara cerrado MAP-287/288 sin esa aceptación.

### 1.1 Requisitos confirmados en Jira

| ID  | Fuente              | Requisito confirmado                                                                                                                                               |
| --- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| R01 | MAP-285, MAP-287    | Consultar y editar exclusivamente el perfil propio, derivando identidad del token validado; nunca aceptar un usuario objetivo arbitrario.                          |
| R02 | MAP-285, MAP-288    | Pantalla independiente de administración de usuarios; nombre, contacto permitido e idioma/preferencias soportadas; persistencia y estados de carga, error y éxito. |
| R03 | MAP-285, MAP-289    | Cambio de contraseña con credencial actual o recuperación verificada, política de seguridad, límites de intentos y comportamiento documentado de tokens.           |
| R04 | MAP-285, MAP-287    | Impedir cambios de rol, tenant, membresías, estado administrativo y privilegios. No cambiar directamente el correo de identidad.                                   |
| R05 | MAP-285, MAP-290    | Autorización backend, pruebas de identidad, aislamiento entre usuarios y tenants, RLS y regresión de login/usuarios, incluyendo móvil.                             |
| R06 | MAP-285, MAP-291    | `mapit.s6.my-account` OFF por defecto, rollout por tenant/entorno, fallback seguro, pruebas ON/OFF y rollback; nunca sustituye autorización.                       |
| R07 | MAP-314             | SUPER_ADMIN utiliza el mismo perfil propio y cambio de contraseña, sin duplicación ni acceso a cuentas ajenas.                                                     |
| R08 | MAP-285             | Mostrar sesiones solo si existe infraestructura real; de lo contrario, excluir listado y «cerrar otras sesiones» y registrar la dependencia.                       |
| R09 | MAP-285 y subtareas | Reutilizar MAP-45, MAP-180, MAP-238, MAP-256 e i18n de MAP-240; OpenAPI, Flyway si aplica y pruebas de integración/E2E.                                            |

### 1.2 Decisiones de alcance confirmadas por el solicitante

- U01: una única rama para MAP-285 y sus seis subtareas: `feat/rodrigo40r/MAP-285-s6-autogestion-segura-de-mi-cuenta-y-perfil-personal`.
- U02: contemplar `GET /api/v1/me`, `PATCH /api/v1/me` y `POST /api/v1/me/password`.
- U03: persistir nombre, contacto e idioma soportado sobre `app_user`; correo de identidad de solo lectura.
- U04: en esta etapa solo documentación y un commit local, sin push, PR, merge, aplicación, Docker, setup ni dev. `main` no se modifica.
- U05: etapa de contrato/registro autorizada después de `0d11dfa`: tres operaciones OpenAPI y flag OFF con commits separados, sin endpoints funcionales ni dependencias de autenticación nuevas. U04 describe el límite de la entrega inicial, no impide estos cambios posteriores.
- U06: incremento MAP-288 autorizado sobre los siete commits existentes: pantalla de nombre/correo reales y PATCH de nombre, misma rama, sin contraseña ni campos no persistibles. Conservar el idioma local de navegador y comprobar UI/guard/navegación sin iniciar aplicación o Docker. D05 se concreta mediante una sola feature en ambos shells; la aceptación visual/E2E queda pendiente.
- U07: incremento MAP-291 autorizado sobre los once commits existentes: auditar y completar registro/fallo cerrado, aislamiento de evaluaciones y rollback, con pruebas y runbook. Sin activar servicios/flags remotas, cambiar JWT/autenticación ni implementar otras historias. Los límites locales de caché y callbacks descritos abajo son decisiones técnicas del incremento, no valores literales de Jira.
- U08: incremento MAP-289 autorizado sobre catorce commits: componentes independientes de validación y presupuesto, contratos/errores seguros y formulario preparado sin disponibilidad. No conectar HTTP ni escribir hash hasta integrar/revisar revocación efectiva de MAP-238; no declarar MAP-289 completa. Cuotas concretas y detalles de validación son decisiones técnicas documentadas, no requisitos literales de Jira.

### 1.3 Propuestas técnicas pendientes de validación

Los detalles siguientes no aparecen definidos literalmente en Jira. Constituyen el diseño recomendado y deben resolverse en las tareas de preparación antes del código afectado; este commit no los presenta como decisiones funcionales aprobadas.

| ID  | Propuesta                                                                                                                                                     | Validar antes de                         |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| D01 | Campos `fullName`, `contactPhone` opcional y `preferredLanguage` opcional; validaciones y PATCH de §6.                                                        | Contrato/migración de MAP-287.           |
| D02 | DTOs, operationId, errores y códigos HTTP descritos en `plan.md`; `404` para función deshabilitada tras validar identidad/permisos.                           | OpenAPI de MAP-287/289.                  |
| D03 | MVP de contraseña mediante contraseña actual y confirmación de la nueva; invalidar todos los JWT anteriores, incluida la sesión actual, y exigir nuevo login. | Contrato/código de MAP-289.              |
| D04 | Reutilizar `staff_tokens_valid_after` y `CurrentStaffIdentity` de MAP-238, una vez integrados y revisados; resolver concurrencia y precisión de `iat`.        | Cualquier cambio de tokens o contraseña. |
| D05 | Ruta staff `/my-account`; `/admin/profile` carga la misma feature bajo el shell de plataforma.                                                                | Rutas de MAP-288/314.                    |
| D06 | Registrar el toggle como `release`, con fecha de retiro e issue de limpieza; definir fallback y caducidad de caché después de ON.                             | Registro/rollout de MAP-291.             |
| D07 | Reutilizar el limitador PostgreSQL con presupuestos específicos por cuenta e IP, sin cambiar los límites del login por implicación.                           | MAP-289 y sus pruebas.                   |

Para la etapa de contrato se concretan D01/D02 en `openapi.yaml`: `fullName`, `contactPhone`, `preferredLanguage`, DTOs cerrados y errores compartidos; teléfono de hasta 32 caracteres con dígitos y separadores `+ ( ) espacio . / -`, y nombre de una línea sin blancos externos. D03 se documenta como obligación futura de éxito del cambio de contraseña, sin afirmar revocación disponible. D04/D07 y la persistencia continúan pendientes; la publicación del contrato no cierra aceptación funcional.

## 2. Actores

| Actor                             | Alcance personal                                                                                                             |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| ADMIN, MANAGER, STAFF             | Leer/editar su propio perfil y cambiar su contraseña con prueba de control. Su rol no concede acceso personal a otra cuenta. |
| SUPER_ADMIN                       | Las mismas operaciones sobre su fila de `app_user` en el tenant técnico `platform`; ninguna selección de tenant destino.     |
| Visitante o cliente final anónimo | No tiene acceso a Mi cuenta de Console. Las credenciales públicas de reservas no son JWT staff.                              |

## 3. Precondiciones y dependencias

- JWT validado por la infraestructura existente de MAP-45; actor y tenant derivados del principal autenticado.
- `app_user` existente y acceso mediante `mapit_app` sujeto a RLS. El owner se reserva a Flyway.
- MAP-180 aporta cuentas/onboarding. No crear otra identidad ni otro bootstrap de SUPER_ADMIN.
- MAP-256 integrado usa correo normalizado globalmente único (V32), una cuenta por tenant y login `/auth/global-login`. No hay membresías múltiples ni registro autónomo disponibles en la spec implementada.
- MAP-238 sigue en PR #69: aporta identidad vigente, validación de cuenta/tenant/rol, corte temporal de JWT y controles STOMP. No copiar ni sustituir esos mecanismos en esta etapa.
- MAP-240 aporta `@mapit/i18n`: `es`, `en`, `ja-JP`, fallback español y preferencia local por origen.
- Antes de implementar código, revisar esta especificación y resolver las propuestas que afecten al incremento. La autorización para crear documentación no significa que MAP-287 o MAP-285 estén terminadas.

## 4. Flujo principal

1. Con la flag habilitada, el usuario autenticado abre Mi cuenta sin tener que seleccionar un establecimiento.
2. Console consulta `GET /api/v1/me`. El servidor resuelve la cuenta usando exclusivamente actor y tenant autenticados.
3. Se muestran el perfil propio y el correo de identidad de solo lectura. La UI no ofrece campos de administración.
4. El usuario edita los campos permitidos y guarda mediante `PATCH /api/v1/me`.
5. Backend valida el payload y actualiza solo las columnas autorizadas de esa cuenta en una transacción con RLS.
6. La UI refleja la respuesta persistida, actualiza el nombre mostrado y aplica el idioma soportado. No informa éxito antes de la respuesta.
7. Para cambiar contraseña se solicita prueba de control; el MVP propuesto usa contraseña actual y nueva contraseña confirmada.
8. `POST /api/v1/me/password` valida reglas y límites. El cambio y la invalidación aplicable son atómicos conforme al contrato acordado con MAP-238.
9. Con D03, tras éxito se elimina la sesión local y se vuelve al login; la contraseña anterior y los JWT previos dejan de autorizar según el mecanismo probado.

## 5. Flujos alternos y errores

- Sin JWT válido, expirado o revocado: denegar sin leer ni modificar datos personales.
- Cuenta inactiva, tenant suspendido o autoridad obsoleta: aplicar el mecanismo vigente de identidad; no confiar solo en los claims antiguos.
- Campo desconocido/prohibido, idioma no soportado o formato inválido: rechazar la solicitud completa sin actualizaciones parciales.
- Contraseña actual incorrecta, confirmación diferente o contraseña nueva inválida: no modificar hash ni invalidar tokens; mostrar error localizado sin revelar secretos.
- Límite de intentos superado: denegar con respuesta y espera documentadas, sin crear otro sistema de contadores.
- Cambio concurrente de identidad, logout o respuesta tardía: no mostrar ni persistir datos de la cuenta anterior en la nueva sesión.
- Fallo de almacenamiento del navegador: informar conforme al comportamiento existente; no convertir una persistencia fallida en éxito remoto ficticio.
- Flag OFF o evaluación no fiable: aplicar fallback acordado, ocultar la entrada nueva y bloquear la superficie nueva sin afectar login/usuarios existentes. La autorización sigue ejecutándose independientemente de la flag.

### 5.1 Política local de disponibilidad y rollback — MAP-291

- Registro único `mapit.s6.my-account` OFF en enum Java, catálogo TS y bootstrap Unleash versionado. No se ha verificado ni cambiado su estado remoto. Tipo release, retiro previsto 2027-02-21; issue específico de retirada y rollout real pendientes.
- Frontend: ámbito por revisión de sesión/usuario/tenant/rol, OFF inicial, sin heredar ON global, limpieza al salir/cambiar identidad y descarte/aborto de respuestas anteriores. La flag ausente, error del proxy o evaluación inválida devuelve OFF; no cambia el fallback global de otras flags.
- Con temporizadores activos, sondeo contextual por defecto cada 15 s y timeout máximo 5 s. Una pestaña suspendida puede demorar actualizaciones. Un proxy que responde desde caché no informa al navegador de la frescura del servidor upstream; el ocultamiento en ese escenario requiere QA real y no se presenta como demostrado.
- Backend: evaluación por tenant explícito después de autenticación/elegibilidad; sin tenant, flag ausente, proveedor deshabilitado, excepción/error del SDK o snapshot sin confirmar → OFF. Mi cuenta requiere snapshot aplicado/respaldado tras fetch real; un backup restaurado no basta. Confirmación caduca a los 30 s con reloj monotónico; NOT_CHANGED/304 renueva solo un snapshot previamente confirmado. No altera decisiones de otras flags ni cachea permisos de usuario.
- OFF bloquea nuevas operaciones personales y la navegación tras propagación, sin cerrar sesiones, cambiar JWT/roles/contraseñas, borrar datos ni revertir migraciones. Una operación ya autorizada puede terminar; cancelar HTTP no revierte su transacción. Recuperación exige evaluación vigente y lectura fresca, sin reenviar borradores descartados.
- El runbook selectivo está en `plan.md` §8. No se utiliza el seed global ni se apaga el proveedor completo para este rollback. CA-07/CA-12 quedan abiertos hasta QA real por tenant/entorno, proxy/servidor, persistencia y regresión de negocio; las pruebas automáticas locales no sustituyen esa evidencia.

## 6. Reglas de negocio y datos

Preparación MAP-289: comando redactado sin identidad objetivo, validador contra hash confiable suministrado por el futuro caso de uso, payload cerrado y limitador con buckets propios. No existe caso de uso escritor ni controlador de contraseña. POST `/api/v1/me/password` permanece ausente aun con sesión válida/flag ON; el contrato OpenAPI sigue planned. El formulario no está montado ni puede enviar HTTP. Esto no acredita revocación ni cambio efectivo de contraseña.

### 6.1 Identidad y propiedades protegidas

- El objetivo siempre es el par `(tenant del principal, usuario del principal)`.
- No aceptar identidad objetivo por body, query, header ni ruta. Un `userId` o tenant manipulado nunca selecciona otra fila, incluso dentro del mismo tenant.
- Ni SUPER_ADMIN puede usar esta API para administrar cuentas ajenas.
- Rechazar escrituras de `email`, `role`, `tenantId`, `tenantSlug`, membresías, `active`, estado administrativo, asignaciones y permisos. Mantener el correo sin cambios y conservar su unicidad global.
- El contrato tendrá esquemas de entrada cerrados. La validación backend debe rechazar propiedades desconocidas; OpenAPI o campos ocultos en UI no bastan.

### 6.2 Datos personales propuestos (D01)

| Campo               | Persistencia propuesta                       | Validación/semántica propuesta                                                                                            |
| ------------------- | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `fullName`          | Columna existente `full_name`.               | Texto sin blancos externos, 1–120 caracteres, no nulo ni vacío.                                                           |
| `contactPhone`      | Nueva columna nullable `contact_phone`.      | Teléfono de contacto informativo, máximo 32 caracteres; formato exacto por cerrar. No autentica ni habilita recuperación. |
| `preferredLanguage` | Nueva columna nullable `preferred_language`. | Solo `es`, `en`, `ja-JP`; null conserva el fallback existente. No modifica tenant, vertical ni permisos.                  |
| Correo de identidad | Columna existente `email`, solo lectura.     | Sin cambio por esta API, verificado o no. El flujo de verificación de correo queda fuera.                                 |

En PATCH: propiedad omitida conserva su valor; null solo limpia los campos opcionales; payload vacío se rechaza; error en un campo revierte toda la operación. No se aceptan preferencias arbitrarias ni propiedades de administración.

Propuesta de precedencia de idioma: preferencia válida de cuenta, después preferencia local existente, después español. El selector fuera del formulario conserva su comportamiento local hasta que se acuerde una escritura explícita de cuenta. Public Web conserva su propia preferencia y no incorpora sesión staff.

### 6.3 Contraseña y sesiones

La política backend existente exige longitud y composición; hay una diferencia entre el máximo de 128 caracteres de `PasswordPolicy` y el máximo de 72 bytes UTF-8 admitido por el verificador BCrypt. MAP-289 debe conciliar contrato, backend y mensajes antes de aceptar nuevas credenciales; no cambiarla en esta etapa documental.

No almacenar ni devolver contraseñas en claro, hashes o secretos de tokens. No incluirlos en logs, errores, representaciones de comandos ni almacenamiento de formularios. Verificar contraseña actual usando los puertos existentes y persistir solo el nuevo hash.

En `main` hay JWT de acceso con TTL predeterminado de 15 minutos y logout local; no hay inventario persistido de sesiones ni refresh tokens. Listado de sesiones y acción independiente «cerrar otras sesiones» quedan fuera del MVP por falta de infraestructura. La invalidación asociada al cambio de contraseña es una operación distinta y debe probarse realmente antes de ofrecerla.

Con D03/D04, no emitir un JWT nuevo desde Mi cuenta ni simular revocación borrando únicamente el navegador. El rollback de la flag no puede desactivar la validación global de tokens ya invalidados.

## 7. Criterios de aceptación

Los criterios permanecen abiertos hasta implementación y evidencia. CA-01…CA-09 concretan Jira y el alcance del solicitante; CA-10…CA-12 dependen además de las propuestas identificadas.

- [ ] **CA-01 (R01/U02):** Dado un usuario autenticado, cuando consulta `GET /api/v1/me`, entonces recibe solo su perfil y el servidor obtiene el usuario objetivo del principal validado.
- [ ] **CA-02 (R01/R05):** Dados A y B del mismo tenant y C de otro tenant, cuando A manipula IDs, queries, headers o payloads, entonces no puede leer/modificar B ni C; ninguna solicitud cambia el objetivo autenticado.
- [ ] **CA-03 (R02/U03):** Dados cambios permitidos válidos, cuando se guarda y vuelve a consultar, entonces persisten en `app_user` y se reflejan en Console con estados de carga/error/éxito.
- [ ] **CA-04 (R04):** Dado un payload con correo, rol, tenant, membresía, estado o permisos, cuando se envía a la API personal, entonces se rechaza sin modificar esas propiedades ni ningún otro campo del payload.
- [ ] **CA-05 (R03):** Dada prueba de control inválida, contraseña débil o intentos excesivos, cuando se solicita un cambio, entonces se rechaza sin cambiar credenciales y sin divulgar secretos.
- [ ] **CA-06 (R03):** Dado un cambio de contraseña válido, cuando termina la transacción, entonces la nueva contraseña permite autenticarse, la anterior no, y los JWT previos cumplen la política real de caducidad/revocación documentada y probada.
- [ ] **CA-07 (R06):** Dada la flag OFF, cuando se usa navegación o URL directa/API, entonces no aparece la entrada nueva ni se habilita la función; con ON siguen siendo obligatorios autenticación, autorización y aislamiento.
- [ ] **CA-08 (R07):** Dado SUPER_ADMIN de `platform`, cuando usa su ruta personal, entonces emplea la misma funcionalidad y solo modifica su cuenta, sin selección de tenant ni privilegios editables.
- [ ] **CA-09 (R05/R09):** Dadas las nuevas operaciones, cuando se ejecutan pruebas backend, frontend, integración/RLS y E2E aplicables, entonces pasan también las regresiones de login, activación y gestión de usuarios, con evidencia móvil y sin exponer datos sensibles.
- [ ] **CA-10 (D01):** Dados idioma soportado, nulo y no soportado, cuando se edita el perfil, entonces se aplica la validación y precedencia acordadas sin cambiar reglas de negocio; las cadenas usan los catálogos existentes.
- [ ] **CA-11 (D03/D04):** Dados dos JWT previos, conexión STOMP y login concurrente con el cambio, cuando se cambia la contraseña, entonces ninguna credencial antigua conserva autoridad por una carrera de emisión o por precisión de `iat`; el nuevo login válido funciona.
- [ ] **CA-12 (R06/D06):** Dada la función previamente ON, cuando se apaga o falla su proveedor, entonces el fallback y la propagación cumplen el contrato de rollout acordado sin borrar perfiles, restaurar hashes previos ni revalidar JWT revocados.

## 8. Fuera de alcance

- MAP-286 y cualquier administración de roles, miembros, asignaciones o privilegios.
- Cambio de correo de identidad, vinculación de cuentas o membresías múltiples.
- Recuperación pública general de contraseña; la recuperación excepcional de ADMIN de MAP-238 no se redefine como flujo ordinario.
- Inventario de sesiones, refresh tokens y botón independiente «cerrar otras sesiones» sin infraestructura.
- Nuevo usuario/perfil paralelo, otra tabla de identidad, otro SUPER_ADMIN o una API personal con tenant destino.
- Activar Unleash, ejecutar migraciones o pruebas con stack durante esta etapa.

## 9. Impacto multi-tenant y persistencia

Ampliar `app_user` conservando `tenant_id NOT NULL`, índice existente `(tenant_id, id)` y RLS forzada. No se propone una tabla nueva. Una migración nueva añade únicamente datos personales y restricciones necesarias; su número se decidirá después de revisar las migraciones integradas. Actualizar DBML en el mismo commit futuro.

Todas las lecturas/escrituras personales llevan filtros explícitos por tenant y usuario; RLS protege entre tenants y el filtro de usuario protege a personas del mismo tenant. Fijar `TenantScope.SET_LOCAL_SQL` dentro de la transacción, nunca dejar contexto persistente en el pool ni usar el owner como runtime.

Las operaciones personales no usan el contexto especial `app.login_email` de la búsqueda anterior al JWT. Las pruebas SQL sin contexto deben limpiar tanto `app.tenant_id` como ese contexto de login para verificar cero filas; conservar y probar por separado la excepción controlada de login de V32.

El tenant `platform` se trata como alcance propio para SUPER_ADMIN. No hay bypass RLS ni selección cross-tenant en Mi cuenta.

## 10. Trazabilidad y referencias

- Historia: [MAP-285](https://matiasmv2005.atlassian.net/browse/MAP-285).
- Subtareas: [MAP-287](https://matiasmv2005.atlassian.net/browse/MAP-287), [MAP-288](https://matiasmv2005.atlassian.net/browse/MAP-288), [MAP-289](https://matiasmv2005.atlassian.net/browse/MAP-289), [MAP-290](https://matiasmv2005.atlassian.net/browse/MAP-290), [MAP-291](https://matiasmv2005.atlassian.net/browse/MAP-291), [MAP-314](https://matiasmv2005.atlassian.net/browse/MAP-314).
- Dependencias: [MAP-45](https://matiasmv2005.atlassian.net/browse/MAP-45), [MAP-180](https://matiasmv2005.atlassian.net/browse/MAP-180), [MAP-238](https://matiasmv2005.atlassian.net/browse/MAP-238), [MAP-240](https://matiasmv2005.atlassian.net/browse/MAP-240), [MAP-256](https://matiasmv2005.atlassian.net/browse/MAP-256).
- Alcance del producto: [use_cases.md](../../docs/roadmap/use_cases.md), CU-23/CU-24.
- Diseño y ejecución: [plan.md](plan.md), [tasks.md](tasks.md).
- Convenciones: [AGENTS.md](../../AGENTS.md), [specs/AGENTS.md](../AGENTS.md), [CONTRIBUTING.md](../../CONTRIBUTING.md).
