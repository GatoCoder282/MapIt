# Console (staff) — contexto para agentes

## Dónde estás

Angular 22, aplicación de **staff**: editor de mapas, operación en tiempo real,
dashboard y administración del tenant. Requiere JWT.
Lo que NO va aquí: la superficie pública para el cliente final (eso es `apps/public-web`).

## Arquitectura: MVVM con Signals + feature-first

```
src/app/
├── core/       interceptores, guards, runtime-config
├── layout/     chrome de la aplicación
└── features/
    ├── map-editor/     CU-06…CU-08   (Integrante C)
    ├── operations/     CU-09, CU-10  (Integrante D)
    ├── reservations/   CU-11…CU-14   (Integrante D)
    └── administration/ CU-01…CU-05   (Integrante A/E)
```

Cada feature se divide en tres:

| Carpeta  | Qué es                                               | Regla                                   |
| -------- | ---------------------------------------------------- | --------------------------------------- |
| `ui/`    | componentes y plantillas                             | **solo** binding y eventos, cero lógica |
| `model/` | el **ViewModel**: signal store con estado y comandos | testeable sin renderizar                |
| `data/`  | llamadas al api-client                               |                                         |

El ViewModel usa `signal`, `computed` y `linkedSignal`. **No** `BehaviorSubject`.

## Reglas duras

1. **Una feature no importa de otra feature.** Si es compartido, va a `libs/` o a `core/`.
2. **No se importa `konva`.** Usa `MapEnginePort` de `@mapit/map-engine`: el motor de mapa
   está sin decidir (ADR-0006) y debe poder cambiarse.
3. **Zoneless** — es el default en Angular 21+. Nada de `provideZoneChangeDetection()`.
4. **Nombres de archivo sin sufijo de tipo:** `home.ts`, no `home.component.ts`.
5. **`inject()`**, no parámetros de constructor.
6. **`@if` / `@for`**, no `*ngIf` / `*ngFor`. **`[class.x]`**, no `NgClass`.
7. Miembros usados solo por la plantilla: `protected`. Inputs/outputs/queries: `readonly`.
8. Nada de `utils.ts`, `helpers.ts` ni `common.ts`.

Las reglas 2-8 las aplica ESLint: si las rompes, `pnpm check` se pone rojo.

## Librerías disponibles

`@mapit/ui-kit` (design system) · `@mapit/api-client` (generado del contrato) ·
`@mapit/auth` (JWT) · `@mapit/feature-flags` · `@mapit/realtime` (STOMP) ·
`@mapit/map-engine` (puerto del mapa)

## Configuración

Se lee en **runtime** de `/assets/config.json`, no de un `environment.ts` incrustado.
Así la misma imagen Docker sirve en dev y en despliegue.

## Feature flags

```html
@if (flags.isEnabled('payments.qr')()) { … }
<p *featureFlag="'payments.qr'">…</p>
```

Las claves están tipadas: una errata **no compila**. Nueva flag: `pnpm new:flag`.

## Comandos

```bash
pnpm fe:console      # dev server en :4200
pnpm fe:test         # Vitest (el runner por defecto de Angular 22)
pnpm fe:build
```

## Trampas conocidas

- **TypeScript 6** es obligatorio en Angular 22.
- Los estilos de `libs/` se importan como `@use 'ui-kit/styles/tokens'`
  (resuelto por `stylePreprocessorOptions.includePaths` en `angular.json`).
- `libs/api-client/src/lib/generated/` **no se edita**: se regenera con `pnpm api:gen`.
- Si una librería de terceros depende de Zone.js, fallará de forma sutil. Es un motivo
  más para mantener el motor de mapa detrás de su puerto.
