---
name: new-feature-flag
description: Crea una feature flag de MapIt coherente en backend, frontend y Unleash. Úsalo cuando haya que poder activar o desactivar funcionalidad sin redesplegar.
---

# Crear una feature flag

## Antes: ¿de verdad hace falta?

Una flag es una rama de código que hay que mantener y probar. Se justifica cuando:

- La funcionalidad se va a integrar por partes y no puede verse aún (**release**)
- Puede fallar en producción y hay que poder apagarla en caliente (**kill switch**)
- Se comparan dos variantes (**experiment**)
- Se habilita según tenant o rol (**permission**)

Si no encaja en ninguno, probablemente no necesitas una flag.

## Cómo se crea

```bash
pnpm new:flag payments.qr release
pnpm new:flag realtime.fallback kill_switch --on
```

El script la añade a los **tres** sitios que deben coincidir:

1. el enum `FeatureFlag` de Java (`shared-kernel/…/flags/FeatureFlag.java`)
2. el catálogo TypeScript (`libs/feature-flags/…/feature-flag.catalog.ts`)
3. el bootstrap de Unleash (`infra/docker/unleash/flags.json`)

Hacerlo a mano en tres sitios es exactamente cómo se desincronizan.

## Después

1. **Sustituye los TODO** por una descripción real y el CU al que pertenece.
2. **Créala en la UI**: <http://localhost:4242> (`admin` / `unleash4all`).
3. Úsala:

```java
// Backend — nunca Unleash directo, siempre el puerto
if (flags.isEnabled(FeatureFlag.PAYMENTS_QR)) { ... }
```

```html
<!-- Angular -->
@if (flags.isEnabled('payments.qr')()) { ... }
<p *featureFlag="'payments.qr'">...</p>
```

```typescript
// Ruta completa: con la flag apagada, el bundle ni se carga
{ path: 'pagos', canActivate: [featureFlagGuard('payments.qr')], ... }
```

## Convenciones

- Nombre: `<dominio>.<feature>`, minúsculas
- Las flags `release` y `experiment` nacen con **fecha de retiro** y un issue de limpieza
- Los valores por defecto del catálogo son los que se usan **si Unleash no responde**.
  Elígelos pensando en eso: la app nunca debe caerse porque el servidor de flags esté abajo.

## Estrategias avanzadas (en la UI de Unleash)

Es donde una flag deja de ser un `if` y se vuelve útil de verdad:

- **Gradual rollout**: activar para el 10 % de usuarios
- **UserIDs / constraints**: activar solo para ciertos tenants
- **Constraint por país**: el caso clásico — apagar una feature solo en un país mientras
  se depura, sin afectar al resto. Eso es lo que un redespliegue no puede darte.

## Higiene

Las flags zombis son deuda técnica: cada una duplica los caminos posibles del código.
Al terminar un CU, retira sus flags `release`.
