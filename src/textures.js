import { TEX_SIZE } from './constants.js';

// ---------------------------------------------------------------------------
// Funciones de generación — privadas (no exportadas)
// ---------------------------------------------------------------------------

function crearTexturaMuro() {
    const off = document.createElement('canvas');
    off.width = TEX_SIZE;
    off.height = TEX_SIZE;
    const tc = off.getContext('2d');

    // Mortero oscuro
    tc.fillStyle = '#0a0a0a';
    tc.fillRect(0, 0, TEX_SIZE, TEX_SIZE);

    const bH = 16;
    const bW = 32;
    const filaBrillos = [72, 95, 80, 105];

    for (let row = 0; row < TEX_SIZE / bH; row++) {
        const xOff = (row % 2) * (bW / 2);
        const g = filaBrillos[row % filaBrillos.length];

        for (let col = -1; col <= Math.ceil(TEX_SIZE / bW); col++) {
            const bx = col * bW + xOff;
            const by = row * bH;
            if (bx + bW <= 0 || bx >= TEX_SIZE) continue;

            // Cuerpo del ladrillo con variación interna
            const noise = Math.random() * 18 - 9;
            const rg = Math.floor(g + noise);
            const gg = Math.floor(rg * 0.82);
            const bg = Math.floor(rg * 0.68);
            tc.fillStyle = `rgb(${rg},${gg},${bg})`;
            tc.fillRect(bx + 1, by + 1, bW - 2, bH - 2);

            // Grieta sutil aleatoria
            if (Math.random() < 0.15) {
                tc.fillStyle = 'rgba(0,0,0,0.3)';
                const gx = bx + 4 + Math.floor(Math.random() * (bW - 10));
                const gy = by + 4 + Math.floor(Math.random() * (bH - 8));
                tc.fillRect(gx, gy, 2 + Math.floor(Math.random() * 4), 1);
            }

            // Borde superior e izquierdo (luz)
            const hl = Math.min(255, rg + 32);
            tc.fillStyle = `rgb(${hl},${hl},${hl})`;
            tc.fillRect(bx + 1, by + 1, bW - 2, 2);
            tc.fillRect(bx + 1, by + 3, 2, bH - 4);

            // Borde inferior y derecho (sombra)
            const sd = Math.max(0, rg - 26);
            tc.fillStyle = `rgb(${sd},${sd},${sd})`;
            tc.fillRect(bx + 1, by + bH - 3, bW - 2, 2);
            tc.fillRect(bx + bW - 3, by + 1, 2, bH - 2);
        }
    }
    return off;
}

function crearTexturaTecho() {
    const off = document.createElement('canvas');
    off.width = TEX_SIZE;
    off.height = TEX_SIZE;
    const tc = off.getContext('2d');

    // Base gris oscuro
    tc.fillStyle = '#1e1e20';
    tc.fillRect(0, 0, TEX_SIZE, TEX_SIZE);

    // Patrón de paneles (32x32)
    const pSize = 32;
    for (let row = 0; row < TEX_SIZE / pSize; row++) {
        for (let col = 0; col < TEX_SIZE / pSize; col++) {
            const px = col * pSize;
            const py = row * pSize;

            // Interior del panel
            const noise = Math.floor(Math.random() * 8);
            tc.fillStyle = `rgb(${28 + noise},${28 + noise},${30 + noise})`;
            tc.fillRect(px + 1, py + 1, pSize - 2, pSize - 2);

            // Luz empotrada en el centro de algunos paneles
            if ((row + col) % 3 === 0) {
                tc.fillStyle = '#3a3a20';
                tc.fillRect(px + 10, py + 10, 12, 12);
                tc.fillStyle = '#505030';
                tc.fillRect(px + 12, py + 12, 8, 8);
            }
        }
    }

    // Bordes de paneles (ranuras)
    tc.fillStyle = '#111113';
    for (let row = 0; row <= TEX_SIZE / pSize; row++) {
        tc.fillRect(0, row * pSize, TEX_SIZE, 1);
    }
    for (let col = 0; col <= TEX_SIZE / pSize; col++) {
        tc.fillRect(col * pSize, 0, 1, TEX_SIZE);
    }

    return off;
}

