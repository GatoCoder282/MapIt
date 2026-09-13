# CU-23 — Plan técnico de MAP-46 a MAP-48

## 1. Enfoque

Implementar `AuthenticateUser` en identity-application, con puertos de consulta de
credenciales y verificación de contraseñas en identity-domain. La infraestructura
resuelve las credenciales en PostgreSQL y usa el `PasswordEncoder` BCrypt existente.
El resultado es una identidad; MAP-47 la utilizará para emitir un token.

Para MAP-47, definir puertos de emisión y validación de tokens en identity-domain,
orquestar la emisión en identity-application e implementar JWT con JJWT en
identity-infrastructure. Un filtro `OncePerRequestFilter` validará el Bearer token,
creará la autenticación de Spring Security y expondrá el tenant de la petición sin
usar headers aportados por el cliente.

Para MAP-48, definir primero en OpenAPI el endpoint público de login y sus modelos.
El controlador REST de identity-infrastructure orquestará `AuthenticateUser` y
`IssueAccessToken`, mapeará únicamente datos públicos y traducirá credenciales
inválidas a RFC 9457 sin revelar la causa.

## 2. Patrones de diseño aplicados

| Patrón                  | Dónde                            | Por qué aquí                                             | Alternativa descartada                          |
| ----------------------- | -------------------------------- | -------------------------------------------------------- | ----------------------------------------------- |
| Ports & Adapters        | Consulta y contraseña            | Permite probar reglas sin BD ni Spring Security          | Acoplar el servicio a JDBC/BCrypt               |
| Repository              | `UserCredentialsRepository`      | Expresa una búsqueda de identidad dentro de una empresa  | Consultar usuarios globalmente por correo       |
| Value Object            | `TenantId` y resultado inmutable | Mantiene la identidad tipada sin exponer secretos        | Devolver la fila de credenciales como respuesta |
| Adapter                 | `JjwtTokenService`               | Aísla JJWT y su configuración del dominio                | Importar JJWT en application/domain             |
| Chain of Responsibility | Cadena de Spring Security        | Valida cada petición antes de ejecutar controladores     | Validar tokens dentro de cada endpoint          |
| Facade                  | `LoginController`                | Expone un único flujo HTTP sobre autenticación y emisión | Hacer que el cliente coordine dos operaciones   |

## 3. Contrato API

Agregar `POST /auth/login` sin seguridad previa:

- Entrada `LoginRequest`: `tenantSlug`, `email`, `password`.
- Salida `LoginResponse`: `accessToken`, `tokenType`, `expiresAt`, `user`.
- `AuthenticatedUser`: `id`, `tenantId`, `email`, `fullName`, `role`.
- Respuestas: 200, 400 y 401 con `Problem`.

Después de validar el YAML se regenera el cliente Angular. El código generado no se
edita ni se commitea.

## 4. Backend

- Domain: credenciales persistidas, identidad autenticada, roles, error genérico
  y puertos.
- Application: normalización de entrada, verificación, comprobación de estado.
- Infrastructure: BCrypt y repositorio JDBC con transacción `REQUIRES_NEW`.
- Domain: puertos `AccessTokenIssuer`/`AccessTokenVerifier`, token emitido y claims
  validados sin dependencias de JJWT o Spring.
- Application: caso de uso que emite un access token desde `AuthenticatedUser`.
- Infrastructure: adaptador JJWT HS256, propiedades validadas, filtro Bearer,
  principal autenticado y contexto de tenant derivado de Spring Security.
- Bootstrap: insertar el filtro antes del filtro anónimo y responder 401 ante una
  autenticación ausente o inválida.
- Infrastructure: controlador de login, DTOs de transporte, mapeo de identidad y
  manejador de `InvalidCredentialsException` a Problem Details.
- Bootstrap: declarar únicamente `/api/v1/auth/login` como ruta pública de identidad.

Se usa JDBC para la consulta anterior al login porque aún no existe un tenant
autenticado para una sesión Hibernate. La consulta fija RLS y filtra explícitamente
el tenant; nunca reutiliza el contexto demo. No se introducen dependencias entre
módulos de negocio.

## 5. Base de datos

Nueva migración Flyway `app_user` conforme al DBML existente, con validaciones de
rol y correo normalizado. Actualizar el estado de implementación en el DBML.

## 6. Frontend y feature toggle

No se modifica una pantalla. La regeneración crea el método tipado del cliente que
MAP-50 consumirá; MAP-49 implementará primero la vista.

## 7. Verificación

- Pruebas unitarias de reglas y ausencia de secretos en representaciones de texto.
- Pruebas del adaptador BCrypt con hashes reales, entradas largas y hash inválido.
- Integración PostgreSQL: migración, autenticación real, correos repetidos entre
  tenants, cuentas suspendidas/inactivas, RLS con rol sin bypass y limpieza de contexto.
