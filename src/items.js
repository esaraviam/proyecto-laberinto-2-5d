// Lógica de recogida de ítems del jugador.
// Itera state.items cada frame; desactiva ítems al entrar en radio de pickup.

import { ITEM_PICKUP_DIST, PLAYER_MAX_HP, SALUD_RECUPERACION } from './constants.js';
import { state } from './state.js';
import { playPickup, playPickupWeapon } from './audio.js';

export function verificarPickups() {
    for (const item of state.items) {
        if (!item.activo) continue;
        const dist = Math.hypot(item.x - state.jugador.x, item.y - state.jugador.y);
        if (dist < ITEM_PICKUP_DIST) {
            item.activo = false;
            if (item.tipo === 'salud') {
                state.playerHP = Math.min(PLAYER_MAX_HP, state.playerHP + SALUD_RECUPERACION);
                playPickup();
            } else if (item.tipo === 'ametralladora') {
                state.tieneAmetralladora = true;
                playPickupWeapon();
            }
        }
    }
}
