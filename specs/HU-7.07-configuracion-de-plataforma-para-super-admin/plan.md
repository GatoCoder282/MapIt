# Plan — HU-7.07 Configuración de plataforma para Super Admin

## Enfoque

El catálogo de parámetros editables es código (`shared-kernel/settings`), no filas libres: no se
puede crear una clave desde la API. `platform` guarda los valores, los audita y los publica por un
puerto del shared kernel que `reservations` consulta al emitir un enlace o una sesión. Los módulos
no se importan entre sí.

## Patrones de diseño aplicados

| Patrón              | Dónde                                      | Por qué aquí                                                     | Alternativa descartada                                                                  |
| ------------------- | ------------------------------------------ | ---------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Ports and Adapters  | `PlatformSettingOverrides` (shared kernel) | `reservations` lee un valor de `platform` sin depender de él     | Que `reservations` consulte la tabla: acopla dos contextos y repite la regla de la flag |
| Allowlist como enum | `PlatformSetting` con rango y propiedad    | El compilador cierra el conjunto de claves editables             | Tabla clave-valor libre: permitiría parámetros arbitrarios (fuera de alcance)           |
| Optimistic locking  | `expectedValue` en el cambio               | Evita que un Super Admin pise el cambio de otro sin verlo        | Bloqueo pesimista: no hay edición larga que justifique retener filas                    |
| Adapter             | `FlagProviderStatus` sobre Unleash         | El estado del proveedor se informa sin que el dominio lo conozca | API admin de Unleash: exigiría un token administrativo                                  |

## Datos (migración V46)

- `platform_setting(setting_key PK, int_value, updated_at, updated_by)`. Es **global**, como
  `tenant`: no hay dato de negocio ni de empresa, y `reservations` la lee dentro de la transacción
  de un tenant, donde una política RLS devolvería 0 filas sin avisar. Claves y rangos se
  restringen con `CHECK`.
- La auditoría reutiliza `audit_log` con `tenant_id = 'platform'`: recurso `PLATFORM_SETTING` y
  evento `PLATFORM_SETTING_CHANGED`. Sus restricciones se amplían partiendo de la definición de V42.

## Contrato

| Método y ruta                    | Respuesta                                              |
| -------------------------------- | ------------------------------------------------------ |
| `GET /platform/settings`         | parámetros, solo lectura, servicios y flags            |
| `PUT /platform/settings/{key}`   | `{ value \| null, expectedValue, reason }` → parámetro |
| `GET /platform/settings/changes` | últimos 50 cambios                                     |

Errores: 401, 403, 404 (flag apagada o clave desconocida), 400 y 409.

## Backend y frontend

- `platform-domain`: puertos de almacenamiento, auditoría y estado del proveedor.
- `platform-application`: consulta y cambio transaccionales, con la flag como primera compuerta.
- `platform-infrastructure`: JDBC, controlador y adaptador del puerto compartido.
- `reservations-application`: `CustomerHistoryPolicy` aplica el valor guardado si existe.
- Console: `features/administration/platform-settings` (`data`, `model`, `ui`) en `/admin/settings`.

## Verificación

Unitarias de catálogo, caso de uso y política; integración con Testcontainers para permisos, flag,
persistencia, auditoría y conflicto; Vitest del ViewModel; E2E de la Console.
