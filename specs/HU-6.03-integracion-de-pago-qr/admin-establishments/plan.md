# Plan

1. Contrato primero, lint y generación. DTO AccessibleEstablishment {id,name,slug,address(nullable),timezone,canManagePayments,canCheckIn}. GET /establishments/accessible (staff de empresa). Gestión ADMIN de concesiones STAFF: GET /establishments/{establishmentId}/staff-access y PUT /establishments/{establishmentId}/staff-access/{userId} {canCheckIn}. No acceder al tenant por cookie/header.
2. Métodos: accountHolderName nullable (legacy), exigido al crear y al habilitar nuevos datos receptores. GET /payments?establishmentId&status&limit&offset (ADMIN) devuelve PaymentPage {items:ManagedPayment[],total,limit,offset}; importes strings. ManagedPayment incluye id,reservationId,establishmentId,establishmentName,methodId,methodName,provider,status,amount,currency,createdAt,expiresAt,verifiedAt(nullable),verificationSource(nullable),externalReference.
3. Catálogo: GET /public/establishments acepta tenantSlug,limit,offset y conserva array; tenantName en PublicEstablishmentSummary. GET /public/tenants/{tenantSlug}/establishments/{establishmentSlug} devuelve esa proyección. Metadata de enlaces directos no se busca en catálogo limitado.
4. Backend payments/spaces/shared: titular/JDBC/migración V23; listado seguro y permiso persistido STAFF. Port compartido de autorización sin dependencia nueva entre módulos. CheckInService y STOMP delegan en ese puerto; ADMIN de empresa conserva permisos existentes. Migraciones inmutables previas.
5. Main: Console core EstablishmentContext con lista backend y selected signal. Cookie SameSite=Lax, Path=/, Max-Age=30 días y Secure en HTTPS; solo preferencia ID, clave por tenant/usuario. Guard de rutas staff y selector /select-establishment. Shell muestra local activo y navegación Administración/Configuración; cambiar/salir vuelven al selector y no alteran reservas. Cookies no reemplazan JWT ni validación servidor.
6. Console payments: consumir contexto activo en métodos/política/listado y permisos STAFF; preservar links legacy. Form y lista con estado carga/error/vacío/guardado, strings y CSS existente.
7. Public Web y Reservations: enriquecer proyección/listado, contexto compartido core para metadata, UI empresa/local coherente y consultas scope-safe. No datos ficticios.
8. Seguridad/QA tras implementación: revisor distinto, tests de cookies y respuestas obsoletas, tenant/local, permisos HTTP/STOMP, legado de titulares, paginación, E2E conectado y capturas desktop/móvil. No push/despliegue/Jira write.

## Propiedad

Main: OpenAPI/generación, Console core/context/selector/nav/rutas, bootstrap wiring y enforcement, coordinación/E2E/docs.
Backend worker: payments + spaces + shared-kernel autorización, V23, pruebas/backend y actualización DBML. No contratos/bootstrap/frontend.
Console worker: features/payments y strings Console (incluye nuevas claves contexto/nav solicitadas por main), tests. No core/context/rutas/nav.
Public worker: apps/public-web y modules/reservations catálogo/metadata, tests. No payments/spaces/migraciones/OpenAPI.

Diseño: extensión del sistema Operate existente, sin rediseño ni nuevas dependencias. Las decisiones de permisos y compatibilidad quedan documentadas; una futura administración local requerirá un rol/scope diferente.
