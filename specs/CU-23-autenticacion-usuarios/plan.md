# CU-23 — Plan técnico de MAP-46

## 1. Enfoque

Implementar `AuthenticateUser` en identity-application, con puertos de consulta de
credenciales y verificación de contraseñas en identity-domain. La infraestructura
resuelve las credenciales en PostgreSQL y usa el `PasswordEncoder` BCrypt existente.
El resultado es una identidad; MAP-47 la utilizará para emitir un token.

## 2. Patrones de diseño aplicados

| Patrón           | Dónde                            | Por qué aquí                                            | Alternativa descartada                          |
| ---------------- | -------------------------------- | ------------------------------------------------------- | ----------------------------------------------- |
| Ports & Adapters | Consulta y contraseña            | Permite probar reglas sin BD ni Spring Security         | Acoplar el servicio a JDBC/BCrypt               |
| Repository       | `UserCredentialsRepository`      | Expresa una búsqueda de identidad dentro de una empresa | Consultar usuarios globalmente por correo       |
| Value Object     | `TenantId` y resultado inmutable | Mantiene la identidad tipada sin exponer secretos       | Devolver la fila de credenciales como respuesta |

## 3. Contrato API

Sin cambios de endpoints en MAP-46. El contrato de login se definirá primero en
OpenAPI al abordar MAP-48; no hay código generado que modificar ahora.

## 4. Backend

- Domain: credenciales persistidas, identidad autenticada, roles, error genérico
  y puertos.
- Application: normalización de entrada, verificación, comprobación de estado.
- Infrastructure: BCrypt y repositorio JDBC con transacción `REQUIRES_NEW`.

Se usa JDBC para la consulta anterior al login porque aún no existe un tenant
autenticado para una sesión Hibernate. La consulta fija RLS y filtra explícitamente
el tenant; nunca reutiliza el contexto demo. No se introducen dependencias entre
módulos de negocio.

## 5. Base de datos

Nueva migración Flyway `app_user` conforme al DBML existente, con validaciones de
rol y correo normalizado. Actualizar el estado de implementación en el DBML.

## 6. Frontend y feature toggle

Sin cambios: todavía no se expone una funcionalidad HTTP ni una pantalla.

## 7. Verificación

- Pruebas unitarias de reglas y ausencia de secretos en representaciones de texto.
- Pruebas del adaptador BCrypt con hashes reales, entradas largas y hash inválido.
- Integración PostgreSQL: migración, autenticación real, correos repetidos entre
  tenants, cuentas suspendidas/inactivas, RLS con rol sin bypass y limpieza de contexto.
- Suite backend y ArchUnit; formato de archivos modificados.

## 8. Riesgos

El endpoint futuro debe traducir el error genérico a Problem Details y limitar los
intentos de login. El selector de empresa no es autorización: ningún recurso staff
podrá confiar en él. Emitir tokens y probar acceso HTTP entre tenants sigue pendiente.
