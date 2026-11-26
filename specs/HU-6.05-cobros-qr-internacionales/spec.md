# HU-6.05 — Cobros QR internacionales y confirmación multiproveedor (MAP-255)

## Objetivo

Determinar si MapIt puede habilitar cobros QR automáticos por país y proveedor, y
dejar registrados los requisitos externos que deben resolverse antes de implementar
un flujo de producción.

## Criterios de aceptación

- [x] Dado el alcance multiproveedor, cuando se evalúa el primer mercado, entonces
      se registra que la factibilidad técnica está documentada y que el alta de un
      proveedor para producción depende de aprobación y credenciales.
- [x] Dado dLocal for Platforms como candidato para Bolivia, cuando se revisa su
      onboarding, entonces se documenta el alta legal de MapIt como plataforma y de
      cada establecimiento como comercio, incluidos los datos de compañía,
      representante legal y beneficiarios finales (UBO).
- [x] Dado el QR de dLocal para Bolivia, cuando se revisan los campos de la
      operación, entonces se registra que el CI o NIT del pagador es obligatorio y
      que debe definirse cómo recoger y proteger ese dato.
- [x] Dado que no hay una tarifa pública fija para Platforms, cuando se documenta
      la viabilidad, entonces se solicita una cotización escrita y no se atribuyen
      a Platforms las tarifas de dLocal Go.
- [x] Dado que los requisitos legales y comerciales siguen sin confirmar, cuando
      se cierra este spike, entonces se conserva el QR bancario manual como alternativa
      y no se declara habilitado un cobro automático de producción.

## Alcance de esta entrega

Este entregable es un informe de viabilidad. No implementa un adaptador ni cambia
el contrato, la base de datos o el flujo de pago. La integración queda condicionada
a los requisitos y decisiones pendientes de `report.md`.
