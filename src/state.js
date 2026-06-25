// Estado centralizado del juego. Todos los módulos leen y mutan state.* directamente.
// El objeto es plano — sin métodos ni getters/setters — para máxima transparencia
// en el loop de juego (60 fps, acceso directo sin indirección).

import { PLAYER_MAX_HP } from './constants.js';

export const state = {
    // --- Mundo ---
    laberinto: null,
    jugador: null,
    enemigos: [],
    items: [],

    // --- Métricas de partida ---
    kills: 0,
    playerHP: PLAYER_MAX_HP,

    // --- Temporizadores de arma ---
    cooldownDisparo: 0,
    muzzleFlashTimer: 0,
    hitMarkerTimer: 0,

    // --- Temporizadores de combate ---
    enemyAttackTimer: 0,
    damageFlashTimer: 0,

    // --- Flags de sesión ---
    gameOver: false,
    nivelCompletado: false,
    tieneAmetralladora: false,

    // --- Control de nivel ---
    numEnemigosInicial: 0,

    // --- Temporizador de búsqueda ---
    temporizadorActivo: false,
    temporizadorFinMs: 0,
};
