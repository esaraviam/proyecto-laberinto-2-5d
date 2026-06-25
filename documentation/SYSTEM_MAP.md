# SYSTEM MAP — Laberinto Retro 2.5D
_Updated by SDD Quality Gate after spec `refactor-and-best-practices` — 2026-06-25_

## Architecture Overview

Motor raycasting 2.5D en vanilla JS + Canvas 2D + Web Audio. Sin bundler.
Punto de entrada: `index.html` → `<script type="module" src="src/main.js">`.

## Module Graph (DAG)

```
constants.js  (leaf — sin imports)
audio.js      (leaf — sin imports)
input.js      (leaf — sin imports)
textures.js   → constants
state.js      → constants
map.js        → constants, state
raycaster.js  → constants, state
player.js     → constants, state, input
enemies.js    → constants, state, audio, map
items.js      → constants, state, audio
renderer.js   → constants, state, textures, raycaster
game.js       → constants, state, audio, map, raycaster, player, enemies, items, renderer
main.js       → game, input
```

## Modules & Responsibilities

| Módulo | Líneas | Responsabilidad |
|--------|--------|-----------------|
| `src/constants.js` | 55 | 33 constantes de configuración (FOV, speeds, timers, palette) |
| `src/audio.js` | 101 | Síntesis Web Audio (oscillators, gain) — 7 funciones de sonido |
| `src/input.js` | 35 | Teclado + callbacks `onDisparo`/`onReinicio` (patrón observer) |
| `src/textures.js` | 181 | Texturas procedurales muro/techo/suelo como Uint8ClampedArray |
| `src/state.js` | 38 | Estado mutable centralizado — 17 campos planos, sin getters |
| `src/map.js` | 157 | DFS-backtracker, BFS salida, Fisher-Yates spawn |
| `src/raycaster.js` | 96 | DDA raycasting — exports `zBuffer`, `rayCache`, `lanzarRayoDDA` |
| `src/player.js` | 76 | Movimiento con wall-sliding y colisión por radio |
| `src/enemies.js` | 196 | IA chase/patrol/ataque + line-of-sight + spawn de refuerzo |
| `src/items.js` | 23 | Pickup salud/ametralladora con Math.min safety |
| `src/renderer.js` | 653 | Canvas privado (#pantallaDoom) + 6 funciones de render |
| `src/game.js` | 302 | Coordinador: bucle principal, init, disparo, victoria, timer |
| `src/main.js` | 8 | Entry point: imports + 4 calls (onDisparo, onReinicio, inicializar, buclePrincipal) |

## Key Architectural Decisions

### State Pattern
- `state` es un objeto plano exportado desde `state.js`
- Todos los módulos leen y mutan `state.*` directamente (no getters/setters)
- Justificación: acceso directo sin indirección para 60fps game loop

### Canvas Encapsulation
- `ctx` y `canvas` son variables privadas top-level de `renderer.js`
- Ningún otro módulo tiene acceso al canvas DOM o contexto 2D
- `textures.js` usa `createElement('canvas')` offscreen — no es el canvas del juego

### Shared Mutable Buffers
- `zBuffer` (Float64Array) y `rayCache` (Array) exportados desde `raycaster.js`
- `renderer.js` los llena por frame; `game.js` los lee en `disparar()` para z-check
- Misma referencia compartida — las mutaciones son visibles a todos los importadores

### Input Observer Pattern
- `input.js` no puede importar `game.js` (crearía ciclo)
- Solución: `onDisparo(cb)` y `onReinicio(cb)` — callbacks registrados en `main.js`

## Runtime Requirement

`type="module"` requiere HTTP server. `file://` no funciona.
Desarrollo local: `npx serve .` o equivalente.
Deploy: Vercel (game.esaraviam.dev).

## Canvas Layout

| Zona | X | Ancho | Descripción |
|------|---|-------|-------------|
| 3D view | 0 | 640px | Raycasting DDA + sprites + HUD |
| Minimap | 640 | 320px | Vista cenital con rayCache |
| Total | — | 960px | Canvas #pantallaDoom, altura 480px |

## Data Model (state)

```js
{
  laberinto: { mapa[][], filas, columnas, salida },
  jugador:   { x, y, angulo },
  enemigos:  [{ x, y, targetX, targetY, lastDx, lastDy, chasing }],
  items:     [{ x, y, tipo, activo }],
  kills, playerHP, cooldownDisparo, enemyAttackTimer,
  muzzleFlashTimer, hitMarkerTimer, damageFlashTimer,
  gameOver, nivelCompletado, tieneAmetralladora,
  numEnemigosInicial, temporizadorActivo, temporizadorFinMs
}
```

## Quality Gate History

| Spec | Date | Verdict | QA | Arch Score |
|------|------|---------|----|----|
| refactor-and-best-practices | 2026-06-25 | GO | APPROVED-WITH-WARNINGS | 7.55/10 |

## Advisory Backlog (for next spec)

1. Extraer `normalizeAngle(a)` — duplicado 6x en renderer + game
2. Extraer `projectSprite(...)` — duplicado en renderer y game (z-check hitbox)
3. Normalizar `Math.hypot` — 4 sitios usan `Math.sqrt(dx*dx+dy*dy)`
4. `createInitialState()` factory para testabilidad
5. Considerar split `inicializar()` → `src/spawner.js` si game.js sigue creciendo
