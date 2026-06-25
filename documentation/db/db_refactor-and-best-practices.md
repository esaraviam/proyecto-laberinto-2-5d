# DB/State Contract — Refactor: Módulos ES6
## Spec: `refactor-and-best-practices`

> No existe base de datos ni persistencia. Este contrato define el **esquema del estado de juego**
> que vive en `src/state.js` como objeto mutable `state`. Todos los módulos lo leen y mutan directamente.

---

## Objeto raíz: `state`

```
state
├── laberinto: Laberinto | null
├── jugador: Jugador | null
├── enemigos: Enemy[]
├── items: Item[]
├── kills: number
├── playerHP: number           (0..PLAYER_MAX_HP)
├── cooldownDisparo: number    (frames restantes ≥ 0)
├── enemyAttackTimer: number   (frames restantes ≥ 0)
├── muzzleFlashTimer: number   (frames restantes ≥ 0)
├── hitMarkerTimer: number     (frames restantes ≥ 0)
├── damageFlashTimer: number   (frames restantes ≥ 0)
├── gameOver: boolean
├── nivelCompletado: boolean
├── tieneAmetralladora: boolean
├── numEnemigosInicial: number
├── temporizadorActivo: boolean
└── temporizadorFinMs: number  (performance.now() timestamp absoluto)
```

---

## Esquema: `Laberinto`

```
Laberinto {
  mapa: Cell[][]          // mapa[fila][columna]
  filas: number           // = filasCeldas * 2 + 1
  columnas: number        // = colsCeldas  * 2 + 1
  salida: { f: number, c: number }   // coords de la celda de tipo 'salida'
}
```

### Esquema: `Cell`

```
Cell {
  f: number               // índice de fila
  c: number               // índice de columna
  tipo: 'pared' | 'camino' | 'salida'
}
```

**Invariantes de `Laberinto`**:
- `mapa[f][c].tipo` es `'pared'` para toda celda del borde exterior.
- Existe exactamente una celda con `tipo === 'salida'` por mapa.
- `salida.f !== 1 || salida.c !== 1` (la salida nunca coincide con el spawn del jugador).
- La celda de salida es transitable para colisión pero opaca para el rayo DDA.

---

## Esquema: `Jugador`

```
Jugador {
  x: number       // posición en unidades de celda (spawn: 1.5)
  y: number       // posición en unidades de celda (spawn: 1.5)
  angulo: number  // radianes (spawn: 0)
}
```

---

## Esquema: `Enemy`

```
Enemy {
  x: number         // posición actual X
  y: number         // posición actual Y
  targetX: number   // objetivo de movimiento X (centro de celda)
  targetY: number   // objetivo de movimiento Y (centro de celda)
  lastDx: number    // última dirección X (anti-backtrack en patrulla)
  lastDy: number    // última dirección Y
  chasing: boolean  // true si el enemigo está persiguiendo al jugador
}
```

---

## Esquema: `Item`

```
Item {
  x: number                           // posición X (centro de celda)
  y: number                           // posición Y (centro de celda)
  tipo: 'salud' | 'ametralladora'
  activo: boolean                     // false = ya recogido, no renderizar
}
```

---

## Reglas de negocio del estado

| Regla | Descripción |
|-------|-------------|
| **Reset total** | `inicializar()` reinicia TODOS los campos de `state` (incluidos `nivelCompletado`, `temporizadorActivo`, etc.) antes de generar el nuevo mapa. |
| **Victoria única** | `nivelCompletado` solo se setea a `true` dentro de `verificarVictoria()`, y solo si `!gameOver`. |
| **Temporizador real** | `temporizadorFinMs` es un timestamp absoluto de `performance.now()`. Prohibido usar `Date.now()`. |
| **Cota de spawn** | `numEnemigosInicial = Math.min(5, libres.length)`. `reaparecerEnemigos(n)` usa `Math.min(n, libres.length)`. |
| **HP acotado** | `playerHP` siempre en `[0, PLAYER_MAX_HP]`. Usar `Math.min/Math.max` en toda modificación. |
| **Índices de mapa** | Toda lectura `state.laberinto.mapa[f][c]` debe verificar `0 <= f < filas` y `0 <= c < columnas`. |

---

## Inicialización de `state`

`state.js` exporta `state` con valores de arranque seguros:

```js
import { PLAYER_MAX_HP } from './constants.js';

export const state = {
  laberinto: null,
  jugador: null,
  enemigos: [],
  items: [],
  kills: 0,
  playerHP: PLAYER_MAX_HP,
  cooldownDisparo: 0,
  enemyAttackTimer: 0,
  muzzleFlashTimer: 0,
  hitMarkerTimer: 0,
  damageFlashTimer: 0,
  gameOver: false,
  nivelCompletado: false,
  tieneAmetralladora: false,
  numEnemigosInicial: 0,
  temporizadorActivo: false,
  temporizadorFinMs: 0,
};
```

`inicializar()` en `game.js` sobreescribe todos los campos antes del primer uso real.

---

## Flujo de mutación por fase de bucle

```
buclePrincipal()
  ├── Decrement timers           → state.cooldownDisparo--, state.muzzleFlashTimer--, etc.
  ├── procesarMovimiento()       → state.jugador.{x,y,angulo}
  ├── actualizarEnemigos()       → state.enemigos[*].{x,y,targetX,targetY,chasing}
  │                              → state.playerHP, state.damageFlashTimer, state.gameOver
  ├── verificarPickups()         → state.items[*].activo, state.playerHP, state.tieneAmetralladora
  ├── verificarVictoria()        → state.nivelCompletado
  └── gestionarTemporizador()    → state.temporizadorActivo, state.temporizadorFinMs
                                 → state.enemigos (push en reaparición)
```

**Orden de evaluación es invariante**: `gameOver` se evalúa antes que `nivelCompletado`; `nivelCompletado` actúa como pausa igual que `gameOver`.
