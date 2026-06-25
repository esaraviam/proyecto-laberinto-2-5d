# UI/Render Contract — Refactor: Módulos ES6
## Spec: `refactor-and-best-practices`

> No existe framework de UI. Este contrato define la **arquitectura de renderizado** del canvas,
> las capas visuales, y el estado que cada función de render consume. Todo en `src/renderer.js`.

---

## Layout del canvas

```
Canvas #pantallaDoom — 960 × 480 px
┌──────────────────────────────────┬──────────────────┐
│  VISTA 3D (raycasting)           │  MINIMAPA        │
│  640 × 480                       │  320 × 480       │
│                                  │                  │
│  ← offsetX=0                     │← offsetX=640     │
└──────────────────────────────────┴──────────────────┘
```

El separador visual (`#separator` en HTML) es un elemento CSS sobre el canvas, no dibujado por JS.

---

## Orden de capas por frame (back-to-front)

```
Frame render order
├── 1. Suelo + techo texturizados     renderizar3D() — pixel buffer
├── 2. Paredes (DDA raycasting)       renderizar3D() — pixel buffer
├── 3. putImageData → canvas          renderizar3D() — flush buffer
├── 4. Damage flash overlay           renderizar3D() — ctx.fillRect rgba rojo
├── 5. Muzzle flash overlay           renderizar3D() — ctx radialGradient
├── 6. Sprites de enemigos            renderizarEnemigos() — ctx.fillRect col-by-col
├── 7. Sprites de ítems               renderizarItems() — ctx.fillRect col-by-col
├── 8. Mira (crosshair + hit marker)  renderizarMira()
├── 9. HUD (HP, kills, arma, timer)   renderizarHUD()
└── 10. Minimapa                      renderizarMinimapa()
```

**Regla**: el minimapa siempre es la última capa. El HUD se dibuja antes del minimapa pero después de los sprites (para que los overlays de game-over/victoria cubran todo).

---

## Componentes de renderizado

### `renderizar3D()`
**Lee de state**: `state.jugador.{x,y,angulo}`, `state.laberinto`, `state.damageFlashTimer`, `state.muzzleFlashTimer`

**Usa de raycaster**: `lanzarRayoDDA`, llena `zBuffer[x]`, llena `rayCache[]`

**Usa de textures**: `muroTexData`, `techoTexData`, `sueloTexData`

**Setup interno** (top-level en renderer.js):
```js
const canvas = document.getElementById('pantallaDoom');
const ctx = canvas.getContext('2d');
const frameBuffer = ctx.createImageData(ANCHO_3D, ALTO);
const buf = frameBuffer.data;
```

**Celda de tipo `'salida'`**: color cian pulsante calculado con `performance.now()` y `SALIDA_PULSO_HZ`. No usa textura de muro.

---

### `renderizarEnemigos()`
**Lee de state**: `state.enemigos[]`, `state.jugador`, `state.hitMarkerTimer`

**Lee de raycaster**: `zBuffer` (z-buffer check por columna)

