# Tareas — MAP-255

- [x] Revisar onboarding y KYC de dLocal for Platforms.
- [x] Confirmar campos y requisitos del QR boliviano en la documentación oficial.
- [x] Documentar el modelo de precios y los importes que siguen sin cotización.
- [x] Registrar el bloqueo de producción y conservar el QR bancario manual como fallback.
- [ ] Obtener la lista exacta de documentos legales/KYB para MapIt en Bolivia.
- [ ] Completar el alta de la plataforma y de los establecimientos que participen.
- [ ] Recibir y aprobar una cotización escrita, incluidos cargos por transacción,
      base, payout/liquidación y conceptos trasladados.
- [ ] Confirmar sandbox, credenciales y destino de liquidación por establecimiento.
- [ ] Definir captura, propósito, acceso y retención del CI/NIT del pagador.
- [ ] Implementar el slice de producción después de cerrar los gates anteriores.
- [ ] Ejecutar `pnpm check`, revisar los workflows del PR y adjuntar la captura de checks.

## Notas de ejecución

Revisión del 19-11-2026. Las fuentes oficiales consultadas exigen una cuenta de
plataforma asociada a una entidad y cuentas de usuario para los comercios. Para
empresas, el onboarding incluye datos de compañía, representante legal y UBO; la
lista concreta cambia según país y tipo de entidad. La documentación del QR de
Bolivia marca como obligatorio `payer.document` y acepta CI o NIT.

dLocal presenta Platforms con una propuesta comercial adaptada al mercado y al
flujo. Su estructura típica contempla tarifas por transacción, posible componente
base y cargos trasladados. No se encontró un importe fijo público para este
producto ni un costo verificable para tramitar los documentos legales. Las
tarifas de dLocal Go no se usan como referencia de Platforms.

No se modificó código, contrato ni esquema. El método de QR bancario manual
permanece como fallback. La integración es técnicamente viable cuando se resuelvan
los bloqueos comerciales y documentales.

El entorno local no tiene Node, Corepack ni pnpm, por lo que no se pudo ejecutar
`pnpm check` ni Prettier localmente. En CI del PR #70, el job Backend y el job de
sincronización del contrato pasaron; `fmt:check` señaló `spec.md` y `plan.md`, y
se corrigió el formato en este commit. El job de integración seguía en curso al
registrar esta nota. La verificación remota final y la captura de checks quedan
pendientes.