function crearTexturaSuelo() {
    const off = document.createElement('canvas');
    off.width = TEX_SIZE;
    off.height = TEX_SIZE;
    const tc = off.getContext('2d');

    // Base hormigón oscuro con variación de ruido
    for (let y = 0; y < TEX_SIZE; y++) {
        for (let x = 0; x < TEX_SIZE; x++) {
            const base = 28 + Math.floor(Math.random() * 12);
            tc.fillStyle = `rgb(${base},${base},${Math.floor(base * 1.02)})`;
            tc.fillRect(x, y, 1, 1);
        }
    }

    // Agregados de piedra — grumos claros dispersos
    for (let i = 0; i < 60; i++) {
        const ax = Math.floor(Math.random() * TEX_SIZE);
        const ay = Math.floor(Math.random() * TEX_SIZE);
        const size = 1 + Math.floor(Math.random() * 3);
        const bright = 40 + Math.floor(Math.random() * 35);
        const warm = Math.random() > 0.5;
        if (warm) {
            tc.fillStyle = `rgb(${bright + 3},${bright},${bright - 2})`;
        } else {
            tc.fillStyle = `rgb(${bright},${bright},${bright + 2})`;
        }
        tc.fillRect(ax, ay, size, size);
    }

    // Agregados oscuros
    for (let i = 0; i < 35; i++) {
        const ax = Math.floor(Math.random() * TEX_SIZE);
        const ay = Math.floor(Math.random() * TEX_SIZE);
        const size = 1 + Math.floor(Math.random() * 2);
        const dark = 12 + Math.floor(Math.random() * 8);
        tc.fillStyle = `rgb(${dark},${dark},${dark + 1})`;
        tc.fillRect(ax, ay, size, size);
    }

    // Micro-grietas finas — líneas diagonales cortas
    for (let i = 0; i < 8; i++) {
        const sx = Math.floor(Math.random() * TEX_SIZE);
        const sy = Math.floor(Math.random() * TEX_SIZE);
        const len = 4 + Math.floor(Math.random() * 12);
        const angle = Math.floor(Math.random() * 4);
        const dirs = [[1, 0], [0, 1], [1, 1], [1, -1]];
        const [ddx, ddy] = dirs[angle];
        tc.fillStyle = `rgba(15, 15, 15, ${0.3 + Math.random() * 0.3})`;
        for (let s = 0; s < len; s++) {
            tc.fillRect(sx + ddx * s, sy + ddy * s, 1, 1);
        }
    }

    // Junta de losa — línea sutil a mitad de la textura
    tc.fillStyle = 'rgba(10, 10, 10, 0.5)';
    tc.fillRect(0, TEX_SIZE / 2, TEX_SIZE, 1);
    tc.fillRect(TEX_SIZE / 2, 0, 1, TEX_SIZE);
    tc.fillStyle = 'rgba(40, 40, 40, 0.3)';
    tc.fillRect(0, TEX_SIZE / 2 + 1, TEX_SIZE, 1);
    tc.fillRect(TEX_SIZE / 2 + 1, 0, 1, TEX_SIZE);

    return off;
}

// ---------------------------------------------------------------------------
// Generación top-level — una sola vez al cargar el módulo
// ---------------------------------------------------------------------------

const texturaMuro = crearTexturaMuro();
const texturaTecho = crearTexturaTecho();
const texturaSuelo = crearTexturaSuelo();

export const muroTexData = texturaMuro.getContext('2d').getImageData(0, 0, TEX_SIZE, TEX_SIZE).data;
export const techoTexData = texturaTecho.getContext('2d').getImageData(0, 0, TEX_SIZE, TEX_SIZE).data;
export const sueloTexData = texturaSuelo.getContext('2d').getImageData(0, 0, TEX_SIZE, TEX_SIZE).data;
