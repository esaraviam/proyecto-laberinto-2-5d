// Módulo coordinador: bucle principal, inicialización de nivel, disparo y
// condición de victoria/temporizador. No declara estado propio — todo vive
// en state.js. La responsabilidad de cada sistema (render, física, IA) se
// delega al módulo especializado correspondiente.

import {
    ANCHO_3D,
    ALTO,
    FOV,
    PLAYER_MAX_HP,
    COOLDOWN_DISPARO,
    COOLDOWN_AMETRALLADORA,
    MUZZLE_FLASH_DURATION,
    HIT_MARKER_DURATION,
    SALUD_ITEMS_MAX,
    SPRITE_CORRECTION_NEAR,
    TIEMPO_BUSQUEDA_MS,
} from './constants.js';

import { state } from './state.js';

import { playHit, playShoot } from './audio.js';

import { generarMapa, colocarSalida, celdasLibresLejanas } from './map.js';

import { zBuffer } from './raycaster.js';

import { procesarMovimiento } from './player.js';

import { actualizarEnemigos, reaparecerEnemigos } from './enemies.js';

import { verificarPickups } from './items.js';

import {
    renderizar3D,
    renderizarEnemigos,
    renderizarItems,
    renderizarMira,
    renderizarHUD,
    renderizarMinimapa,
} from './renderer.js';

// =========================================================================
// INICIALIZACIÓN
// =========================================================================

/**
 * Resetea el estado completo de la partida, genera un nuevo laberinto y
 * coloca todos los actores (jugador, enemigos, ítems).
 *
 * El orden es estricto:
 *   1. Reset de state — nunca parte de un estado sucio.
 *   2. Generación del mapa — produce el grid de celdas.
 *   3. colocarSalida() — BFS que convierte la celda más lejana en 'salida'.
 *   4. Spawn del jugador — posición fija (1.5, 1.5) para que el BFS parta del
 *      mismo punto que el jugador.
 *   5. Spawn de enemigos e ítems sobre celdas libres lejanas.
 */
export function inicializar() {
    // --- Reset total de estado ---
    state.kills = 0;
    state.playerHP = PLAYER_MAX_HP;
    state.cooldownDisparo = 0;
    state.muzzleFlashTimer = 0;
    state.hitMarkerTimer = 0;
    state.damageFlashTimer = 0;
    state.enemyAttackTimer = 0;
    state.gameOver = false;
    state.nivelCompletado = false;
    state.tieneAmetralladora = false;
    state.temporizadorActivo = false;
    state.temporizadorFinMs = 0;
    state.items = [];
    state.enemigos = [];
    state.numEnemigosInicial = 0;

    // --- Generación del laberinto ---
    const CELDAS_F = 4 + Math.floor(Math.random() * 4);
    const CELDAS_C = 7 + Math.floor(Math.random() * 5);

    const { grid, filas, cols } = generarMapa(CELDAS_F, CELDAS_C);

    state.laberinto = {
        mapa: grid.map((fila, f) =>
            fila.map((valor, c) => ({ f, c, tipo: valor === 1 ? 'pared' : 'camino' }))
        ),
        filas,
        columnas: cols,
        salida: null,
    };

    // Colocar la salida ANTES de calcular celdas libres: BFS desde spawn marca
    // la celda más lejana como 'salida', por lo que celdasLibresLejanas
    // (que filtra tipo === 'camino') la excluirá del pool de spawn.
    colocarSalida();

    // --- Spawn del jugador ---
    state.jugador = { x: 1.5, y: 1.5, angulo: 0 };

    // --- Celdas disponibles para actores ---
    const libres = celdasLibresLejanas(state.jugador.x, state.jugador.y, 3);

    // Enemigos iniciales: máximo 5
    const N = Math.min(5, libres.length);
    state.numEnemigosInicial = N;
    state.enemigos = libres.slice(0, N).map(pos => ({
        ...pos,
        targetX: pos.x,
        targetY: pos.y,
        lastDx: 0,
        lastDy: 0,
        chasing: false,
    }));

    // Ítems: primero salud (hasta SALUD_ITEMS_MAX), luego ametralladora
    const restantes = libres.slice(N);
    const numSalud = Math.min(SALUD_ITEMS_MAX, restantes.length);

    for (let i = 0; i < numSalud; i++) {
        const pos = restantes[i];
        state.items.push({ x: pos.x, y: pos.y, tipo: 'salud', activo: true });
    }

    if (restantes.length > numSalud) {
        const pos = restantes[numSalud];
        state.items.push({ x: pos.x, y: pos.y, tipo: 'ametralladora', activo: true });
    }
}

// =========================================================================
// CONDICIÓN DE VICTORIA
// =========================================================================

/**
 * Comprueba si el jugador ocupa la celda de salida.
 * Solo actúa si la partida está activa (ni muerto ni ya completado).
 * Detiene también el temporizador de búsqueda al alcanzar la salida.
 */
function verificarVictoria() {
    if (state.gameOver || state.nivelCompletado) return;

    if (
        Math.floor(state.jugador.y) === state.laberinto.salida.f &&
        Math.floor(state.jugador.x) === state.laberinto.salida.c
    ) {
        state.nivelCompletado = true;
        state.temporizadorActivo = false;
    }
}

// =========================================================================
// TEMPORIZADOR DE BÚSQUEDA
// =========================================================================

/**
 * Máquina de estados del temporizador de búsqueda.
 * Orden de evaluación estricto:
 *   1. No-op si la partida está resuelta.
 *   2. Arrancar cuenta atrás cuando no quedan enemigos.
 *   3. Hacer reaparecer enemigos al expirar el temporizador.
 *
 * Usa performance.now() — tiempo real independiente del FPS.
 * Date.now() está prohibido por convención del proyecto.
 */
