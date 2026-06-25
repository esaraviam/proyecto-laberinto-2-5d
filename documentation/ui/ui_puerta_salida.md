# UI/UX Contract — Puerta de Salida

> Canvas único `#pantallaDoom` (960×480). Layout: 0–640px vista 3D, 640–960px minimapa.
> Estética retro: verde `#00ff00` sobre negro, Courier New. **El cian `#00ffff` es la única
> excepción cromática y queda reservado a la salida.**

---

## 1. Inventario de elementos visuales

| Elemento | Dónde | Estado que lo activa | Contrato visual |
|----------|-------|----------------------|-----------------|
| **Portal 3D** | vista 3D | rayo impacta `tipo==='salida'` | columna en cian pulsante (RF-3, AC-4) |
| **Celda salida minimapa** | minimapa | siempre | celda `#00ffff` (RF-4, AC-5) |
| **Cuenta atrás** | HUD (vista 3D) | `temporizadorActivo` | texto MM:SS / segundos restantes (RF-7, AC-8) |
| **Overlay victoria** | vista 3D | `nivelCompletado` | "¡NIVEL COMPLETADO!" + pausa (RF-6, AC-6) |
| ~~"¡ZONA DESPEJADA!"~~ | HUD | ~~`enemigos.length===0`~~ | **ELIMINAR** (obsoleto, AC-7) |

## 2. Portal en vista 3D (`renderizar3D`)

- **Disparador:** `resultado.tipo === 'salida'` en el loop de columnas.
- **Color base:** cian `[0, 255, 255]`.
- **Parpadeo (pulso):** modular el brillo con el tiempo real:
  `brillo = 0.55 + 0.45 * (0.5 + 0.5*sin(performance.now() * 0.001 * 2π * SALIDA_PULSO_HZ))`.
- **Sombreado por distancia:** mantener el mismo factor `shade` (`distancia/SHADE_DIVISOR + faceDarken`)
  que los muros normales, aplicado **sobre** el cian (coherencia de profundidad).
- **Resultado:** `r=0`, `g = 255*brillo*(1-shade)`, `b = 255*brillo*(1-shade)` (cian que late y se
  oscurece con la distancia). No usa la textura de muro.
- **Coherencia:** se respeta `wallTop`/`wallBot`/`alturaPared` igual que un muro (es opaco al rayo).

## 3. Celda de salida en minimapa (`renderizarMinimapa`)

- En el doble bucle de celdas (≈ línea 1210), extender el color:
  `tipo==='pared' → '#004400'`, `tipo==='salida' → '#00ffff'`, resto `'#111'`.
- Opcional (recomendado, no bloqueante): leve pulso de `globalAlpha` como hacen los items, para que
  destaque como objetivo. Si se omite, basta el cian fijo.

## 4. Indicador de cuenta atrás (HUD)

- **Visible solo si** `temporizadorActivo`.
- **Contenido:** segundos restantes = `Math.ceil((temporizadorFinMs - performance.now())/1000)`,
  clamp a `[0, 30]`. Formato sugerido: `BUSCA LA SALIDA: 23s`.
- **Posición:** banda superior-centro de la vista 3D (no debe solaparse con HP arriba-derecha ni con
  los contadores arriba-izquierda).
- **Color:** verde `#00ff00`; cuando `restante <= 5`, **rojo `#ff3300`** + énfasis (parpadeo opcional)
  para señalar urgencia inminente del recasteo.
- **Caja:** fondo `rgba(0,0,0,0.55)` + borde fino, consistente con las cajas de HUD existentes.

## 5. Overlay de victoria (`renderizarHUD`)

- **Disparador:** `nivelCompletado === true`. Patrón **idéntico** al overlay de `gameOver` (≈ líneas
  1119–1130) pero en clave de victoria:
  - Velo `rgba(0,0,0,0.7)` a pantalla 3D completa.
  - Título `¡NIVEL COMPLETADO!` en **verde `#00ff00`**, `bold 36px Courier New`, centrado, `MITAD_ALTO - 18`.
  - Subtítulo `Kills: ${kills}  |  [R] para jugar de nuevo` en `#ffcc00`, `bold 16px`, `MITAD_ALTO + 20`.
  - `return` temprano (no dibujar HUD de juego), igual que `gameOver`.
- **Pausa:** garantizada por `buclePrincipal` (no se actualiza jugador/enemigos cuando `nivelCompletado`).

## 6. Jerarquía de overlays (precedencia)

```
nivelCompletado  >  gameOver  >  (HUD de juego: HP, enemigos, kills, arma, cuenta atrás)
```
Solo un overlay de fin a la vez. Si por carrera ambos fueran true, **victoria** no debe pisar una
muerte previa: `gameOver` se evalúa primero en el bucle (la victoria solo se setea si `!gameOver`).

## 7. Controles
Sin teclas nuevas. `[R]` (ya existente, ≈ línea 1288) reinicia desde victoria, muerte o juego — al
llamar `inicializar()` que ya resetea todo el estado nuevo.

## 8. Criterios de aceptación UI cubiertos
AC-4 (portal cian pulsante), AC-5 (minimapa cian), AC-6 (overlay victoria + pausa), AC-7 (sin
pseudo-victoria por limpiar), AC-8 (cuenta atrás visible).
