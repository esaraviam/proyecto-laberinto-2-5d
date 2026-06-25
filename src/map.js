// Generación del laberinto por DFS-backtracker y colocación de la salida.
// Lee y escribe state.laberinto para colocarSalida y celdasLibresLejanas.

import { SALIDA_COLOR } from './constants.js'; // eslint-disable-line no-unused-vars — consumido por renderer
import { state } from './state.js';

// =========================================================================
// GENERACIÓN DEL LABERINTO
// =========================================================================

/**
 * Genera un laberinto perfecto mediante DFS-backtracker iterativo.
 * Función pura: no toca state. El caller es responsable de asignar el
 * resultado a state.laberinto después de convertir el grid a objetos celda.
 *
 * @param {number} filasCeldas  Número de celdas lógicas en eje Y.
 * @param {number} colsCeldas   Número de celdas lógicas en eje X.
 * @returns {{ grid: number[][], filas: number, cols: number }}
 *          grid[f][c] === 0 → pasillo; 1 → muro.
 */
export function generarMapa(filasCeldas, colsCeldas) {
    const filas = filasCeldas * 2 + 1;
    const cols = colsCeldas * 2 + 1;
    const grid = Array.from({ length: filas }, () => new Array(cols).fill(1));
    const vis = Array.from({ length: filasCeldas }, () => new Array(colsCeldas).fill(false));
    const pila = [[0, 0]];
    vis[0][0] = true;
    grid[1][1] = 0;

    const dirs = [{ dr: -1, dc: 0 }, { dr: 1, dc: 0 }, { dr: 0, dc: -1 }, { dr: 0, dc: 1 }];

    while (pila.length > 0) {
        const [r, c] = pila[pila.length - 1];
        const vecinos = dirs
            .map(d => ({ nr: r + d.dr, nc: c + d.dc, dr: d.dr, dc: d.dc }))
            .filter(v =>
                v.nr >= 0 && v.nr < filasCeldas &&
                v.nc >= 0 && v.nc < colsCeldas &&
                !vis[v.nr][v.nc]
            );

        if (vecinos.length > 0) {
            const v = vecinos[Math.floor(Math.random() * vecinos.length)];
            grid[r * 2 + 1 + v.dr][c * 2 + 1 + v.dc] = 0;
            grid[v.nr * 2 + 1][v.nc * 2 + 1] = 0;
            vis[v.nr][v.nc] = true;
            pila.push([v.nr, v.nc]);
        } else {
            pila.pop();
        }
    }

    return { grid, filas, cols };
}

// =========================================================================
// COLOCACIÓN DE LA SALIDA
// =========================================================================

/**
 * Realiza un BFS de 4-direcciones desde la celda de spawn (1,1) sobre el
 * grafo de celdas transitables. La celda 'camino' con mayor distancia BFS
 * se convierte en 'salida' y su posición queda escrita en state.laberinto.salida.
 *
 * Pre:  state.laberinto.mapa ya generado; spawn del jugador en celda (fila 1, col 1).
 * Post: state.laberinto.mapa[salidaF][salidaC].tipo === 'salida';
 *       state.laberinto.salida === { f: salidaF, c: salidaC }.
 */
export function colocarSalida() {
    const { mapa, filas, columnas } = state.laberinto;
    const DIRS = [[-1, 0], [1, 0], [0, -1], [0, 1]];

    // dist[f][c] = pasos BFS desde (1,1); -1 significa no visitado
    const dist = Array.from({ length: filas }, () =>
        new Array(columnas).fill(-1)
    );

    const cola = [];
    dist[1][1] = 0;
    cola.push([1, 1]);

    let cabeza = 0;
    let maxDist = -1;
    let salidaF = 1;
    let salidaC = 1; // nunca coincide con spawn porque maxDist parte en -1

    while (cabeza < cola.length) {
        const [f, c] = cola[cabeza++];
        const d = dist[f][c];

        // Candidato a salida: cualquier 'camino' distinto del spawn, con mayor distancia
        if ((f !== 1 || c !== 1) && mapa[f][c].tipo === 'camino' && d > maxDist) {
            maxDist = d;
            salidaF = f;
            salidaC = c;
        }

        for (const [df, dc] of DIRS) {
            const nf = f + df;
            const nc = c + dc;

            // Validación de índices en cada paso del BFS
            if (nf < 0 || nf >= filas || nc < 0 || nc >= columnas) continue;
            if (dist[nf][nc] !== -1) continue;

            const tipo = mapa[nf][nc].tipo;
            if (tipo !== 'camino' && tipo !== 'salida') continue;

            dist[nf][nc] = d + 1;
            cola.push([nf, nc]);
        }
    }

    mapa[salidaF][salidaC].tipo = 'salida';
    state.laberinto.salida = { f: salidaF, c: salidaC };
}

// =========================================================================
// CONSULTA DE CELDAS LIBRES
// =========================================================================

/**
 * Devuelve un array barajado (Fisher-Yates) de posiciones {x, y} (centro de celda)
 * correspondientes a todas las celdas 'camino' del laberinto actual que se
 * encuentran a distancia euclidiana estrictamente mayor que minDist del punto (posX, posY).
 *
 * Pre:  state.laberinto inicializado.
 *
 * @param {number} posX     Coordenada X de referencia (unidades de celda).
 * @param {number} posY     Coordenada Y de referencia (unidades de celda).
 * @param {number} minDist  Umbral mínimo de distancia (exclusivo).
 * @returns {{ x: number, y: number }[]}
 */
export function celdasLibresLejanas(posX, posY, minDist) {
    const { mapa, filas, columnas } = state.laberinto;
    const resultado = [];

    for (let f = 1; f < filas - 1; f++) {
        for (let c = 1; c < columnas - 1; c++) {
            if (mapa[f][c].tipo === 'camino') {
                const px = c + 0.5;
                const py = f + 0.5;
                if (Math.hypot(px - posX, py - posY) > minDist) {
                    resultado.push({ x: px, y: py });
                }
            }
        }
    }

    // Fisher-Yates in-place shuffle para distribución uniforme
    for (let i = resultado.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [resultado[i], resultado[j]] = [resultado[j], resultado[i]];
    }

    return resultado;
}
