# Convenciones de Implementación — Laberinto 2.5D

> **Leer este archivo PRIMERO** (estrategia de prompt-caching SDD). Aplica a todas las tareas
> del spec `refactor-and-best-practices`. Luego leer SOLO la sección de arquitectura asignada.

---

## Estructura del proyecto post-refactor

```
proyecto_laberinto_25d/
├── index.html            ← solo cambia <script> a type="module" src="src/main.js"
├── motor.js              ← MONOLITO ORIGINAL — se elimina al final del refactor
└── src/
    ├── constants.js
    ├── audio.js
    ├── input.js
    ├── textures.js
    ├── state.js
    ├── map.js
    ├── raycaster.js
    ├── player.js
    ├── enemies.js
    ├── items.js
    ├── renderer.js
    ├── game.js
    └── main.js
```

**Stack**: HTML5 + Canvas 2D + Web Audio API. Sin bundler, sin frameworks, sin build step. JS puro.

---

## Estilo de código

- Indentación **4 espacios**; `const`/`let` (nunca `var`).
- **Sin `"use strict"`** — los módulos ES6 son strict por defecto.
- **Sin IIFE** — el aislamiento lo provee el sistema de módulos.
- Nombres de dominio en **español** (`jugador`, `laberinto`, `enemigos`, `colocarSalida`).
- Constantes en `UPPER_SNAKE_CASE`, declaradas en `constants.js`, nunca inline.
- Funciones nombradas (no arrow functions para funciones top-level exportadas).

---

## Reglas de módulos ES6

1. **Imports explícitos**: toda dependencia se declara con `import { X } from './Y.js'`. Extensión `.js` obligatoria (navegador nativo no resuelve sin ella).
2. **Sin side effects en imports**: ningún módulo ejecuta lógica de juego al ser importado (excepto textures.js que genera las texturas una vez).
3. **Estado centralizado**: todo estado mutable vive en `state.js → state`. Ningún módulo declara variables globales propias fuera de `state`.
4. **Canvas privado**: solo `renderer.js` accede a `ctx` y `canvas`. Ningún otro módulo llama a `ctx.*`.
5. **Sin dependencias circulares**: el grafo de imports es un DAG. Si una tarea introduce una dependencia circular, **ABORTAR y reportar**.

---

## Estado mutable: reglas de escritura

- Toda modificación de `state.*` ocurre dentro de la función responsable del dominio correspondiente.
- **`playerHP`**: siempre `Math.min(PLAYER_MAX_HP, Math.max(0, ...))`.
- **`temporizadorFinMs`**: timestamp absoluto de `performance.now()`. Prohibido `Date.now()`.
- **Índices de mapa**: toda lectura `state.laberinto.mapa[f][c]` verifica `0 <= f < filas` y `0 <= c < columnas`.
- **Cota de spawn**: `reaparecerEnemigos(n)` usa `Math.min(n, libres.length)`.

---

## Reglas de seguridad (heredadas de `conventions/security.md`)

1. Sin `eval`, `Function`, `innerHTML`, `fetch`, `WebSocket`, ni `localStorage`.
2. Bucles sobre el mapa con cotas explícitas (no `while(true)` sin salida).
3. BFS de `colocarSalida` marca celdas visitadas para no reenqueue.
4. CSP-friendly: sin `<script>` inline nuevos en `index.html`.

---

## Pruebas / validación

No hay framework de tests. **Validación = sintaxis + ejecución manual.**

**Lint sintáctico** (obligatorio por tarea de código):
```bash
node --check src/<módulo>.js
```
Debe salir con código 0.

**Validación funcional** (manual, documentar en reporte): abrir `index.html` en navegador y verificar el criterio de aceptación asignado.

---

## Límite de alcance por tarea

Cada tarea solo edita los archivos de su `file_scope`. Si necesita tocar algo fuera, **ABORTAR y reportar** — nunca editar fuera de alcance.

Dado que los módulos son independientes, las tareas de implementación de distintos módulos pueden ejecutarse en paralelo (sin colisión de archivos). Las tareas de `index.html` y `motor.js` son exclusivas y van en oleada separada.

---

## Convenciones de seguridad (detalle)

Ver `documentation/conventions/security.md`.
