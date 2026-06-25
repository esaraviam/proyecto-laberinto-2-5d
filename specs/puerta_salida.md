# Spec: Puerta de Salida (Fin de Nivel)

> Proyecto: **Laberinto 2.5D** — motor de raycasting en HTML + JavaScript vanilla (Canvas 2D).
> Archivos del motor: `index.html`, `motor.js`.
> Estado del motor al redactar esta spec: ya existen enemigos, combate (disparo), HP del jugador,
> IA de persecución, ítems de salud/arma y estado `gameOver` (por muerte). **No existe** condición
> de victoria. Las celdas se derivan de `plano` con `valor === 1 ? 'pared' : 'camino'`.

## 1. Objective & Value Proposition

Dotar al laberinto de una **meta jugable**: una **puerta de salida estática** que, al ser alcanzada
por el jugador, **completa el nivel**. Hoy el motor solo tiene condición de derrota (`gameOver` por
muerte) pero ningún objetivo de victoria; esto convierte el motor en un juego con propósito.

Para añadir tensión, el nivel **solo** puede completarse cruzando la puerta. Tras eliminar a todos
los enemigos, el jugador dispone de **30 segundos** para encontrar y alcanzar la salida; si no lo
logra, los enemigos **reaparecen** y se reinicia el ciclo, presionando al jugador a explorar con
rapidez en lugar de "limpiar" el mapa y caminar sin riesgo.

**Valor:** transforma un sandbox de combate en un nivel con objetivo, condición de victoria y un
bucle de tensión exploración-vs-tiempo.

## 2. User Personas & Actors

| Actor | Descripción | Interacción con la funcionalidad |
|-------|-------------|----------------------------------|
| **Jugador** | Único actor. Recorre el laberinto en primera persona (vista raycasting) y combate enemigos. | Localiza la puerta de salida, la alcanza pisando su celda, y así completa el nivel. Sufre el reapareceo de enemigos si agota el tiempo. |

No hay rol de diseñador de niveles en tiempo de ejecución: la posición de la puerta es **fija** y se
define en datos (la grilla `plano`).

## 3. Functional Requirements & User Stories

### Historias de usuario
- **HU-1** — *Como jugador, quiero ver claramente dónde está la salida* para poder dirigirme a ella.
- **HU-2** — *Como jugador, quiero completar el nivel al llegar a la puerta* para ganar la partida.
- **HU-3** — *Como jugador, quiero que matar enemigos no baste para ganar* para que el objetivo siga siendo llegar a la salida.
- **HU-4** — *Como jugador, quiero una cuenta atrás de 30 s tras limpiar el mapa* que me obligue a encontrar la puerta con urgencia.
- **HU-5** — *Como jugador, si agoto el tiempo quiero enfrentarme de nuevo a enemigos* para que no pueda quedarme quieto indefinidamente.

### Requisitos funcionales

| ID | Requisito |
|----|-----------|
| **RF-1** | La grilla soporta un nuevo tipo de celda `'salida'`, derivado del valor `2` en `plano` (junto a `1 → 'pared'`, otro → `'camino'`). |
| **RF-2** | La puerta de salida ocupa **una celda fija** definida en el mapa (valor `2`). Es transitable (el jugador puede pisarla; las colisiones la tratan como `'camino'` a efectos de movimiento). |
| **RF-3** | **Render 3D:** al mirar la puerta de frente se dibuja como una pared de color **cian brillante parpadeante** (`#00ffff`), distinguible de las paredes verdes. El parpadeo es una oscilación temporal de brillo. |
| **RF-4** | **Minimapa:** la celda de salida se pinta en **cian** (`#00ffff`) para orientar al jugador. |
| **RF-5** | **Condición de victoria:** el nivel se completa cuando la **posición del jugador cae dentro de la celda de salida** (`Math.floor(x)`/`Math.floor(y)` coinciden con la celda `'salida'`). Es la **única** forma de completar el nivel. |
| **RF-6** | Al completar el nivel se muestra un overlay **"¡NIVEL COMPLETADO!"** sobre el canvas (estética coherente con el overlay de `gameOver`) y el **motor se pausa** (se detiene la actualización de jugador/enemigos/temporizador, análogo a `gameOver`). |
| **RF-7** | **Temporizador:** cuando se elimina al **último enemigo vivo**, arranca una cuenta atrás de **30 segundos**. El tiempo restante debe ser visible para el jugador (HUD/overlay). |
| **RF-8** | **Recasteo (expiración):** si la cuenta atrás llega a 0 sin que el jugador haya alcanzado la puerta, **reaparecen enemigos** (misma cantidad inicial del nivel, en celdas libres al azar, reutilizando la lógica de spawn existente). El temporizador se desactiva mientras haya enemigos vivos. |
| **RF-9** | **Bucle de tensión:** si el jugador vuelve a eliminar a todos los enemigos reaparecidos, se **reinicia** otra ventana de 30 s. El ciclo "limpiar mapa → 30 s → recasteo" se repite indefinidamente hasta que el jugador alcance la puerta (RF-5). |
| **RF-10** | El reinicio de partida (`reset`/restart existente) debe **restaurar** el estado de la puerta y del temporizador a sus valores iniciales (sin nivel completado, sin cuenta atrás activa). |

