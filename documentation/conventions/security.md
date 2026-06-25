# Security Constraints — Puerta de Salida (ai-security-expert)

## Security Report

### Contexto / Superficie de ataque
Juego de laberinto raycasting **100% client-side** (vanilla JS, Canvas 2D), sin backend, sin
peticiones de red, sin `localStorage`/cookies, sin `eval`/`Function`, sin `innerHTML`. Única entrada:
eventos de teclado (`Arrow*`, `R`, espacio). La feature añade lógica de juego (tipo de celda, BFS,
temporizador, reaparición, dibujo en canvas). **No introduce ninguna superficie de ataque nueva.**

### Findings
- **[LOW]** Potencial bucle/DoS local en `colocarSalida()` (BFS) o `reaparecerEnemigos()` si se itera
  sin cota sobre estructuras vacías o se cae en bucle infinito (p. ej. buscar celdas libres cuando no
  quedan). Solo afecta a la pestaña del propio usuario.
- **[LOW]** Lectura de celda fuera de rango (`laberinto.mapa[f][c]`) si los índices del BFS/colocación
  no se validan contra `filas/columnas` → excepción que congela el render. Robustez, no seguridad.
- **[LOW]** `performance.now()` como reloj del temporizador es monotónico y no manipulable por entrada
  externa; sin riesgo. (Nota: no usar `Date.now()`, que sí salta con cambios de hora del sistema.)
- **[INFO]** No hay datos sensibles, autenticación, ni multijugador → sin riesgos de
  confidencialidad/integridad de datos.

### Impact
En el peor caso, un bug de cota/índice **cuelga la pestaña del propio jugador** (auto-DoS local). No
hay impacto sobre terceros, datos, ni el sistema host. Severidad agregada: **LOW**.

### Recommendations (constraints de obligado cumplimiento para implementación)
1. **Cotas explícitas en bucles**: el BFS de `colocarSalida()` debe marcar celdas visitadas y no
   reencolar; `reaparecerEnemigos(n)` debe acotar `n` a la cantidad de celdas libres disponibles
   (`Math.min(n, libres.length)`), sin `while(true)` sin salida.
2. **Validación de índices**: toda lectura `laberinto.mapa[f][c]` en código nuevo comprueba
   `0 <= f < filas` y `0 <= c < columnas` (el patrón ya existe en `esCamino`, línea 1303 — reutilizar).
3. **Reloj monotónico**: usar `performance.now()` para el temporizador (ya especificado en
   `conventions.md`); prohibido `Date.now()`.
4. **Sin nuevas APIs peligrosas**: la feature no debe introducir `eval`, `Function`, `innerHTML`,
   `fetch`, `WebSocket`, ni acceso a `localStorage`. Si una tarea lo necesitara, **ABORTAR y reportar**.
5. **CSP-friendly**: mantener todo el JS en `motor.js` (sin `<script>` inline nuevo en `index.html` que
   complique una eventual Content-Security-Policy).

### Implementation Plan
- Asignado a la capa **frontend/motor** (`motor.js`): incorporar las cotas e índices validados en
  `colocarSalida`, `reaparecerEnemigos`, `gestionarTemporizador`. Sin trabajo de backend/AI.

### Status
Secured — **No blocking directives.** Riesgo residual LOW (robustez local). La implementación puede
proceder respetando las 5 constraints anteriores; QA debe verificarlas como criterios de robustez.
