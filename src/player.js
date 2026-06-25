// src/player.js — Movimiento del jugador y detección de colisiones
//
// Responsabilidades:
//   esCamino   — predicado puro: ¿es (x, y) una celda transitable?
//   procesarMovimiento — muta state.jugador cada frame según input;
//                        aplica wall-sliding independiente en X e Y.

import {
    PLAYER_MOVE_SPEED,
    PLAYER_ROT_SPEED,
    PLAYER_COLLISION_RADIUS,
} from './constants.js';
import { state } from './state.js';
import { teclasPresionadas } from './input.js';

// Devuelve true si la celda que contiene el punto (x, y) es transitable.
// "Transitable" abarca camino normal y la celda de salida del laberinto.
// Cualquier coordenada fuera de los límites del mapa se considera pared.
export function esCamino(x, y) {
    const fy = Math.floor(y);
    const fx = Math.floor(x);
    if (fy < 0 || fy >= state.laberinto.filas ||
        fx < 0 || fx >= state.laberinto.columnas) {
        return false;
    }
    const tipo = state.laberinto.mapa[fy][fx].tipo;
    return tipo === 'camino' || tipo === 'salida';
}

// Aplica rotación y traslación al jugador según las teclas activas.
// Wall-sliding: cada eje se prueba por separado, lo que permite deslizarse
// a lo largo de una pared sin detenerse por completo al rozarla en diagonal.
export function procesarMovimiento() {
    let { x, y, angulo } = state.jugador;

    if (teclasPresionadas.has('ArrowLeft'))  angulo -= PLAYER_ROT_SPEED;
    if (teclasPresionadas.has('ArrowRight')) angulo += PLAYER_ROT_SPEED;

    const dx = Math.cos(angulo);
    const dy = Math.sin(angulo);
    const r  = PLAYER_COLLISION_RADIUS;

    if (teclasPresionadas.has('ArrowUp')) {
        const nx = x + dx * PLAYER_MOVE_SPEED;
        const ny = y + dy * PLAYER_MOVE_SPEED;

        // Prueba el eje X de forma independiente (4 puntos de colisión)
        if (esCamino(nx + r, y + r) && esCamino(nx - r, y + r) &&
            esCamino(nx + r, y - r) && esCamino(nx - r, y - r)) {
            x = nx;
        }
        // Prueba el eje Y de forma independiente (4 puntos de colisión)
        if (esCamino(x + r, ny + r) && esCamino(x - r, ny + r) &&
            esCamino(x + r, ny - r) && esCamino(x - r, ny - r)) {
            y = ny;
        }
    }

    if (teclasPresionadas.has('ArrowDown')) {
        const nx = x - dx * PLAYER_MOVE_SPEED;
        const ny = y - dy * PLAYER_MOVE_SPEED;

        // Prueba el eje X de forma independiente (4 puntos de colisión)
        if (esCamino(nx + r, y + r) && esCamino(nx - r, y + r) &&
            esCamino(nx + r, y - r) && esCamino(nx - r, y - r)) {
            x = nx;
        }
        // Prueba el eje Y de forma independiente (4 puntos de colisión)
        if (esCamino(x + r, ny + r) && esCamino(x - r, ny + r) &&
            esCamino(x + r, ny - r) && esCamino(x - r, ny - r)) {
            y = ny;
        }
    }

    state.jugador = { x, y, angulo };
}