### Flujo principal
1. El jugador entra al nivel; la puerta `'salida'` está en su celda fija (cian en minimapa, cian parpadeante en 3D).
2. El jugador puede combatir enemigos y/o buscar la puerta.
3. Si el jugador alcanza la celda de salida en cualquier momento → **victoria** (RF-5, RF-6). Fin.
4. Si el jugador elimina al último enemigo antes de llegar a la salida → arranca cuenta atrás de 30 s (RF-7).
5. Si llega a la salida dentro de esos 30 s → victoria.
6. Si la cuenta atrás expira → reaparecen enemigos (RF-8); volver al paso 2.

## 4. Business Logic & Constraints

- **Modelo de datos de la puerta:**
  - Nuevo valor de celda `2` en `plano` → `tipo: 'salida'` en `laberinto.mapa[f][c]`.
  - La celda `'salida'` es **única** y de posición **fija** (definida en `plano`).
  - A efectos de **colisión/movimiento**, `'salida'` se comporta como `'camino'` (transitable).
  - A efectos de **raycasting**, `'salida'` **sí** detiene el rayo (se dibuja como pared) pero con color cian parpadeante.
- **Estado de juego nuevo:** un indicador de "nivel completado" (p. ej. `nivelCompletado` booleano) análogo a `gameOver`, que pausa el loop y dispara el overlay.
- **Temporizador:**
  - Se mide en frames o en milisegundos reales equivalentes a **30 s**.
  - Solo está activo cuando `enemigos vivos === 0` y el nivel no está completado.
  - Se **cancela** en cuanto reaparecen enemigos (vuelve a haber vivos) y se **rearma** al volver a 0 enemigos.
- **Recasteo:** reutiliza la lógica/posición de spawn existente; cantidad = cantidad inicial del nivel; posiciones = celdas `'camino'` libres al azar (no sobre la celda del jugador ni sobre la salida).
- **Restricciones técnicas:** sin dependencias externas; todo en `motor.js` + `index.html`. Mantener estética retro (verde sobre negro, Courier New); el cian (`#00ffff`) es la única excepción cromática, reservada a la salida.
- **No-objetivos (fuera de alcance):** múltiples niveles encadenados, llaves para abrir la puerta, animación de apertura de puerta, puertas móviles, varias salidas.

## 5. Explicit Acceptance Criteria

- [ ] **AC-1** — `plano` admite el valor `2` y se traduce a `tipo: 'salida'` en `laberinto.mapa`; las celdas `1` siguen siendo `'pared'` y el resto `'camino'`.
- [ ] **AC-2** — Existe exactamente **una** celda `'salida'` en posición fija dentro del mapa.
- [ ] **AC-3** — El jugador **puede pisar** la celda de salida (no bloquea el movimiento como una pared).
- [ ] **AC-4** — En la vista 3D, la puerta se renderiza como pared **cian (`#00ffff`) con parpadeo** perceptible, distinta de las paredes verdes.
- [ ] **AC-5** — En el minimapa, la celda de salida aparece en **cian (`#00ffff`)**.
- [ ] **AC-6** — Al pisar la celda de salida se muestra el overlay **"¡NIVEL COMPLETADO!"** y el motor **se pausa** (jugador, enemigos y temporizador dejan de actualizarse).
- [ ] **AC-7** — Matar a todos los enemigos **no** completa el nivel; solo cruzar la puerta lo hace.
- [ ] **AC-8** — Al eliminar al **último enemigo**, arranca una cuenta atrás de **30 s** visible para el jugador.
- [ ] **AC-9** — Si la cuenta atrás llega a 0 sin victoria, **reaparece** la cantidad inicial de enemigos en celdas libres al azar, y la cuenta atrás se desactiva.
- [ ] **AC-10** — Tras volver a eliminar a todos los enemigos reaparecidos, se **reinicia** otra ventana de 30 s (bucle repetible).
- [ ] **AC-11** — Alcanzar la puerta durante la cuenta atrás (antes de que expire) completa el nivel correctamente.
- [ ] **AC-12** — El reinicio de partida restablece la puerta y el temporizador a su estado inicial (sin victoria, sin cuenta atrás activa, enemigos iniciales).
- [ ] **AC-13** — No se introducen dependencias externas; los cambios viven en `motor.js` (+ `index.html` si aplica) y respetan la estética retro.
