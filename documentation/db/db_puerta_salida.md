# DB / Data-Model Contract — Puerta de Salida

> El proyecto no tiene base de datos: el "modelo de datos" es el **estado en memoria** de
> `motor.js` (variables del IIFE + estructura `laberinto`). Este contrato define esas estructuras.

---

## ADR-001 — Colocación de la salida en mapa procedural (resuelve conflicto spec↔código)

### Status
Accepted

### Context
La spec (`specs/puerta_salida.md`, RF-1/RF-2) asume un **`plano` estático** con un valor `2` en una
**celda fija** hardcodeada. El código real **no** tiene `plano` estático: `generarMapa()` produce un
laberinto **procedural por DFS** con dimensiones aleatorias (`CELDAS_F=4..7`, `CELDAS_C=7..11`) en
cada `inicializar()`. No existe coordenada fija válida entre mapas distintos.

### Decision
La puerta se coloca **algorítmicamente** en cada generación: se elige la celda `'camino'` **más
lejana del spawn del jugador** (celda `(1,1)`, pos `1.5,1.5`) mediante **BFS de distancia en pasos**
sobre el grafo de celdas transitables, y se reetiqueta como `tipo:'salida'`. "Fija" se reinterpreta
como **"determinista y única por nivel generado"**, no como coordenada constante.

### Options Considered
- **A — Celda más lejana por BFS (elegida).** Pros: siempre alcanzable (el DFS garantiza laberinto
  conexo), obliga a recorrer el mapa, determinista dado el mapa. Cons: requiere un BFS extra en init.
- **B — Celda aleatoria entre las `libres`.** Pros: trivial. Cons: puede caer pegada al spawn → nivel
  trivial; menos tensión.
- **C — Hardcodear coordenada (lo que pedía la spec).** Pros: literal a la spec. Cons: **inválido** —
  rompe con dimensiones aleatorias; la celda podría ser `'pared'`.

### Rationale
A es la única que respeta el espíritu de la spec (meta lejana que exige explorar) y es compatible con
el mapa procedural. Coste O(celdas) despreciable (mapas ≤ 23×23).

### Consequences
La spec RF-1 se cumple en *semántica* (tipo `'salida'`) pero no en *mecanismo* (no hay `plano[..]=2`).
Documentado aquí para que QA no lo marque como desviación.

---

## 1. Tipos de celda (`laberinto.mapa[f][c].tipo`)

| valor | Origen | Colisión | Raycasting (DDA) | Minimapa |
|-------|--------|----------|------------------|----------|
| `'pared'` | `grid===1` | bloquea | detiene rayo (textura muro) | `#004400` |
| `'camino'` | `grid!==1` | transitable | transparente | `#111` |
| **`'salida'`** *(NUEVO)* | post-proceso BFS | **transitable** | **detiene rayo (cian)** | **`#00ffff`** |

> Nota de diseño: `'salida'` es **transitable para el movimiento** pero **opaca para el rayo** — se
> ve como un muro/portal cian sólido, pero el jugador puede *entrar* en su celda (eso dispara la
> victoria). Esta asimetría es intencional (portal luminoso).

## 2. Estructura `laberinto` (extensión)

```
laberinto = {
  mapa:     Celda[filas][columnas],   // sin cambios estructurales; admite tipo:'salida'
  filas, columnas,
  salida:   { f: number, c: number }  // NUEVO — coordenada de celda de la puerta (única)
}
```

## 3. Variables de estado nuevas (scope del IIFE)

| Variable | Tipo | Init (en `inicializar()`) | Semántica |
|----------|------|---------------------------|-----------|
| `nivelCompletado` | boolean | `false` | `true` cuando el jugador pisa la salida → pausa motor + overlay victoria |
| `numEnemigosInicial` | number | `N` (= `Math.min(5, libres.length)`) | cantidad a reaparecer en cada recasteo |
| `temporizadorActivo` | boolean | `false` | `true` mientras corre la cuenta atrás de búsqueda |
| `temporizadorFinMs` | number | `0` | timestamp (`performance.now()`) en que expira la ventana |

## 4. Constantes nuevas

| Constante | Valor | Uso |
|-----------|-------|-----|
| `TIEMPO_BUSQUEDA_MS` | `30000` | duración de la ventana de búsqueda (30 s, **tiempo real** no frames) |
| `SALIDA_COLOR` | `[0, 255, 255]` | RGB cian del portal en vista 3D |
| `SALIDA_PULSO_HZ` | `~3` | frecuencia del parpadeo (vía `performance.now()`) |

> **Decisión temporal:** la cuenta atrás usa **tiempo de pared** (`performance.now()`), no conteo de
> frames, para que 30 s sean 30 s reales independientemente del FPS de `requestAnimationFrame`.

## 5. Modelo de la máquina de estados

```
                 mata último enemigo
   [JUGANDO] ───────────────────────────▶ [BUSCANDO] (temporizadorActivo, fin=now+30s)
      │  ▲                                     │   │
      │  └──────── recasteo (reaparecen N) ◀───┘   │ expira (now>=fin)
      │            enemigos.length>0               │
      │  pisa salida                  pisa salida  │
      ▼                                            ▼
   [COMPLETADO] (nivelCompletado=true) ◀───────────┘
      │
      │ tecla [R] → inicializar()
      ▼
   [JUGANDO]

   [MUERTO] (gameOver=true)  ← daño letal, en cualquier estado de juego; [R] reinicia
```

- `JUGANDO`: `enemigos.length>0`, `!temporizadorActivo`, `!nivelCompletado`, `!gameOver`.
- `BUSCANDO`: `enemigos.length===0`, `temporizadorActivo`.
- Transición recasteo: al expirar, `reaparecerEnemigos(numEnemigosInicial)` + `temporizadorActivo=false`.
- Victoria (RF-5) tiene prioridad y puede ocurrir en `JUGANDO` o `BUSCANDO`.