**Ordenación**: de más lejano a más cercano (painter's algorithm).

**Silueta humanoid**: renderizado columna a columna en `ctx.fillRect`. Partes: cabeza (ojos rojos), torso, brazos, piernas, pies. Flash blanco si `hitMarkerTimer > 0`.

---

### `renderizarItems()`
**Lee de state**: `state.items[]`, `state.jugador`

**Lee de raycaster**: `zBuffer` (z-buffer check)

**Flotación**: `Math.sin(performance.now() * ITEM_FLOAT_SPEED)` desplaza `spriteTop`.

**Tipos visuales**:
- `'salud'`: cruz roja (barra vertical + barra horizontal)
- `'ametralladora'`: silueta de arma (cañón + cuerpo + empuñadura) con glow amarillo pulsante

---

### `renderizarMira()`
**Lee de state**: `state.cooldownDisparo`, `state.hitMarkerTimer`

**Color**: verde (`rgba(0,255,0,0.9)`) en reposo, naranja (`rgba(255,80,0,0.9)`) durante cooldown.

**Hit marker**: 4 diagonales blancas que aparecen en `hitMarkerTimer > 0`, desvaneciéndose.

---

### `renderizarHUD()`
**Lee de state**: `state.gameOver`, `state.nivelCompletado`, `state.playerHP`, `state.kills`, `state.cooldownDisparo`, `state.tieneAmetralladora`, `state.temporizadorActivo`, `state.temporizadorFinMs`

**Elementos y posiciones**:

| Elemento | Posición canvas | Condición |
|----------|----------------|-----------|
| Overlay "HAS MUERTO" | centro 3D | `gameOver === true` |
| Overlay "¡NIVEL COMPLETADO!" | centro 3D | `nivelCompletado === true` |
| Barra de HP | top-right (x=482, y=8, w=150, h=18) | siempre en juego activo |
| Contador ENEMIGOS | top-left (x=6, y=6) | siempre en juego activo |
| Contador KILLS | top-left (x=6, y=32) | siempre en juego activo |
| Indicador RECARGANDO | top-left (x=6, y=58) | `cooldownDisparo > 0` |
| Indicador ARMA | top-left (y=58 o 84) | siempre en juego activo |
| Cuenta regresiva "BUSCA LA SALIDA: Xs" | centro medio canvas | `temporizadorActivo === true` |

**Paleta HUD**: texto principal `#00ff00`, alertas `#ffcc00`, peligro `#ff3300`, fondo cajas `rgba(0,0,0,0.45)`.

**Cuenta regresiva**: fondo `rgba(0,0,0,0.55)` + borde `#00ff00`. Texto verde si restante > 5s, rojo si ≤ 5s.

---

### `renderizarMinimapa()`
**Lee de state**: `state.laberinto`, `state.jugador`, `state.enemigos[]`, `state.items[]`

**Lee de raycaster**: `rayCache[]`

**Posición**: `offsetX = ANCHO_3D = 640`. Toda coordenada canvas suma `offsetX` en X.

**Escala dinámica**: `tamCelda = Math.min(ANCHO_MAPA / columnas, ALTO / filas)`.

**Elementos visuales**:

| Elemento | Color |
|----------|-------|
| Fondo | `#050505` |
| Pared | `#004400` |
| Camino | `#111` |
| Salida | `#00ffff` |
| Rayos FOV | `rgba(0,255,0,0.15)` (desde rayCache) |
| Enemigo normal | `#ff3300` (silueta humanoid) |
| Enemigo persiguiendo | `#ff0000` |
| Ítem salud | `#ff3333` pulsante (alpha con sin) |
| Ítem ametralladora | `#ffaa00` pulsante |
| Jugador | `#00ff00` círculo + línea de dirección |

---

## Restricciones de renderizado

| Restricción | Detalle |
|-------------|---------|
| **z-buffer** | Todo sprite (enemigo, ítem) comprueba `distCorr < zBuffer[col]` antes de pintar. |
| **Near clip** | Sprites a distancia < `SPRITE_NEAR_CLIP` se omiten. |
| **Painter's algorithm** | Ordenar sprites de lejano a cercano antes de iterar columnas. |
| **Cian reservado** | `#00ffff` / `[0,255,255]` exclusivo para celdas `'salida'`. No usar en ningún otro elemento. |
| **Sin clearing explícito** | El pixel buffer de 3D sobreescribe todo el área 3D cada frame. No se necesita `ctx.clearRect`. |
| **Font** | `'Courier New'` monoespaciado; obligatorio para estética retro. |

---

## Responsabilidad de `renderer.js` sobre el canvas

`renderer.js` es el **único módulo** que opera sobre `ctx` y `canvas`. Ningún otro módulo llama a `ctx.*` directamente. El canvas element es privado del módulo renderer.
