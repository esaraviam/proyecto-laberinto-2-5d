# Convenciones de Implementación — Laberinto 2.5D

> **Leer este archivo PRIMERO** (estrategia de prompt-caching SDD). Aplica a todas las tareas de la
> feature `puerta_salida`. Luego leer únicamente la sección de arquitectura asignada en la tarea.

## Estructura del proyecto
- Todo el motor vive en **`motor.js`** (IIFE único, 1381 líneas) + **`index.html`**. **Sin
  dependencias externas, sin frameworks, sin build step.** Vanilla JS + Canvas 2D.
- No se crean archivos JS nuevos. Toda la lógica de esta feature se integra en `motor.js`.

## Estilo de código
- Indentación 4 espacios; `const`/`let` (nunca `var`); funciones nombradas dentro del IIFE.
- Nombres de dominio en **español** (`jugador`, `laberinto`, `enemigos`, `colocarSalida`,
  `reaparecerEnemigos`) — coherente con el código existente.
- Constantes en `UPPER_SNAKE_CASE` declaradas al inicio del IIFE (junto a las existentes, líneas 7–38).
- Variables de estado mutable declaradas en el bloque de estado (≈ líneas 339–349).

## Reglas de la feature (de obligado cumplimiento)
1. **Tipo `'salida'`**: transitable para colisión (`esCamino`), **opaca** para el rayo (`lanzarRayoDDA`).
2. **Colocación procedural**: la salida se elige por **BFS de celda más lejana** del spawn (ADR-001 en
   `db_puerta_salida.md`). Prohibido hardcodear coordenadas.
3. **Temporizador en tiempo real**: usar `performance.now()` y `TIEMPO_BUSQUEDA_MS=30000`. **Prohibido**
   contar frames de `requestAnimationFrame` (FPS no garantizado).
4. **No duplicar lógica de spawn**: extraer el spawn de enemigos inlined en `inicializar()` a un helper
   reutilizable consumido por `inicializar()` y `reaparecerEnemigos()` (DRY).
5. **Victoria única**: solo pisar la celda de salida completa el nivel. Matar enemigos NO gana.
6. **Eliminar** el bloque `'¡ZONA DESPEJADA!'` (≈ líneas 1133–1145): queda obsoleto.
7. **Reset total**: `inicializar()` debe restablecer TODO el estado nuevo (`nivelCompletado`,
   `temporizadorActivo`, `temporizadorFinMs`) para que `[R]` deje el juego limpio.
8. **Paleta**: cian `#00ffff` / `[0,255,255]` reservado EXCLUSIVAMENTE a la salida. No tocar el resto
   de la estética verde.

## Integración en el bucle
- `verificarVictoria()` y `gestionarTemporizador()` se invocan en `buclePrincipal()` solo en juego
  activo (no en `gameOver`/`nivelCompletado`).
- `nivelCompletado` se comporta como `gameOver` a efectos de pausa (render sí, update no).
- Orden de evaluación: `gameOver` antes que victoria (la victoria solo se setea si `!gameOver`).

## Pruebas / validación
- No hay framework de tests. **Validación = lint sintáctico + ejecución manual en navegador.**
- Comando de lint obligatorio por tarea de código:
  `node --check motor.js`  → debe salir con código 0 (sin errores de sintaxis).
- Validación funcional (manual, documentar en el reporte): cargar `index.html`, comprobar el
  criterio de aceptación correspondiente.

## Convenciones de seguridad
Ver `documentation/conventions/security.md` (constraints del `ai-security-expert`).

## Límite de alcance por tarea
Cada tarea solo edita los archivos de su `file_scope`. Si necesita tocar algo fuera, **ABORTA y
repórtalo** — nunca edites fuera de alcance. (En la práctica casi todo es `motor.js`, por lo que las
tareas sobre `motor.js` se serializan en oleadas distintas para evitar colisiones.)
