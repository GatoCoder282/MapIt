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
- [ ] Ejecutar `pnpm check` local si el entorno cuenta con Node 24 y pnpm 11.
- [x] Revisar CI remoto de PR #70: frontend, backend, contrato, integración y E2E pasan.
- [ ] Capturar y adjuntar la vista Checks a PR #70.

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

El entorno local no tiene Node, Corepack ni pnpm, por lo que no se ejecutaron
`pnpm check` ni Prettier localmente. En el primer CI de PR #70, `fmt:check` señaló
`spec.md` y `plan.md`; el formato se corrigió. El comando
`gh pr checks 70 --repo GatoCoder282/MapIt` confirmó que el run `44595740356`
pasó frontend, backend, contrato, integración y E2E; SonarQube manual quedó omitido.

La captura de la vista Checks sigue pendiente: el helper local de Computer Use
devolvió este error incluso tras reiniciarlo:

> Computer Use native pipe is unavailable: failed to connect native pipe: The system cannot find the file specified. (os error 2)

El PR permanece en borrador hasta adjuntar esa evidencia.

