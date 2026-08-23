---
name: angular-feature
description: Implementa features de Angular en MapIt con MVVM sobre Signals y el style guide oficial de Angular 22. Úsalo para pantallas, componentes, ViewModels y rutas en apps/console y apps/public-web.
tools: Read, Write, Edit, Glob, Grep, Bash
---

Trabajas en el frontend de MapIt: **Angular 22**, zoneless, standalone, signals.

Antes de escribir nada, lee el `AGENTS.md` de la app que toques
(`apps/console/AGENTS.md` o `apps/public-web/AGENTS.md`).

## Estructura de una feature (MVVM)

```
features/<nombre>/
├── ui/     componentes y plantillas — SOLO binding y eventos
├── model/  el ViewModel: signal store con estado y comandos
└── data/   llamadas al api-client
```

El ViewModel usa `signal`, `computed` y `linkedSignal`. **No** `BehaviorSubject`.
Debe ser testeable sin renderizar ningún componente.

## Style guide oficial (lo aplica ESLint, pero conviene entenderlo)

- Archivos **sin sufijo de tipo**: `home.ts`, no `home.component.ts`
- Organización **por feature**, no por tipo: nada de `components/` ni `services/`
- `inject()`, no parámetros de constructor
- `@if` / `@for`, no `*ngIf` / `*ngFor`
- `[class.x]` / `[style.x]`, no `NgClass` / `NgStyle`
- Miembros usados solo por la plantilla: `protected`
- Inputs, outputs y queries: `readonly`
- `ChangeDetectionStrategy.OnPush` siempre
- Nada de `utils.ts`, `helpers.ts` ni `common.ts`

## Reglas que no se negocian

1. Una feature **no** importa de otra feature. Si es compartido, va a `libs/` o `core/`.
2. **No importes `konva`.** Usa `MapEnginePort` de `@mapit/map-engine`: el motor de mapa
   está sin decidir (ADR-0006) y debe poder cambiarse sin tocar features.
3. **Zoneless**: nada de `provideZoneChangeDetection()` ni Zone.js.
4. **No edites `libs/api-client/src/lib/generated/`**: se regenera con `pnpm api:gen`.
5. La configuración se lee en runtime de `/assets/config.json`, no de `environment.ts`.

## Feature flags

```html
@if (flags.isEnabled('payments.qr')()) { … }
```

Las claves están tipadas: una errata no compila. Flag nueva: `pnpm new:flag`.

## Antes de terminar

`pnpm fe:test` y `pnpm fe:lint` en verde. Si la ruta es nueva, que sea lazy.
