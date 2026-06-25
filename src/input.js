// src/input.js — Manejo de teclado con callbacks desacoplados
//
// Registra keydown/keyup UNA SOLA VEZ al cargar el módulo.
// El disparo y el reinicio se delegan a callbacks registrados externamente
// para evitar dependencia circular con game.js.

export const teclasPresionadas = new Set();

let _callbackDisparo  = null;
let _callbackReinicio = null;

export function onDisparo(callback) {
    _callbackDisparo = callback;
}

export function onReinicio(callback) {
    _callbackReinicio = callback;
}

window.addEventListener('keydown', (ev) => {
    if (ev.key === ' ') {
        ev.preventDefault();
        if (_callbackDisparo) _callbackDisparo();
        return;
    }
    if (ev.key === 'r' || ev.key === 'R') {
        if (_callbackReinicio) _callbackReinicio();
        return;
    }
    teclasPresionadas.add(ev.key);
});

window.addEventListener('keyup', (ev) => {
    teclasPresionadas.delete(ev.key);
});