- Suite backend y ArchUnit; formato de archivos modificados.
- Pruebas unitarias con reloj fijo para claims, firma y expiración.
- Pruebas de rechazo para token alterado, expirado, emisor incorrecto, tipo
  incorrecto y claims ausentes.
- Integración de Spring Security: Bearer válido autentica, Bearer inválido devuelve
  401 y el tenant se obtiene del token sin filtrarse a otra petición.
- Lint y generación OpenAPI sin drift.
- Pruebas del controlador para respuesta válida, validación 400, error uniforme 401,
  ausencia de secretos y acceso público sin token.
- Prueba Docker con un usuario local desechable y verificación posterior del JWT en
  una ruta protegida, sin dejar credenciales de demostración en migraciones.

## 8. Riesgos

El endpoint traduce el error genérico a Problem Details. El selector de empresa no
es autorización: ningún recurso staff podrá confiar en él. HS256 exige custodiar y
rotar una clave compartida; para el MVP se valida un mínimo de 256 bits y se
mantiene fuera del repositorio mediante `.env`. La revocación y renovación de
tokens permanecen pendientes.

El endpoint queda expuesto a intentos repetidos. MAP-48 no introduce un contador en
memoria que fallaría al usar varias instancias; la limitación distribuida se mantiene
explícitamente fuera de alcance hasta definir su almacenamiento y política.

## 9. Propuesta técnica MAP-49

Feature login con UI y ViewModel separados según las reglas de console.
El patrón MVVM concentra valores, validación y visibilidad de contraseña en
model; UI se limita a binding y eventos. Permite comprobar el comportamiento
sin renderizar, frente a mezclar reglas en la plantilla.

Usar Signals, inject(), componentes OnPush y una ruta con carga diferida.
Aplicar estilos locales para conservar el fondo blanco y el azul de la referencia
independientemente del tema del sistema. Crear una ilustración decorativa de mesas
con recursos locales; no introducir un motor de mapas para el panel del login.

La ruta por empresa será /empresa/:tenantSlug/login; /login permite revisar la
pantalla y la raíz redirige a /login. MAP-50 conectará el
ViewModel con el cliente generado de MAP-48. No hay cambios de contrato o BD.
Verificar validación, visibilidad de contraseña, teclado, diseño en escritorio y
móvil; ejecutar pnpm check y actualizar la consola en Docker para revisión.

## 10. Implementación técnica MAP-50

| Patrón        | Dónde          | Por qué aquí                                          | Alternativa descartada           |
| ------------- | -------------- | ----------------------------------------------------- | -------------------------------- |
| MVVM          | LoginStore     | Coordina carga, errores y comandos con Signals        | HTTP en la plantilla             |
| Adapter       | data/LoginApi  | Encapsula AuthService generado                        | Peticiones duplicadas a mano     |
| Session Store | libs/auth      | Centraliza identidad, vigencia y almacenamiento       | Estado separado por pantalla     |
| Interceptor   | libs/auth      | Restringe Bearer a la API y maneja 401 coherentemente | Headers manuales en cada feature |
| Guard         | rutas privadas | Evita navegación sin sesión vigente                   | Revisar sesión en cada pantalla  |

- Mantener contrato y backend de MAP-48. LoginApi consume AuthService.login con
  transferCache desactivado; cancelar suscripciones al destruir el ViewModel.
- libs/auth exporta tipos y servicio de sesión, guard e interceptor; recibe la
  dirección API desde configuración por inyección, sin importar apps ni depender
  de los detalles de una feature. Si utiliza tipos del cliente, documentar la
  dependencia explícita en libs/AGENTS.md.
- Persistir solo los datos mínimos de sesión y slug de acceso; validar forma y
  fechas antes de restaurar. Programar expiración y comprobarla también al navegar
  y hacer peticiones. Limpiar el almacenamiento alternativo al cambiar Recordarme.
- LoginStore orquesta API y sesión, limpia contraseña y cancela resultados obsoletos
  si cambia la empresa o se abandona la pantalla. Los errores se mapean a mensajes
  seguros. La navegación tras éxito tiene destino fijo /home.
- Registrar interceptor en app.config y guard en rutas privadas. Mantener runtime
  config y Unleash fuera del envío de credenciales. Cierre local desde Inicio.
- Pruebas: HttpTestingController para login/interceptor, reloj controlado para
  expiración, almacenamiento/restauración y casos de respuestas tardías. Revisar
  en Docker navegador → API → PostgreSQL con usuario desechable y eliminación final.
- Ejecutar pnpm check y documentar resultados. No publicar ni cambiar estados Jira.
