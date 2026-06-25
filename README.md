# Laberinto Retro 2.5D

Motor de raycasting escrito en JavaScript puro, sin librerías. Genera laberintos procedurales y los renderiza con perspectiva 3D en un canvas HTML.

**[Jugar en vivo](https://game.esaraviam.dev)** · **[Documentación técnica](https://game.esaraviam.dev/docs.html)**

---

## Capturas

| Vista 3D + Minimapa |
|---|
| Canvas 960×480 — raycasting (izq.) e inspección 2D (der.) |

---

## Stack

- HTML5 Canvas API (pixel buffer directo vía `ImageData`)
- Web Audio API (síntesis de sonido procedural)
- JavaScript ES6+ puro — cero dependencias, cero bundlers

---

## Cómo funciona

### 1. Generación del laberinto — DFS recursivo

Cada partida genera un laberinto distinto con el algoritmo de *backtracking recursivo*. El mundo se representa en una grilla `(2F+1) × (2C+1)`: las celdas impares son habitaciones y las celdas intermedias son muros derribables.

```js
while (pila.length > 0) {
    const [r, c] = pila[pila.length - 1];
    const vecinos = dirs.filter(v => !vis[v.nr][v.nc]);

    if (vecinos.length > 0) {
        const v = vecinos[Math.floor(Math.random() * vecinos.length)];
        grid[r * 2 + 1 + v.dr][c * 2 + 1 + v.dc] = 0; // derriba el muro
        vis[v.nr][v.nc] = true;
        pila.push([v.nr, v.nc]);
    } else {
        pila.pop(); // backtrack
    }
}
```

El tamaño varía aleatoriamente entre 4–7 filas y 7–11 columnas de celdas lógicas.

---

### 2. Colocación de la salida — BFS

La puerta de salida se coloca en la celda **más lejana del spawn** medida en pasos reales por los pasillos, usando BFS desde `(1,1)`. Se usa un índice `cabeza` en lugar de `Array.shift()` para mantener la BFS en O(N).

---

### 3. Motor de renderizado — DDA Raycasting

Para cada una de las 640 columnas de pantalla se lanza un rayo con el algoritmo **DDA (Digital Differential Analyzer)**: avanza celda a celda saltando siempre a la intersección de cuadrícula más cercana, sin artefactos de sampling.

```js
while (!hit) {
    if (sideDistX < sideDistY) {
        sideDistX += deltaDistX;
        mapX += stepX;
        side = 0;
    } else {
        sideDistY += deltaDistY;
        mapY += stepY;
        side = 1;
    }
    if (tipoCelda === 'pared') hit = true;
}
```

La altura de cada columna se calcula con la **distancia perpendicular** (no euclidiana) para evitar el efecto ojo de pez:

```js
const distancia = resultado.dist * Math.cos(anguloRayo - jugador.angulo);
const alturaPared = Math.floor(ALTO / distancia);
```

---

### 4. Texturas procedurales y buffer de píxeles

Las tres texturas (muro de ladrillo, techo de paneles, suelo de hormigón) se generan al inicio en canvas ocultos. Sus píxeles se leen una sola vez con `getImageData()` y se acceden como array durante el render, evitando llamadas repetidas a la API del canvas.

El frame completo se escribe en un `ImageData` y se sube al canvas con un único `putImageData()` por frame.

---

### 5. Sprites — Z-Buffer y painter's algorithm

Los enemigos e ítems se proyectan como sprites 2D. Durante el render de paredes se guarda `zBuffer[x]` (distancia perpendicular por columna). Al dibujar cada sprite, se omiten las columnas donde la pared está más cerca:

```js
if (distCorr >= zBuffer[col]) continue; // la pared tapa al sprite
```

Los sprites se ordenan de más lejano a más cercano antes de renderizar (*painter's algorithm*) para resolver la oclusión entre ellos.

Los personajes enemigos son geometría procedural pura: no hay imágenes, se dibujan columna a columna definiendo zonas anatómicas (cabeza, torso, brazos, piernas).

---

### 6. IA de enemigos

Cada enemigo alterna entre tres modos evaluados cada frame:

| Modo | Condición | Comportamiento |
|---|---|---|
| Patrulla | Fuera de rango o sin visibilidad | Deambula sin retroceder |
| Caza | Jugador a < 8 celdas con línea de visión | Se dirige directo al jugador |
| Ataque | Distancia ≤ 1.2 unidades | Inflige daño en ciclos de cooldown |

La línea de visión se verifica muestreando 10 puntos por unidad de distancia entre el enemigo y el jugador.

---

### 7. Colisiones — Wall sliding

El movimiento prueba los ejes X e Y de forma **independiente**, permitiendo que el jugador se deslice a lo largo de las paredes en lugar de bloquearse completamente:

```js
// Eje X
if (esCamino(nx + r, y) && esCamino(nx - r, y)) x = nx;
// Eje Y (independiente del resultado anterior)
if (esCamino(x, ny + r) && esCamino(x, ny - r)) y = ny;
```

El radio de colisión se verifica en las 4 esquinas de la caja del jugador.

---

### 8. Audio procedural — Web Audio API

Ningún archivo de audio: todos los sonidos se sintetizan en tiempo real con osciladores y envolventes de amplitud.

| Sonido | Forma de onda | Efecto |
|---|---|---|
| Disparo | Sawtooth | 180 Hz → 60 Hz en 120 ms |
| Impacto | Square | 440 Hz → 120 Hz |
| Daño | Sawtooth | 120 Hz → 50 Hz, más fuerte |
| Pickup salud | Sine | Tres notas 440→660→880 |
| Pickup arma | Square | Cuatro notas 200→400→600→800 |

---

### 9. Game loop

`requestAnimationFrame` sincroniza el loop con la tasa de refresco del monitor y pausa automáticamente cuando la pestaña no está visible.

```
requestAnimationFrame → timers-- → lógica → render 3D → sprites → HUD → minimapa → requestAnimationFrame
```

Los cooldowns (disparo, flash, hit marker) se miden en frames. El temporizador de búsqueda usa `performance.now()` para garantizar 30 segundos reales independientemente del FPS.

---

### 10. Lógica de victoria y temporizador

La condición de victoria es **pisar la puerta de salida**, no matar enemigos. Al eliminar a todos los enemigos se activa un temporizador de 30 s: si el jugador no encuentra la salida a tiempo, los enemigos reaparecen.

```
Enemigos activos → [último enemigo muerto] → Cuenta atrás 30s
    ↓ jugador pisa salida                       ↓ tiempo agotado
NIVEL COMPLETADO                           Enemigos reaparecen
```

El spawn de enemigos e ítems usa **Fisher-Yates** para garantizar una distribución uniforme, a diferencia del truco `.sort(() => Math.random() - 0.5)` que produce distribuciones sesgadas.

---

## Controles

| Tecla | Acción |
|---|---|
| `↑` / `↓` | Avanzar / retroceder |
| `←` / `→` | Rotar |
| `Espacio` | Disparar |
| `R` | Nuevo mapa |

---

## Estructura del proyecto

```
├── index.html      # Página del juego
├── motor.js        # Motor completo (raycasting, IA, audio, HUD)
├── docs.html       # Documentación técnica interactiva
└── documentation/  # Especificaciones SDD del proyecto
```

---

## Desarrollo local

No requiere servidor ni build step. Abre `index.html` directamente en el navegador.
