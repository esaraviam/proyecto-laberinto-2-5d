// IA y ciclo de vida de enemigos.
// Responsabilidades: línea de visión, selección de celda objetivo, movimiento/ataque,
// y spawn de refuerzo. Muta state.enemigos, state.playerHP, state.gameOver,
// state.enemyAttackTimer y state.damageFlashTimer directamente.

import {
    ENEMY_SPEED,
    ENEMY_CHASE_SPEED,
    ENEMY_CHASE_RANGE,
    ENEMY_MIN_DIST,
    ENEMY_DAMAGE,
    ENEMY_ATTACK_COOLDOWN,
    DAMAGE_FLASH_DURATION,
} from './constants.js';

import { state } from './state.js';
import { playDamage } from './audio.js';
import { celdasLibresLejanas } from './map.js';

// ---------------------------------------------------------------------------
// Visión
// ---------------------------------------------------------------------------

/**
 * Traza un rayo discreto entre dos puntos y devuelve true si no cruza ninguna
 * celda de tipo 'pared'. Usa muestreo de al menos 4 pasos, escalados por la
 * longitud del segmento en cada eje, para evitar saltar paredes delgadas.
 *
 * @param {number} x1
 * @param {number} y1
 * @param {number} x2
 * @param {number} y2
 * @returns {boolean}
 */
export function esLineaLibre(x1, y1, x2, y2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const steps = Math.max(Math.ceil(Math.abs(dx) * 10), Math.ceil(Math.abs(dy) * 10), 4);

    for (let i = 1; i < steps; i++) {
        const t = i / steps;
        const cx = Math.floor(x1 + dx * t);
        const cy = Math.floor(y1 + dy * t);

        const { filas, columnas, mapa } = state.laberinto;
        if (cy < 0 || cy >= filas || cx < 0 || cx >= columnas) return false;
        if (mapa[cy][cx].tipo === 'pared') return false;
    }

    return true;
}

// ---------------------------------------------------------------------------
// Patrulla
// ---------------------------------------------------------------------------

/**
 * Elige la próxima celda objetivo para un enemigo en modo patrulla.
 * Aplica anti-retroceso (no invierte lastDx/lastDy) salvo que sea el único
 * movimiento posible (callejón sin salida). Solo considera celdas 'camino'.
 *
 * @param {{ x:number, y:number, targetX:number, targetY:number,
 *            lastDx:number, lastDy:number, chasing:boolean }} e
 */
export function elegirSiguienteCelda(e) {
    const cc = Math.floor(e.x);
    const cr = Math.floor(e.y);
    const { filas, columnas, mapa } = state.laberinto;

    const dirs = [
        { dx: 1, dy: 0 },
        { dx: -1, dy: 0 },
        { dx: 0, dy: 1 },
        { dx: 0, dy: -1 },
    ];

    // Preferir celdas que no sean la dirección opuesta (anti-retroceso)
    let candidatos = dirs.filter(d => {
        if (d.dx === -e.lastDx && d.dy === -e.lastDy && (e.lastDx !== 0 || e.lastDy !== 0)) return false;
        const nc = cc + d.dx;
        const nr = cr + d.dy;
        return nr >= 0 && nr < filas &&
            nc >= 0 && nc < columnas &&
            mapa[nr][nc].tipo === 'camino';
    });

    // Callejón sin salida: permitir retroceso
    if (candidatos.length === 0) {
        candidatos = dirs.filter(d => {
            const nc = cc + d.dx;
            const nr = cr + d.dy;
            return nr >= 0 && nr < filas &&
                nc >= 0 && nc < columnas &&
                mapa[nr][nc].tipo === 'camino';
        });
    }

    if (candidatos.length > 0) {
        const dir = candidatos[Math.floor(Math.random() * candidatos.length)];
        e.targetX = cc + dir.dx + 0.5;
        e.targetY = cr + dir.dy + 0.5;
        e.lastDx = dir.dx;
        e.lastDy = dir.dy;
    }
}

// ---------------------------------------------------------------------------
// Actualización principal (llamada cada frame)
// ---------------------------------------------------------------------------

/**
 * Itera state.enemigos y aplica la máquina de estados chase/patrol/ataque.
 *
 * - Chase: enemigo en rango + línea de visión libre → se acerca al jugador.
 * - Ataque: enemigo dentro de ENEMY_MIN_DIST + visión → aplica ENEMY_DAMAGE
 *   sobre state.playerHP respetando el cooldown de state.enemyAttackTimer.
 *   Llama playDamage() y setea state.gameOver si playerHP cae a 0.
 * - Patrulla: mueve al enemigo hacia su targetX/targetY; al llegar elige celda nueva.
 */
export function actualizarEnemigos() {
    const { jugador, enemigos } = state;

    for (const e of enemigos) {
        const dxJ = jugador.x - e.x;
        const dyJ = jugador.y - e.y;
        const distToPlayer = Math.sqrt(dxJ * dxJ + dyJ * dyJ);

        if (distToPlayer < ENEMY_CHASE_RANGE && distToPlayer > ENEMY_MIN_DIST && esLineaLibre(e.x, e.y, jugador.x, jugador.y)) {
            // Modo persecución — acercarse sin sobrepasar ENEMY_MIN_DIST
            e.chasing = true;
            e.x += (dxJ / distToPlayer) * ENEMY_CHASE_SPEED;
            e.y += (dyJ / distToPlayer) * ENEMY_CHASE_SPEED;
        } else if (distToPlayer <= ENEMY_MIN_DIST && esLineaLibre(e.x, e.y, jugador.x, jugador.y)) {
            // Modo ataque — dañar al jugador en cada ciclo de cooldown
            e.chasing = true;

            if (state.enemyAttackTimer <= 0) {
                state.playerHP = Math.max(0, state.playerHP - ENEMY_DAMAGE);
                state.damageFlashTimer = DAMAGE_FLASH_DURATION;
                state.enemyAttackTimer = ENEMY_ATTACK_COOLDOWN;
                playDamage();

                if (state.playerHP <= 0) {
                    state.gameOver = true;
                }
            }
        } else {
            // Modo patrulla — seguir la ruta hacia targetX/targetY
            e.chasing = false;

            const dx = e.targetX - e.x;
            const dy = e.targetY - e.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist <= 0.04) {
                // Llegó a la celda objetivo — elegir la siguiente
                e.x = e.targetX;
                e.y = e.targetY;
                elegirSiguienteCelda(e);
            } else {
                e.x += (dx / dist) * ENEMY_SPEED;
                e.y += (dy / dist) * ENEMY_SPEED;
            }
        }
    }
}

// ---------------------------------------------------------------------------
// Spawn de refuerzo
// ---------------------------------------------------------------------------

/**
 * Añade n enemigos nuevos en celdas 'camino' lejanas al jugador.
 * La cota Math.min(n, libres.length) garantiza que nunca se intentará acceder
 * a una posición inexistente en el array (constraint de seguridad).
 *
 * @param {number} n - Número de enemigos deseados
 */
export function reaparecerEnemigos(n) {
    const { jugador, enemigos } = state;
    const libres = celdasLibresLejanas(jugador.x, jugador.y, 3);
    const efectivos = Math.min(n, libres.length);

    for (let i = 0; i < efectivos; i++) {
        const pos = libres[i];
        enemigos.push({
            x: pos.x,
            y: pos.y,
            targetX: pos.x,
            targetY: pos.y,
            lastDx: 0,
            lastDy: 0,
            chasing: false,
        });
    }
}