function gestionarTemporizador() {
    if (state.nivelCompletado || state.gameOver) return;

    if (state.enemigos.length === 0 && !state.temporizadorActivo && !state.nivelCompletado) {
        state.temporizadorActivo = true;
        state.temporizadorFinMs = performance.now() + TIEMPO_BUSQUEDA_MS;
        return;
    }

    if (state.temporizadorActivo && performance.now() >= state.temporizadorFinMs) {
        reaparecerEnemigos(state.numEnemigosInicial);
        state.temporizadorActivo = false;
    }
}

// =========================================================================
// DISPARO
// =========================================================================

/**
 * Procesa un disparo desde el centro de la pantalla.
 *
 * Flujo:
 *   1. Guardia de cooldown.
 *   2. Armar timers de cooldown y muzzle flash; reproducir sonido de disparo.
 *   3. Leer zBuffer en la columna central para saber la distancia de la pared.
 *   4. Ordenar enemigos por distancia (hit al más cercano primero).
 *   5. Para cada candidato: verificar FOV, z-check frente a pared y frente al
 *      clipping near, calcular posición del sprite en pantalla y comprobar que
 *      la columna central caiga dentro del cuerpo del sprite.
 *   6. Si impacta: splice del enemigo, incrementar kills, activar hit marker y
 *      reproducir sonido de impacto.
 */
export function disparar() {
    if (state.cooldownDisparo > 0) return;

    state.cooldownDisparo = state.tieneAmetralladora
        ? COOLDOWN_AMETRALLADORA
        : COOLDOWN_DISPARO;
    state.muzzleFlashTimer = MUZZLE_FLASH_DURATION;
    playShoot();

    const colCentro = Math.floor(ANCHO_3D / 2);
    const distPared = zBuffer[colCentro];

    // Ordenar por distancia para garantizar hit al enemigo más cercano
    const candidatos = state.enemigos
        .map((e, idx) => ({
            e,
            idx,
            dist: Math.hypot(e.x - state.jugador.x, e.y - state.jugador.y),
        }))
        .sort((a, b) => a.dist - b.dist);

    for (const { e, idx } of candidatos) {
        const dx = e.x - state.jugador.x;
        const dy = e.y - state.jugador.y;
        const distSprite = Math.sqrt(dx * dx + dy * dy);

        let deltaAngulo = Math.atan2(dy, dx) - state.jugador.angulo;
        while (deltaAngulo > Math.PI) deltaAngulo -= 2 * Math.PI;
        while (deltaAngulo < -Math.PI) deltaAngulo += 2 * Math.PI;

        // Fuera del campo de visión
        if (Math.abs(deltaAngulo) > FOV) continue;

        const distCorr = distSprite * Math.cos(deltaAngulo);

        // Detrás de una pared o demasiado cerca del near-clip
        if (distCorr >= distPared || distCorr <= SPRITE_CORRECTION_NEAR) continue;

        // Proyección del sprite en pantalla
        const xCentro = Math.floor((0.5 + deltaAngulo / FOV) * ANCHO_3D);
        const altSprite = Math.min(ALTO * 2, Math.floor(ALTO / distCorr));
        const anchoSprite = Math.floor(altSprite * 0.5);
        const startX = xCentro - Math.floor(anchoSprite / 2);
        const endX = xCentro + Math.floor(anchoSprite / 2);
        const tc = (colCentro - startX) / anchoSprite;

        // La columna central debe caer dentro del cuerpo del sprite (márgenes 8 % / 92 %)
        if (colCentro >= startX && colCentro < endX && tc >= 0.08 && tc <= 0.92) {
            state.enemigos.splice(idx, 1);
            state.kills++;
            state.hitMarkerTimer = HIT_MARKER_DURATION;
            playHit();
            break;
        }
    }
}

// =========================================================================
// BUCLE PRINCIPAL
// =========================================================================

/**
 * Game loop de 60 fps (vía requestAnimationFrame).
 *
 * Decrementa los 5 timers de frame-countdown antes de cualquier lógica para
 * garantizar que expiran en el frame correcto independientemente del orden de
 * llamada interno.
 *
 * Cuando la partida está resuelta (victoria o muerte) solo se renderiza el
 * estado final (3D + HUD) y se encola el siguiente frame — sin actualizar
 * lógica ni IA.
 */
export function buclePrincipal() {
    // --- Decrementar timers de frame ---
    if (state.cooldownDisparo > 0) state.cooldownDisparo--;
    if (state.muzzleFlashTimer > 0) state.muzzleFlashTimer--;
    if (state.hitMarkerTimer > 0) state.hitMarkerTimer--;
    if (state.damageFlashTimer > 0) state.damageFlashTimer--;
    if (state.enemyAttackTimer > 0) state.enemyAttackTimer--;

    // --- Pantalla de resultado (game-over o victoria) ---
    if (state.gameOver || state.nivelCompletado) {
        renderizar3D();
        renderizarHUD();
        requestAnimationFrame(buclePrincipal);
        return;
    }

    // --- Actualización de lógica ---
    procesarMovimiento();
    actualizarEnemigos();
    verificarPickups();
    verificarVictoria();
    gestionarTemporizador();

    // --- Render (orden de capas: mundo → sprites → HUD → minimapa) ---
    renderizar3D();
    renderizarEnemigos();
    renderizarItems();
    renderizarMira();
    renderizarHUD();
    renderizarMinimapa();

    requestAnimationFrame(buclePrincipal);
}
