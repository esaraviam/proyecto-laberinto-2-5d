# Spec: Refactor — Separación en Módulos ES6

## 1. Objetivo y propuesta de valor

El archivo `motor.js` (1 566 líneas) contiene el 100 % del código del motor en un único IIFE: constantes, texturas, audio, estado, generación de mapa, raycasting, render 3D, IA de enemigos, lógica de juego, disparos, pickups, HUD, minimapa, input y bucle principal coexisten sin separación estructural.

El refactor divide ese monolito en módulos ES6 (archivos `.js` individuales cargados con `type="module"`), asignando a cada módulo **una única responsabilidad**. El resultado es un árbol de archivos comprensible en el que añadir, cambiar o depurar una funcionalidad concreta no requiere scrollear por código no relacionado.

No se agregarán features nuevas ni se cambiará el gameplay: al finalizar el refactor el juego debe ser indistinguible del estado actual para el jugador.

---

## 2. Personas y actores

| Actor | Descripción |
|-------|-------------|
| **Esteban (autor)** | Único desarrollador. Mantiene y extiende el proyecto en solitario desde un entorno local sin bundler. |
| **Navegador** | Carga los módulos ES6 nativos directamente desde `index.html` via `<script type="module">`. No hay paso de build. |

---

## 3. Requisitos funcionales y user stories

### RF-1 — Estructura de módulos por responsabilidad

El código deberá dividirse en los siguientes módulos (archivos `.js`):

| Módulo | Ruta sugerida | Responsabilidades actuales en `motor.js` |
|--------|--------------|------------------------------------------|
| `constants.js` | `src/constants.js` | Todas las `const` del bloque CONSTANTS (líneas 7–41) |
| `textures.js` | `src/textures.js` | `crearTexturaMuro`, `crearTexturaTecho`, `crearTexturaSuelo` + precómputo de pixel data |
| `audio.js` | `src/audio.js` | `ensureAudioCtx`, `playShoot`, `playHit`, `playEnemyAlert`, `playDamage`, `playPickup`, `playPickupWeapon` |
| `map.js` | `src/map.js` | `generarMapa`, `colocarSalida`, `celdasLibresLejanas` |
| `state.js` | `src/state.js` | Variables de estado global del juego (HP, kills, timers, flags, items, etc.) |
| `input.js` | `src/input.js` | `teclasPresionadas`, event listeners `keydown`/`keyup` |
| `player.js` | `src/player.js` | `esCamino`, `procesarMovimiento`, spawn del jugador |
| `raycaster.js` | `src/raycaster.js` | `lanzarRayoDDA`, `zBuffer`, `rayCache` |
| `renderer.js` | `src/renderer.js` | `renderizar3D`, `renderizarEnemigos`, `renderizarItems`, `renderizarMira`, `renderizarHUD`, `renderizarMinimapa` |
| `enemies.js` | `src/enemies.js` | `esLineaLibre`, `elegirSiguienteCelda`, `actualizarEnemigos`, `reaparecerEnemigos` |
| `items.js` | `src/items.js` | `verificarPickups` |
| `game.js` | `src/game.js` | `inicializar`, `verificarVictoria`, `gestionarTemporizador`, `disparar`, `buclePrincipal` |
| `main.js` | `src/main.js` | Punto de entrada: importa `game.js` y arranca el juego |

### RF-2 — Sin bundler ni transpilación

Los módulos se cargan con `import`/`export` ES6 nativo. El `index.html` carga únicamente:

```html
<script type="module" src="src/main.js"></script>
```

No se introduce Webpack, Vite, Rollup, Babel ni ninguna otra herramienta de build.

### RF-3 — Gameplay idéntico al original

Todos los comportamientos existentes deben conservarse sin cambios observables:
- Canvas 960 × 480 px, mapa procedural, controles con flechas + Space.
- Motor DDA, texturas de ladrillo/techo/suelo, enemigos con IA de persecución.
- Puerta de salida por BFS, temporizador de búsqueda, reaparición de enemigos.
- HUD (HP, kills, arma, cuenta atrás), minimapa, sonidos Web Audio.

### RF-4 — Punto de entrada limpio

`main.js` debe contener exclusivamente las importaciones y la llamada de arranque. No debe incluir lógica de juego.

### RF-5 — Sin dependencias circulares

El grafo de importaciones debe ser un DAG. `constants.js` no importa nada; `main.js` importa todo. Los módulos de lógica (`game.js`, `enemies.js`) pueden importar estado (`state.js`) pero el estado no importa lógica.

---

## 4. Reglas de negocio y restricciones

| Restricción | Detalle |
|-------------|---------|
| **ES6 modules nativos** | `import`/`export` estándar; sin CommonJS (`require`). |
| **Sin `"use strict"` explícito** | Los módulos ES6 son strict por defecto; eliminar la declaración redundante. |
| **Sin IIFE** | El wrapper `(function(){ … })()` desaparece; el aislamiento lo provee el sistema de módulos. |
| **Stack actual** | HTML5 + Canvas 2D + Web Audio API. Sin frameworks ni librerías externas. |
| **Sin renombrar símbolos públicos** | Las funciones y variables conservan sus nombres actuales para no romper referencias internas. |
| **`index.html` mínimo** | Solo se modifica la etiqueta `<script>` para apuntar a `src/main.js`; el resto del HTML no cambia. |

---

## 5. Criterios de aceptación explícitos

- [ ] Existe el directorio `src/` con los 13 módulos listados en RF-1.
- [ ] `index.html` carga únicamente `<script type="module" src="src/main.js"></script>`.
- [ ] El juego arranca en el navegador sin errores en consola.
- [ ] El gameplay es idéntico al original: movimiento, disparo, enemigos, salida, HUD y minimapa funcionan correctamente.
- [ ] Ningún módulo supera las 200 líneas (si alguno lo supera, documentar la razón).
- [ ] No existen dependencias circulares entre módulos (verificable con una revisión manual del grafo de imports).
- [ ] El archivo `motor.js` original puede eliminarse sin que el juego deje de funcionar.
- [ ] Los sonidos (disparo, impacto, daño, pickup) se reproducen correctamente.
- [ ] La puerta de salida (tipo `salida`, color cian pulsante) aparece y activa la pantalla de victoria al pisarla.
- [ ] El temporizador de búsqueda y la reaparición de enemigos funcionan con el mismo comportamiento que antes del refactor.
