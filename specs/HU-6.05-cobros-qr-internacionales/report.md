# Informe de viabilidad — MAP-255

**Historia:** HU-6.05 — Cobros QR internacionales y confirmación multiproveedor  
**Fecha:** 19 de noviembre de 2026  
**Issue:** [MAP-255](https://matiasmv2005.atlassian.net/browse/MAP-255)

## Conclusión

**No se puede habilitar ahora el cobro QR automático en producción con dLocal for
Platforms.** La integración es técnicamente posible, pero antes se deben conseguir
y validar los registros/documentos legales de MapIt, completar el onboarding de los
establecimientos, obtener la aprobación comercial y de sandbox del proveedor, y
aceptar sus costos por escrito.

La conclusión se refiere a la ruta inicial propuesta con dLocal for Platforms; no
afirma que todos los proveedores QR del mercado tengan requisitos idénticos. El QR
bancario manual ya disponible en MapIt se conserva como alternativa y no confirma
pagos automáticamente.

## Documentación legal y onboarding

dLocal requiere primero crear una cuenta de plataforma a nombre de la entidad que
opera MapIt y después crear cuentas de usuario para los comercios que forman parte
de ella. Para una empresa, su guía KYC contempla información de compañía, datos del
representante legal y beneficiarios finales (UBO). Los requisitos cambian según el
país y el tipo de entidad; dLocal Sales debe confirmar por escrito qué registros y
documentos bolivianos sirven. Una CI personal no sustituye la documentación de la
entidad.

Hay además un dato distinto de los registros de la empresa: la API de QR de
Bolivia marca `payer.document` como obligatorio y la documentación del mercado
identifica CI o NIT. Antes de implementar la pantalla de pago, se debe resolver
cómo se solicita y protege ese dato.

## Costos

No hay una tarifa pública fija consultada para dLocal for Platforms. dLocal indica
que prepara una propuesta según mercados y flujo; su estructura típica incluye
comisiones por transacción, un posible cargo base y cargos trasladados cuando
correspondan. **Por lo tanto, la integración tendrá costos comerciales; el importe
exacto debe salir de una cotización y aprobación del equipo.** No se debe usar el
tarifario de dLocal Go para estimar Platforms.

El costo de obtener o renovar los registros legales de MapIt tampoco quedó
cuantificado en las fuentes consultadas; debe presupuestarse aparte cuando se
confirme qué documentos exige el proveedor.

La cotización debe detallar, como mínimo, cobros QR por país, onboarding/KYB,
liquidaciones y payouts por establecimiento, cargos base o mínimos, reembolsos,
contracargos, impuestos y cualquier cargo trasladado.

## Condiciones para desbloquear producción

- [ ] Confirmar y reunir los registros de constitución/registro, identificación
      fiscal y documentos de representante legal y UBO que dLocal exija para MapIt.
- [ ] Completar y aprobar el onboarding de cada establecimiento participante.
- [ ] Recibir una oferta comercial escrita y aprobar los costos y el flujo de fondos.
- [ ] Obtener acceso y credenciales de sandbox para Bolivia/BOB/QR.
- [ ] Aprobar el tratamiento del CI/NIT del pagador y validar el flujo de confirmación.

Hasta entonces, no se debe presentar el pago como verificado por un proveedor ni
marcar reservas como pagadas automáticamente.

## Fuentes oficiales

- [Onboarding de dLocal for Platforms](https://docs.dlocal.com/docs/onboarding-process-platforms)
- [Requisitos KYC de dLocal for Platforms](https://docs.dlocal.com/docs/kyc-requirement-platforms)
- [QR y especificaciones de Bolivia](https://docs.dlocal.com/docs/bolivia)
- [FAQ de dLocal: precios y modelo comercial](https://www.dlocal.com/faqs/)
