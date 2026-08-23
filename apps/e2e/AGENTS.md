# E2E — contexto para agentes

## Dónde estás

Tests end-to-end con Playwright, contra el sistema **completo** levantado
(`pnpm infra:full` o `pnpm dev`).

## Los cuatro proyectos

| Proyecto            | Viewport       | Por qué                                                      |
| ------------------- | -------------- | ------------------------------------------------------------ |
| `console`           | Desktop Chrome | uso habitual del staff                                       |
| `console-tablet`    | iPad Pro       | **RNF07**: el "modo operación" en recepción se usa en tablet |
| `public-web`        | Desktop Chrome |                                                              |
| `public-web-mobile` | Pixel 7        | el cliente final reserva desde el móvil                      |

## Reglas duras

1. **Un E2E por flujo de usuario completo, no más.** Los E2E son lentos y frágiles:
   las reglas de negocio se prueban con tests unitarios de dominio, que corren en
   milisegundos. Si te ves escribiendo un E2E para validar una regla, está en el nivel
   equivocado.
2. **Selectores por rol o `data-testid`**, nunca por clase CSS ni por texto que pueda
   cambiar con la traducción.
3. **Cada test se prepara sus datos y no depende de otro.** Corren en paralelo.
4. **Nada de `waitForTimeout`.** Usa las esperas automáticas de Playwright
   (`expect(...).toBeVisible()`), o el test será intermitente en CI.
5. Los tests de `public-web` deben verificar que **no** se exige autenticación:
   el cliente final es anónimo (CU-15, CU-16).

## Comandos

```bash
pnpm e2e            # headless
pnpm e2e:ui         # modo interactivo — el mejor para depurar
pnpm e2e:report
pnpm e2e:install    # descarga los navegadores (una vez por máquina)
```

## Depuración asistida

Para inspeccionar el canvas del mapa, la consola del navegador o el tráfico de red
mientras se desarrolla, **Claude in Chrome** es más práctico que escribir un E2E.
Los E2E son para regresión, no para explorar.
