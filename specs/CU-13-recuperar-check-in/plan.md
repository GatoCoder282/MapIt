# Plan

1. Reproducir la clasificación incorrecta con tests del adaptador de recepción.
2. Separar errores técnicos de los 409 de negocio y aclarar su mensaje.
3. Implementar una herramienta local de reconciliación, dry-run por defecto, que
   únicamente reconoce el historial completo V1–V28 anterior a la integración.
   Comparar los checksums Flyway con los scripts actuales V23–V31, respaldar con
   pg_dump, actualizar solo las versiones/nombres equivalentes en una transacción
   bloqueada y ejecutar Flyway con outOfOrder solo en esa recuperación.
4. Probar validación/rechazos del plan de recuperación; validar el recorrido de pagos
   y llegada en PostgreSQL efímero con la auditoría actual.
5. Recuperar la base local autorizada y comprobar validación Flyway y preservación.
6. Seguimiento de arranque: reutilizar `isPortFree` para validar IPv4/IPv6 antes de
   iniciar cualquier proceso; probar el CLI con listeners TCP efímeros y liberar las
   tres instancias locales identificadas antes de devolver el control de `pnpm dev`.

## Patrones de diseño aplicados

| Patrón                    | Por qué aquí                                                  | Alternativa descartada                          |
| ------------------------- | ------------------------------------------------------------- | ----------------------------------------------- |
| Adaptador de errores HTTP | Distingue transporte y reglas de negocio                      | Presentar 500 como reserva inválida             |
| Plan previo y transacción | Impide reconciliar scripts diferentes o un historial cambiado | flyway repair indiscriminado                    |
| Migraciones existentes    | Flyway ejecuta V20–V22 y conserva su auditoría                | Editar migraciones aplicadas o resetear la base |

Sin nuevas tablas de producto, dependencias ni cambios de reglas de pago/llegada.
