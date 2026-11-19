# Plan — MAP-255

1. Contrastar la ruta inicial Bolivia/BOB/QR con la documentación oficial de dLocal
   sobre onboarding de Platforms, KYC, campos del QR y precios.
2. Separar los requisitos de registro de MapIt como plataforma, los de cada comercio
   y el documento de identidad fiscal solicitado al pagador.
3. Registrar los costos confirmados y desconocidos, sin estimar importes que dependan
   de una oferta comercial o de trámites legales aún no especificados.
4. Mantener el método QR bancario manual hasta que haya aprobación del proveedor,
   documentos, precio aceptado y sandbox disponible.
5. Iniciar el diseño e implementación solo después de resolver esos gates y aprobar
   el tratamiento del CI/NIT del pagador.

## Patrones de diseño aplicados

| Patrón | Por qué aquí | Alternativa descartada |
| --- | --- | --- |
| No aplica | Este PR produce un informe y no agrega comportamiento ejecutable. | Diseñar un adaptador antes de confirmar elegibilidad, cuentas, costos y sandbox. |

## Dependencias externas

- Confirmación de dLocal Sales de que MapIt puede operar como plataforma para Bolivia.
- Documentación legal/KYB de MapIt y de cada comercio, con el listado exacto exigido
  para el tipo de entidad y país.
- Cotización escrita para Platforms, incluidos cobros, liquidación/payout,
  reembolsos, contracargos, cargos base y componentes trasladados.
- Credenciales de sandbox y validación del flujo de fondos hacia el establecimiento.
- Decisión de producto y privacidad para recoger el CI/NIT del pagador.

## Verificación

No hay cambios de código, contrato ni esquema. Se ejecutará `pnpm check` como parte
de la entrega del PR; los workflows remotos y su evidencia se actualizarán en
`tasks.md` cuando terminen.
