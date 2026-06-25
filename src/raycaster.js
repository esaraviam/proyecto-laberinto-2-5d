// Módulo de raycasting DDA para el motor 2.5D.
// Exporta dos buffers mutables (zBuffer, rayCache) que renderer.js llena cada frame,
// y lanzarRayoDDA que ejecuta el algoritmo DDA puro leyendo state.jugador y state.laberinto.
// Los buffers son los mismos objetos durante toda la vida de la aplicación — no se recrean.

import { ANCHO_3D, RENDER_DIST } from './constants.js';
import { state } from './state.js';

// Distancias perpendiculares por columna de pantalla.
// Llenado por renderer.js durante renderizar3D; consumido por renderizarEnemigos/Items.
export const zBuffer = new Float64Array(ANCHO_3D);

// Rayos lanzados en el último frame: [{angulo, dist}, ...].
// Llenado por renderer.js; consumido por renderizarMinimapa.
export const rayCache = [];

// Lanza un rayo DDA desde la posición del jugador en la dirección anguloRayo.
// Retorna { dist, u, side, tipo }:
//   dist — distancia perpendicular a la pared impactada
//   u    — coordenada horizontal de textura en [0, 1)
//   side — 0 si la cara impactada es X (N/S), 1 si es Y (E/W)
//   tipo — tipo de celda impactada ('pared' | 'salida')
export function lanzarRayoDDA(anguloRayo) {
    const jugador   = state.jugador;
    const laberinto = state.laberinto;

    const dirX = Math.cos(anguloRayo);
    const dirY = Math.sin(anguloRayo);

    let mapX = Math.floor(jugador.x);
    let mapY = Math.floor(jugador.y);

    // Distancia que el rayo recorre entre celdas consecutivas en cada eje.
    // El OR evita división por cero cuando dirX o dirY son exactamente 0.
    const deltaDistX = Math.abs(1 / (dirX || 1e-10));
    const deltaDistY = Math.abs(1 / (dirY || 1e-10));

    let stepX, stepY, sideDistX, sideDistY;

    if (dirX < 0) {
        stepX    = -1;
        sideDistX = (jugador.x - mapX) * deltaDistX;
    } else {
        stepX    = 1;
        sideDistX = (mapX + 1 - jugador.x) * deltaDistX;
    }

    if (dirY < 0) {
        stepY    = -1;
        sideDistY = (jugador.y - mapY) * deltaDistY;
    } else {
        stepY    = 1;
        sideDistY = (mapY + 1 - jugador.y) * deltaDistY;
    }

    let side = 0;
    let hit  = false;

    while (!hit) {
        if (sideDistX < sideDistY) {
            sideDistX += deltaDistX;
            mapX      += stepX;
            side       = 0;
        } else {
            sideDistY += deltaDistY;
            mapY      += stepY;
            side       = 1;
        }

        // Rayo fuera del mapa — devolver distancia máxima sin tipo de celda.
        if (mapY < 0 || mapY >= laberinto.filas || mapX < 0 || mapX >= laberinto.columnas) {
            return { dist: RENDER_DIST, u: 0, side: 0 };
        }

        const tipoCelda = laberinto.mapa[mapY][mapX].tipo;
        if (tipoCelda === 'pared' || tipoCelda === 'salida') {
            hit = true;
        }
    }

    // Distancia perpendicular (corrección de ojo de pez).
    const perpDist = side === 0
        ? (mapX - jugador.x + (1 - stepX) / 2) / dirX
        : (mapY - jugador.y + (1 - stepY) / 2) / dirY;

    // Coordenada de textura u: fracción del punto de impacto dentro de la celda.
    let wallX;
    if (side === 0) {
        wallX = jugador.y + perpDist * dirY;
    } else {
        wallX = jugador.x + perpDist * dirX;
    }
    wallX -= Math.floor(wallX);

    return { dist: perpDist, u: wallX, side, tipo: laberinto.mapa[mapY][mapX].tipo };
}
