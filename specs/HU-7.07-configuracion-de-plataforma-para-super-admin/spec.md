# HU-7.07 — Configuración de plataforma para Super Admin

> Jira: [MAP-300](https://matiasmv2005.atlassian.net/browse/MAP-300) · Subtareas MAP-302 a MAP-307

## Enunciado

Como SUPER_ADMIN quiero disponer de una sección de configuración de la plataforma para consultar y
gestionar parámetros globales autorizados de MapIt sin afectar inadvertidamente a tenants ni
exponer secretos.

## Contexto

`/admin/settings` existe en la Console como sección vacía. No hay ningún almacén de configuración
global: los parámetros se leen de variables de entorno al arrancar.

## Inventario de parámetros (MAP-302)

| Clave                                  | Quién edita | Rango    | Valor por defecto                 | Efecto                                           |
| -------------------------------------- | ----------- | -------- | --------------------------------- | ------------------------------------------------ |
| `customer-history.link-ttl-minutes`    | SUPER_ADMIN | 5 a 60   | despliegue (`15` si no se define) | Vigencia de los enlaces de historial **nuevos**  |
| `customer-history.session-ttl-minutes` | SUPER_ADMIN | 10 a 120 | despliegue (`30` si no se define) | Vigencia de las sesiones de historial **nuevas** |

- **Solo lectura:** ventana y límites anti abuso del historial (`window-minutes`, `person-limit`,
  `ip-limit`), porque son política de seguridad; entorno; estado de base de datos y del proveedor
  de flags; catálogo de flags con su evaluación global.
- **Nunca se exponen:** secretos, tokens, contraseñas, URLs internas ni variables de entorno.
- **Fuera de este catálogo:** configuración por tenant (política de pagos, plantillas) y
  preferencias personales (Mi cuenta, MAP-285).

## Reglas

- **RN-1** Solo un SUPER_ADMIN autenticado accede: 401 sin JWT; 403 con ADMIN, MANAGER o STAFF.
- **RN-2** La sección y sus endpoints dependen de `mapit.s6.platform-settings`, **OFF por
  defecto**. La flag habilita; nunca sustituye la autorización.
- **RN-3** Con la flag apagada los valores guardados **se ignoran** y rige el valor del despliegue
  (rollback seguro). No se borran.
- **RN-4** Solo se aceptan claves de la allowlist y enteros dentro del rango.
- **RN-5** Todo cambio exige motivo (10 a 200 caracteres) y confirmación, y queda en la bitácora
  inmutable con actor, fecha, valor anterior, valor nuevo y motivo.
- **RN-6** Si el valor efectivo cambió desde que se cargó la pantalla, el cambio se rechaza (409).
- **RN-7** Un cambio rige sin reiniciar y no altera enlaces ni sesiones ya emitidos.
- **RN-8** El panel de flags es de solo lectura; no replica Unleash ni muestra credenciales.

## Criterios de aceptación

- [x] **CA-1:** sin JWT los endpoints responden 401; con ADMIN o STAFF, 403.
- [x] **CA-2:** con la flag apagada responden 404 `platform-settings-disabled` y el historial de
      clientes usa los valores del despliegue.
- [x] **CA-3:** un SUPER_ADMIN consulta parámetros con valor efectivo, valor por defecto y rango,
      además de valores de solo lectura, estado de servicios y flags, sin ningún secreto.
- [x] **CA-4:** una clave desconocida, un valor fuera de rango o un motivo corto responden 404 o
      400 sin escribir nada.
- [x] **CA-5:** un cambio válido persiste, rige en el siguiente enlace de historial emitido y
      aparece en el historial de cambios.
- [x] **CA-6:** restaurar el valor por defecto también queda auditado.
- [x] **CA-7:** de dos cambios sobre el mismo valor cargado, el segundo recibe 409.
- [x] **CA-8:** la Console distingue editable de solo lectura, pide motivo y confirmación, informa
      carga, error, conflicto y sección no habilitada, en es, en y ja, y en pantallas angostas.

## Fuera de alcance

Edición libre de tablas o SQL, impersonación de tenant, secretos, saldos de comercios, encender o
apagar flags desde MapIt y cambios masivos.
