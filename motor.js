"use strict";

(function () {
    // =========================================================================
    // CONSTANTS
    // =========================================================================
    const FOV = Math.PI / 3;
    const RENDER_DIST = 30;
    const TEX_SIZE = 64;

    const ANCHO_3D = 640;
    const ANCHO_MAPA = 320;
    const ALTO = 480;
    const MITAD_ALTO = ALTO / 2;

    const COOLDOWN_DISPARO = 22;
    const ENEMY_SPEED = 0.04;
    const ENEMY_CHASE_SPEED = 0.06;
    const ENEMY_CHASE_RANGE = 8;
    const ENEMY_MIN_DIST = 1.2;
    const SHADE_DIVISOR = 13;
    const FACE_DARKEN_FACTOR = 0.18;
    const PLAYER_MOVE_SPEED = 0.08;
    const PLAYER_ROT_SPEED = 0.05;
    const PLAYER_COLLISION_RADIUS = 0.2;
    const SPRITE_NEAR_CLIP = 0.3;
    const SPRITE_CORRECTION_NEAR = 0.1;
    const MUZZLE_FLASH_DURATION = 4;
    const HIT_MARKER_DURATION = 8;
    const PLAYER_MAX_HP = 100;
    const ENEMY_DAMAGE = 8;
    const ENEMY_ATTACK_COOLDOWN = 30;
    const DAMAGE_FLASH_DURATION = 6;
    const COOLDOWN_AMETRALLADORA = 6;
    const ITEM_PICKUP_DIST = 0.6;
    const SALUD_ITEMS_MAX = 3;
    const SALUD_RECUPERACION = 25;
    const ITEM_FLOAT_SPEED = 0.003;
    const TIEMPO_BUSQUEDA_MS = 30000;
    const SALIDA_COLOR = [0, 255, 255];
    const SALIDA_PULSO_HZ = 3;

    // =========================================================================
    // SETUP
    // =========================================================================
    const canvas = document.getElementById('pantallaDoom');
    if (!canvas) throw new Error('Canvas element #pantallaDoom not found');
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Cannot get 2d context from canvas');

    // Per-frame pixel buffer for the 3D view
    const frameBuffer = ctx.createImageData(ANCHO_3D, ALTO);
    const buf = frameBuffer.data;

    const zBuffer = new Float64Array(ANCHO_3D);
    const rayCache = []; // cached rays from 3D render, reused by minimap

    // =========================================================================
    // TEXTURES
    // =========================================================================
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

    const texturaMuro = crearTexturaMuro();
    const texturaTecho = crearTexturaTecho();
    const texturaSuelo = crearTexturaSuelo();

    // Pre-compute texture pixel data
    const muroTexData = texturaMuro.getContext('2d').getImageData(0, 0, TEX_SIZE, TEX_SIZE).data;
    const techoTexData = texturaTecho.getContext('2d').getImageData(0, 0, TEX_SIZE, TEX_SIZE).data;
    const sueloTexData = texturaSuelo.getContext('2d').getImageData(0, 0, TEX_SIZE, TEX_SIZE).data;

    // =========================================================================
    // AUDIO
    // =========================================================================
    let audioCtx = null;

    function ensureAudioCtx() {
        if (!audioCtx) {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (audioCtx.state === 'suspended') audioCtx.resume();
    }

    function playShoot() {
        ensureAudioCtx();
        const t = audioCtx.currentTime;
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(180, t);
        osc.frequency.exponentialRampToValueAtTime(60, t + 0.12);
        gain.gain.setValueAtTime(0.25, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
        osc.connect(gain).connect(audioCtx.destination);
        osc.start(t);
        osc.stop(t + 0.15);
    }

    function playHit() {
        ensureAudioCtx();
        const t = audioCtx.currentTime;
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(440, t);
        osc.frequency.exponentialRampToValueAtTime(120, t + 0.18);
        gain.gain.setValueAtTime(0.2, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
        osc.connect(gain).connect(audioCtx.destination);
        osc.start(t);
        osc.stop(t + 0.2);
    }

    function playEnemyAlert() {
        ensureAudioCtx();
        const t = audioCtx.currentTime;
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(260, t);
        osc.frequency.exponentialRampToValueAtTime(200, t + 0.1);
        gain.gain.setValueAtTime(0.08, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
        osc.connect(gain).connect(audioCtx.destination);
        osc.start(t);
        osc.stop(t + 0.12);
    }

    function playDamage() {
        ensureAudioCtx();
        const t = audioCtx.currentTime;
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(120, t);
        osc.frequency.exponentialRampToValueAtTime(50, t + 0.25);
        gain.gain.setValueAtTime(0.3, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
        osc.connect(gain).connect(audioCtx.destination);
        osc.start(t);
        osc.stop(t + 0.3);
    }

    function playPickup() {
        ensureAudioCtx();
        const t = audioCtx.currentTime;
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(440, t);
        osc.frequency.setValueAtTime(660, t + 0.06);
        osc.frequency.setValueAtTime(880, t + 0.12);
        gain.gain.setValueAtTime(0.15, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
        osc.connect(gain).connect(audioCtx.destination);
        osc.start(t);
        osc.stop(t + 0.2);
    }

    function playPickupWeapon() {
        ensureAudioCtx();
        const t = audioCtx.currentTime;
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(200, t);
        osc.frequency.setValueAtTime(400, t + 0.05);
        osc.frequency.setValueAtTime(600, t + 0.1);
        osc.frequency.setValueAtTime(800, t + 0.15);
        gain.gain.setValueAtTime(0.12, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
        osc.connect(gain).connect(audioCtx.destination);
        osc.start(t);
        osc.stop(t + 0.22);
    }

    // =========================================================================
    // STATE
    // =========================================================================
    let laberinto, jugador, enemigos;
    let cooldownDisparo = 0;
    let kills = 0;
    let playerHP = PLAYER_MAX_HP;
    let enemyAttackTimer = 0;
    let muzzleFlashTimer = 0;
    let hitMarkerTimer = 0;
    let damageFlashTimer = 0;
    let gameOver = false;
    let items = [];
    let tieneAmetralladora = false;
    let nivelCompletado = false;
    let numEnemigosInicial = 0;
    let temporizadorActivo = false;
    let temporizadorFinMs = 0;
    const teclasPresionadas = new Set();

    // =========================================================================
    // MAP GENERATION
    // =========================================================================
    function generarMapa(filasCeldas, colsCeldas) {
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
    // HELPERS
    // =========================================================================
    /**
     * Devuelve un array barajado de posiciones {x, y} (centro de celda)
     * de todas las celdas 'camino' del laberinto actual que se encuentran
     * a distancia euclidiana estrictamente mayor que minDist del punto (posX, posY).
     * Requiere que `laberinto` ya esté inicializado antes de llamar.
     */
    function celdasLibresLejanas(posX, posY, minDist) {
        const resultado = [];
        for (let f = 1; f < laberinto.filas - 1; f++) {
            for (let c = 1; c < laberinto.columnas - 1; c++) {
                if (laberinto.mapa[f][c].tipo === 'camino') {
                    const px = c + 0.5, py = f + 0.5;
                    if (Math.hypot(px - posX, py - posY) > minDist) {
                        resultado.push({ x: px, y: py });
                    }
                }
            }
        }
        // Fisher-Yates in-place shuffle
        for (let i = resultado.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [resultado[i], resultado[j]] = [resultado[j], resultado[i]];
        }
        return resultado;
    }

    /**
     * Coloca la puerta de salida en la celda 'camino' más lejana del spawn (1,1)
     * mediante BFS de 4-direcciones sobre el grafo de celdas transitables.
     * Pre:  laberinto.mapa ya generado; jugador spawn en celda (1,1).
     * Post: la celda argmax(distancia BFS) queda como tipo:'salida';
     *       laberinto.salida = { f, c }.
     */
    function colocarSalida() {
        const DIRS = [[-1, 0], [1, 0], [0, -1], [0, 1]];
        // dist[f][c] = pasos BFS desde (1,1), -1 = no visitado
        const dist = Array.from({ length: laberinto.filas }, () =>
            new Array(laberinto.columnas).fill(-1)
        );

        const cola = [];
        dist[1][1] = 0;
        cola.push([1, 1]);

        let cabeza = 0;
        let maxDist = -1;
        let salidaF = 1, salidaC = 1; // nunca coincidirá con spawn porque maxDist parte en -1

        while (cabeza < cola.length) {
            const [f, c] = cola[cabeza++];
            const d = dist[f][c];

            // Candidato: cualquier celda 'camino' distinta del spawn
            if ((f !== 1 || c !== 1) && laberinto.mapa[f][c].tipo === 'camino' && d > maxDist) {
                maxDist = d;
                salidaF = f;
                salidaC = c;
            }

            for (const [df, dc] of DIRS) {
                const nf = f + df;
                const nc = c + dc;
                if (nf < 0 || nf >= laberinto.filas || nc < 0 || nc >= laberinto.columnas) continue;
                if (dist[nf][nc] !== -1) continue;
                const tipo = laberinto.mapa[nf][nc].tipo;
                if (tipo !== 'camino' && tipo !== 'salida') continue;
                dist[nf][nc] = d + 1;
                cola.push([nf, nc]);
            }
        }

        laberinto.mapa[salidaF][salidaC].tipo = 'salida';
        laberinto.salida = { f: salidaF, c: salidaC };
    }

    // =========================================================================
    // INIT
    // =========================================================================
    function inicializar() {
        cooldownDisparo = 0;
        kills = 0;
        playerHP = PLAYER_MAX_HP;
        enemyAttackTimer = 0;
        muzzleFlashTimer = 0;
        hitMarkerTimer = 0;
        damageFlashTimer = 0;
        gameOver = false;
        nivelCompletado = false;
        temporizadorActivo = false;
        temporizadorFinMs = 0;
        items = [];
        tieneAmetralladora = false;

        const CELDAS_F = 4 + Math.floor(Math.random() * 4);
        const CELDAS_C = 7 + Math.floor(Math.random() * 5);

        const { grid, filas, cols } = generarMapa(CELDAS_F, CELDAS_C);

        laberinto = {
            mapa: grid.map((fila, f) =>
                fila.map((valor, c) => ({ f, c, tipo: valor === 1 ? 'pared' : 'camino' }))
            ),
            filas,
            columnas: cols
        };

        // Colocar la salida (BFS más lejana del spawn) ANTES de calcular celdas libres.
        // La celda de salida queda con tipo:'salida', por lo que celdasLibresLejanas
        // (que filtra tipo==='camino') la excluirá automáticamente del pool de spawn.
        colocarSalida();

        jugador = { x: 1.5, y: 1.5, angulo: 0 };

        const libres = celdasLibresLejanas(jugador.x, jugador.y, 3);

        const N = Math.min(5, libres.length);
        numEnemigosInicial = N;
        enemigos = libres.slice(0, N).map(pos => ({
            ...pos,
            targetX: pos.x,
            targetY: pos.y,
            lastDx: 0,
            lastDy: 0,
            chasing: false
        }));

        const restantes = libres.slice(N);

        const numSalud = Math.min(SALUD_ITEMS_MAX, restantes.length);
        for (let i = 0; i < numSalud; i++) {
            const pos = restantes[i];
            items.push({ x: pos.x, y: pos.y, tipo: 'salud', activo: true });
        }

        if (restantes.length > numSalud) {
            const pos = restantes[numSalud];
            items.push({ x: pos.x, y: pos.y, tipo: 'ametralladora', activo: true });
        }
    }

    // =========================================================================
    // DDA RAYCASTING
    // =========================================================================
    function lanzarRayoDDA(anguloRayo) {
        const dirX = Math.cos(anguloRayo);
        const dirY = Math.sin(anguloRayo);

        let mapX = Math.floor(jugador.x);
        let mapY = Math.floor(jugador.y);

        const deltaDistX = Math.abs(1 / (dirX || 1e-10));
        const deltaDistY = Math.abs(1 / (dirY || 1e-10));

        let stepX, stepY, sideDistX, sideDistY;

        if (dirX < 0) {
            stepX = -1;
            sideDistX = (jugador.x - mapX) * deltaDistX;
        } else {
            stepX = 1;
            sideDistX = (mapX + 1 - jugador.x) * deltaDistX;
        }
        if (dirY < 0) {
            stepY = -1;
            sideDistY = (jugador.y - mapY) * deltaDistY;
        } else {
            stepY = 1;
            sideDistY = (mapY + 1 - jugador.y) * deltaDistY;
        }

        let side = 0;
        let hit = false;

        while (!hit) {
            if (sideDistX < sideDistY) {
                sideDistX += deltaDistX;
                mapX += stepX;
                side = 0;
            } else {
                sideDistY += deltaDistY;
                mapY += stepY;
                side = 1;
            }
            if (mapY < 0 || mapY >= laberinto.filas || mapX < 0 || mapX >= laberinto.columnas) {
                return { dist: RENDER_DIST, u: 0, side: 0 };
            }
            const tipoCelda = laberinto.mapa[mapY][mapX].tipo;
            if (tipoCelda === 'pared' || tipoCelda === 'salida') {
                hit = true;
            }
        }

        const perpDist = side === 0
            ? (mapX - jugador.x + (1 - stepX) / 2) / dirX
            : (mapY - jugador.y + (1 - stepY) / 2) / dirY;

        // texture coordinate u
        let wallX;
        if (side === 0) {
            wallX = jugador.y + perpDist * dirY;
        } else {
            wallX = jugador.x + perpDist * dirX;
        }
        wallX -= Math.floor(wallX);

        return { dist: perpDist, u: wallX, side, tipo: laberinto.mapa[mapY][mapX].tipo };
    }

    // =========================================================================
    // 3D RENDER (uses pixel buffer + caches rays)
    // =========================================================================
    function renderizar3D() {
        // Fill ceiling and floor with texture tiles + perspective shading
        for (let y = 0; y < ALTO; y++) {
            const isCeiling = y < MITAD_ALTO;
            const texData = isCeiling ? techoTexData : sueloTexData;

            // Perspective distance: pixels farther from center horizon get darker
            const distFromCenter = Math.abs(y - MITAD_ALTO);
            const maxDist = MITAD_ALTO;
            const perspectiveFade = Math.max(0.15, 1 - (distFromCenter / maxDist) * 0.6);

            // Texture V coordinate (repeated)
            const texV = isCeiling
                ? Math.floor(((MITAD_ALTO - y) / MITAD_ALTO) * TEX_SIZE * 2) % TEX_SIZE
                : Math.floor(((y - MITAD_ALTO) / MITAD_ALTO) * TEX_SIZE * 2) % TEX_SIZE;

            const rowOffset = y * ANCHO_3D * 4;
            for (let x = 0; x < ANCHO_3D; x++) {
                // Texture U coordinate (repeated, varies with x)
                const texU = Math.floor(x / ANCHO_3D * TEX_SIZE * 2) % TEX_SIZE;
                const texIdx = (texV * TEX_SIZE + texU) * 4;

                const i = rowOffset + x * 4;
                buf[i]     = Math.floor(texData[texIdx] * perspectiveFade);
                buf[i + 1] = Math.floor(texData[texIdx + 1] * perspectiveFade);
                buf[i + 2] = Math.floor(texData[texIdx + 2] * perspectiveFade);
                buf[i + 3] = 255;
            }
        }

        rayCache.length = 0;

        for (let x = 0; x < ANCHO_3D; x++) {
            const anguloRayo = (jugador.angulo - FOV / 2) + (x / ANCHO_3D) * FOV;
            const resultado = lanzarRayoDDA(anguloRayo);
            const distancia = resultado.dist * Math.cos(anguloRayo - jugador.angulo);

            zBuffer[x] = distancia;
            rayCache.push({ angulo: anguloRayo, dist: resultado.dist });

            if (distancia >= RENDER_DIST) continue;

            const alturaPared = Math.min(ALTO, Math.floor(ALTO / distancia));
            const wallTop = Math.max(0, Math.floor(MITAD_ALTO - alturaPared / 2));
            const wallBot = Math.min(ALTO - 1, Math.floor(MITAD_ALTO + alturaPared / 2));
            const texU = Math.floor(resultado.u * TEX_SIZE) % TEX_SIZE;
            const faceDarken = resultado.side ? FACE_DARKEN_FACTOR : 0;

            if (resultado.tipo === 'salida') {
                const brillo = 0.55 + 0.45 * Math.sin(performance.now() * 0.001 * 2 * Math.PI * SALIDA_PULSO_HZ);
                const shade = Math.min(0.94, distancia / SHADE_DIVISOR + faceDarken);
                const cianVal = Math.floor(255 * brillo * (1 - shade));
                for (let y = wallTop; y <= wallBot; y++) {
                    const i = (y * ANCHO_3D + x) * 4;
                    buf[i]     = 0;
                    buf[i + 1] = cianVal;
                    buf[i + 2] = cianVal;
                    buf[i + 3] = 255;
                }
            } else {
                for (let y = wallTop; y <= wallBot; y++) {
                    const texV = Math.floor(((y - wallTop) / alturaPared) * TEX_SIZE);
                    const texIdx = (texV * TEX_SIZE + texU) * 4;

                    let r = muroTexData[texIdx];
                    let g = muroTexData[texIdx + 1];
                    let b = muroTexData[texIdx + 2];

                    const shade = Math.min(0.94, distancia / SHADE_DIVISOR + faceDarken);
                    r = Math.floor(r * (1 - shade));
                    g = Math.floor(g * (1 - shade));
                    b = Math.floor(b * (1 - shade));

                    const i = (y * ANCHO_3D + x) * 4;
                    buf[i] = r;
                    buf[i + 1] = g;
                    buf[i + 2] = b;
                }
            }
        }

        ctx.putImageData(frameBuffer, 0, 0);

        // Damage flash overlay
        if (damageFlashTimer > 0) {
            const alpha = (damageFlashTimer / DAMAGE_FLASH_DURATION) * 0.35;
            ctx.fillStyle = `rgba(255, 0, 0, ${alpha})`;
            ctx.fillRect(0, 0, ANCHO_3D, ALTO);
        }

        // Muzzle flash overlay
        if (muzzleFlashTimer > 0) {
            const cx = ANCHO_3D / 2;
            const cy = ALTO / 2 + 40;
            const alpha = muzzleFlashTimer / MUZZLE_FLASH_DURATION;
            const radius = 30 + (MUZZLE_FLASH_DURATION - muzzleFlashTimer) * 8;
            const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
            grad.addColorStop(0, `rgba(255, 255, 100, ${alpha * 0.9})`);
            grad.addColorStop(0.4, `rgba(255, 150, 30, ${alpha * 0.5})`);
            grad.addColorStop(1, 'rgba(255, 80, 0, 0)');
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(cx, cy, radius, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    // =========================================================================
    // ENEMIES
    // =========================================================================
    function esLineaLibre(x1, y1, x2, y2) {
        const dx = x2 - x1;
        const dy = y2 - y1;
        const steps = Math.max(Math.ceil(Math.abs(dx) * 10), Math.ceil(Math.abs(dy) * 10), 4);
        for (let i = 1; i < steps; i++) {
            const t = i / steps;
            const cx = Math.floor(x1 + dx * t);
            const cy = Math.floor(y1 + dy * t);
            if (cy < 0 || cy >= laberinto.filas || cx < 0 || cx >= laberinto.columnas) return false;
            if (laberinto.mapa[cy][cx].tipo === 'pared') return false;
        }
        return true;
    }

    function elegirSiguienteCelda(e) {
        const cc = Math.floor(e.x);
        const cr = Math.floor(e.y);
        const dirs = [{ dx: 1, dy: 0 }, { dx: -1, dy: 0 }, { dx: 0, dy: 1 }, { dx: 0, dy: -1 }];

        let candidatos = dirs.filter(d => {
            if (d.dx === -e.lastDx && d.dy === -e.lastDy && (e.lastDx !== 0 || e.lastDy !== 0)) return false;
            const nc = cc + d.dx;
            const nr = cr + d.dy;
            return nr >= 0 && nr < laberinto.filas &&
                nc >= 0 && nc < laberinto.columnas &&
                laberinto.mapa[nr][nc].tipo === 'camino';
        });

        if (candidatos.length === 0) {
            candidatos = dirs.filter(d => {
                const nc = cc + d.dx;
                const nr = cr + d.dy;
                return nr >= 0 && nr < laberinto.filas &&
                    nc >= 0 && nc < laberinto.columnas &&
                    laberinto.mapa[nr][nc].tipo === 'camino';
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

    function actualizarEnemigos() {
        for (const e of enemigos) {
            const dxJ = jugador.x - e.x;
            const dyJ = jugador.y - e.y;
            const distToPlayer = Math.sqrt(dxJ * dxJ + dyJ * dyJ);

            // Chase if in range and line of sight, but stop at minimum distance
            if (distToPlayer < ENEMY_CHASE_RANGE && distToPlayer > ENEMY_MIN_DIST && esLineaLibre(e.x, e.y, jugador.x, jugador.y)) {
                e.chasing = true;
                e.x += (dxJ / distToPlayer) * ENEMY_CHASE_SPEED;
                e.y += (dyJ / distToPlayer) * ENEMY_CHASE_SPEED;
            } else if (distToPlayer <= ENEMY_MIN_DIST && esLineaLibre(e.x, e.y, jugador.x, jugador.y)) {
                // Within attack range — deal damage on cooldown
                e.chasing = true;
                if (enemyAttackTimer <= 0) {
                    playerHP = Math.max(0, playerHP - ENEMY_DAMAGE);
                    damageFlashTimer = DAMAGE_FLASH_DURATION;
                    enemyAttackTimer = ENEMY_ATTACK_COOLDOWN;
                    playDamage();
                    if (playerHP <= 0) {
                        gameOver = true;
                    }
                }
            } else {
                e.chasing = false;
                const dx = e.targetX - e.x;
                const dy = e.targetY - e.y;
                const dist = Math.sqrt(dx * dx + dy * dy);

                if (dist <= 0.04) {
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

    function renderizarEnemigos() {
        const ordenados = [...enemigos].sort((a, b) => {
            const da = (a.x - jugador.x) ** 2 + (a.y - jugador.y) ** 2;
            const db = (b.x - jugador.x) ** 2 + (b.y - jugador.y) ** 2;
            return db - da;
        });

        for (const e of ordenados) {
            const dx = e.x - jugador.x;
            const dy = e.y - jugador.y;
            const distSprite = Math.sqrt(dx * dx + dy * dy);

            if (distSprite < SPRITE_NEAR_CLIP) continue;

            let deltaAngulo = Math.atan2(dy, dx) - jugador.angulo;
            while (deltaAngulo > Math.PI) deltaAngulo -= 2 * Math.PI;
            while (deltaAngulo < -Math.PI) deltaAngulo += 2 * Math.PI;

            if (Math.abs(deltaAngulo) > FOV) continue;

            const distCorr = distSprite * Math.cos(deltaAngulo);
            if (distCorr <= SPRITE_CORRECTION_NEAR) continue;

            const xCentro = Math.floor((0.5 + deltaAngulo / FOV) * ANCHO_3D);
            const altSprite = Math.min(ALTO * 2, Math.floor(ALTO / distCorr));
            const anchoSprite = Math.floor(altSprite * 0.5);

            const startX = xCentro - Math.floor(anchoSprite / 2);
            const endX = xCentro + Math.floor(anchoSprite / 2);
            const spriteTop = Math.floor(MITAD_ALTO - altSprite / 2);

            const isHit = hitMarkerTimer > 0;
            const sway = Math.sin(performance.now() / 200) * 0.02;

            for (let col = startX; col < endX; col++) {
                if (col < 0 || col >= ANCHO_3D) continue;
                if (distCorr >= zBuffer[col]) continue;

                const tc = (col - startX) / anchoSprite + sway;

                // Determine body part at this column and compute vertical bands
                const headR = 0.14;   // top 14% of sprite height
                const bodyR = 0.40;   // body: 14%–54%
                const legsR = 0.34;   // legs: 54%–88%
                const feetR = 0.12;   // feet: 88%–100%

                // Horizontal silhouette: humanoid outline
                // Head: narrower (center bulge), body: wide, arms: sides, legs: two pillars
                const cx = tc - 0.5; // -0.5 to 0.5

                // Determine what body parts this column belongs to
                let parts = [];

                // Head: circle silhouette
                const headCenterY = spriteTop + altSprite * headR * 0.5;
                const headRadius = anchoSprite * 0.22;
                const colDistHead = Math.abs((col + 0.5) - xCentro);
                const hasHead = colDistHead < headRadius;

                // Body: wide rectangle with arm extensions
                const bodyStartX = startX + anchoSprite * 0.22;
                const bodyEndX = startX + anchoSprite * 0.78;
                const armStartX = startX + anchoSprite * 0.12;
                const armEndX = startX + anchoSprite * 0.88;
                const hasBody = col >= bodyStartX && col < bodyEndX;
                const hasArm = col >= armStartX && col < bodyStartX || col >= bodyEndX && col < armEndX;

                // Legs: two pillars
                const legW = 0.12;
                const leftLeg = tc > (0.5 - legW - 0.04) && tc < (0.5 - 0.04);
                const rightLeg = tc > (0.5 + 0.04) && tc < (0.5 + legW + 0.04);
                const hasLeg = leftLeg || rightLeg;

                // Feet: wider base
                const footW = 0.14;
                const leftFoot = tc > (0.5 - footW - 0.02) && tc < (0.5 - 0.02);
                const rightFoot = tc > (0.5 + 0.02) && tc < (0.5 + footW + 0.02);
                const hasFoot = leftFoot || rightFoot;

                // Base brightness with distance
                let brillo = Math.max(30, Math.floor(210 - distSprite * 18));

                if (isHit) {
                    // Flash white on hit
                    if (hasHead) {
                        ctx.fillStyle = `rgba(255, 255, 255, 0.9)`;
                        const h = Math.floor(altSprite * headR);
                        ctx.fillRect(col, spriteTop, 1, h);
                    }
                    if (hasBody || hasArm) {
                        ctx.fillStyle = `rgba(255, 230, 230, 0.9)`;
                        const h = Math.floor(altSprite * bodyR);
                        ctx.fillRect(col, spriteTop + Math.floor(altSprite * headR), 1, h);
                    }
                    if (hasLeg) {
                        ctx.fillStyle = `rgba(255, 180, 180, 0.8)`;
                        const h = Math.floor(altSprite * legsR);
                        ctx.fillRect(col, spriteTop + Math.floor(altSprite * (headR + bodyR)), 1, h);
                    }
                    if (hasFoot) {
                        ctx.fillStyle = `rgba(255, 120, 120, 0.7)`;
                        const h = Math.floor(altSprite * feetR);
                        ctx.fillRect(col, spriteTop + Math.floor(altSprite * (headR + bodyR + legsR)), 1, h);
                    }
                    continue;
                }

                // --- HEAD ---
                if (hasHead) {
                    const headH = Math.floor(altSprite * headR);
                    const headTop = spriteTop;
                    // Skin tone (greenish-gray)
                    ctx.fillStyle = `rgb(${Math.floor(brillo * 0.72)}, ${Math.floor(brillo * 0.68)}, ${Math.floor(brillo * 0.55)})`;
                    ctx.fillRect(col, headTop, 1, headH);
                    // Eyes: glowing red dots at ~30% of head height
                    const eyeY = headTop + Math.floor(headH * 0.35);
                    const eyeX1 = xCentro - Math.floor(headRadius * 0.5);
                    const eyeX2 = xCentro + Math.floor(headRadius * 0.5);
                    if (col === eyeX1 || col === eyeX2) {
                        ctx.fillStyle = `rgb(255, ${Math.floor(20 + distSprite * 5)}, 0)`;
                        ctx.fillRect(col, eyeY, 1, 2);
                    }
                    // Mouth slit
                    const mouthY = headTop + Math.floor(headH * 0.7);
                    if (col > eyeX1 && col < eyeX2) {
                        ctx.fillStyle = `rgb(${Math.floor(brillo * 0.3)}, ${Math.floor(brillo * 0.15)}, ${Math.floor(brillo * 0.12)})`;
                        ctx.fillRect(col, mouthY, 1, 1);
                    }
                }

                // --- BODY (torso) ---
                if (hasBody) {
                    const bodyH = Math.floor(altSprite * bodyR);
                    const bodyTop = spriteTop + Math.floor(altSprite * headR);
                    // Dark suit/flesh
                    const darker = e.chasing ? 1.05 : 0.9;
                    ctx.fillStyle = `rgb(${Math.floor(brillo * 0.55 * darker)}, ${Math.floor(brillo * 0.22 * darker)}, ${Math.floor(brillo * 0.18 * darker)})`;
                    ctx.fillRect(col, bodyTop, 1, bodyH);
                    // Collar / neck detail at top
                    if (col >= xCentro - 3 && col <= xCentro + 3) {
                        ctx.fillStyle = `rgb(${Math.floor(brillo * 0.7)}, ${Math.floor(brillo * 0.65)}, ${Math.floor(brillo * 0.5)})`;
                        ctx.fillRect(col, bodyTop, 1, Math.max(1, Math.floor(altSprite * 0.03)));
                    }
                    // Blood stain if chasing
                    if (e.chasing) {
                        ctx.fillStyle = `rgba(180, 20, 0, 0.35)`;
                        const stainH = Math.floor(altSprite * 0.12);
                        const stainTop = bodyTop + Math.floor(bodyH * 0.3);
                        ctx.fillRect(col, stainTop, 1, stainH);
                    }
                }

                // --- ARMS ---
                if (hasArm) {
                    const armH = Math.floor(altSprite * (bodyR * 0.85));
                    const armTop = spriteTop + Math.floor(altSprite * headR) + Math.floor(altSprite * bodyR * 0.08);
                    ctx.fillStyle = `rgb(${Math.floor(brillo * 0.6)}, ${Math.floor(brillo * 0.28)}, ${Math.floor(brillo * 0.2)})`;
                    ctx.fillRect(col, armTop, 1, armH);
                    // Hand
                    const handY = armTop + armH - Math.max(1, Math.floor(altSprite * 0.04));
                    ctx.fillStyle = `rgb(${Math.floor(brillo * 0.75)}, ${Math.floor(brillo * 0.65)}, ${Math.floor(brillo * 0.5)})`;
                    ctx.fillRect(col, handY, 1, Math.max(1, Math.floor(altSprite * 0.04)));
                }

                // --- LEGS ---
                if (hasLeg) {
                    const legH = Math.floor(altSprite * legsR);
                    const legTop = spriteTop + Math.floor(altSprite * (headR + bodyR));
                    ctx.fillStyle = `rgb(${Math.floor(brillo * 0.4)}, ${Math.floor(brillo * 0.35)}, ${Math.floor(brillo * 0.38)})`;
                    ctx.fillRect(col, legTop, 1, legH);
                    // Knee line
                    const kneeY = legTop + Math.floor(legH * 0.4);
                    ctx.fillStyle = `rgb(${Math.floor(brillo * 0.3)}, ${Math.floor(brillo * 0.28)}, ${Math.floor(brillo * 0.3)})`;
                    ctx.fillRect(col, kneeY, 1, 1);
                }

                // --- FEET ---
                if (hasFoot) {
                    const footH = Math.floor(altSprite * feetR);
                    const footTop = spriteTop + Math.floor(altSprite * (headR + bodyR + legsR));
                    ctx.fillStyle = `rgb(${Math.floor(brillo * 0.25)}, ${Math.floor(brillo * 0.22)}, ${Math.floor(brillo * 0.28)})`;
                    ctx.fillRect(col, footTop, 1, footH);
                }
            }
        }
    }

    // =========================================================================
    // GAME STATE LOGIC
    // =========================================================================

    /**
     * Hace reaparecer n enemigos en celdas 'camino' libres lejanas al jugador.
     * Acota efectivos al número de celdas disponibles (constraint de seguridad).
     * Solo añade (push) — no reemplaza el array; en la práctica se llama cuando
     * enemigos.length === 0, pero la función es agnóstica a ese invariante.
     */
    function reaparecerEnemigos(n) {
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
                chasing: false
            });
        }
    }

    /**
     * Comprueba si el jugador ha pisado la celda de salida.
     * Solo actúa una vez (guarda !gameOver && !nivelCompletado).
     * Es la única vía de victoria (RF-5): matar enemigos no gana el nivel.
     */
    function verificarVictoria() {
        if (gameOver || nivelCompletado) return;
        if (Math.floor(jugador.y) === laberinto.salida.f &&
            Math.floor(jugador.x) === laberinto.salida.c) {
            nivelCompletado = true;
            temporizadorActivo = false;
        }
    }

    /**
     * Máquina de estados del temporizador de búsqueda.
     * Orden de evaluación estricto (ver db_puerta_salida.md §5):
     *   1. No-op si la partida está resuelta (victoria o muerte).
     *   2. Arrancar cuenta atrás cuando el mapa queda sin enemigos.
     *   3. Hacer reaparecer enemigos cuando expira el temporizador.
     * Usa performance.now() para tiempo real independiente del FPS.
     */
    function gestionarTemporizador() {
        if (nivelCompletado || gameOver) return;

        if (enemigos.length === 0 && !temporizadorActivo && !nivelCompletado) {
            temporizadorActivo = true;
            temporizadorFinMs = performance.now() + TIEMPO_BUSQUEDA_MS;
            return;
        }

        if (temporizadorActivo && performance.now() >= temporizadorFinMs) {
            reaparecerEnemigos(numEnemigosInicial);
            temporizadorActivo = false;
        }
    }

    // =========================================================================
    // SHOOTING
    // =========================================================================
    function disparar() {
        if (cooldownDisparo > 0) return;
        cooldownDisparo = tieneAmetralladora ? COOLDOWN_AMETRALLADORA : COOLDOWN_DISPARO;
        muzzleFlashTimer = MUZZLE_FLASH_DURATION;
        playShoot();

        const colCentro = Math.floor(ANCHO_3D / 2);
        const distPared = zBuffer[colCentro];

        const candidatos = enemigos
            .map((e, idx) => ({ e, idx, dist: Math.hypot(e.x - jugador.x, e.y - jugador.y) }))
            .sort((a, b) => a.dist - b.dist);

        for (const { e, idx } of candidatos) {
            const dx = e.x - jugador.x;
            const dy = e.y - jugador.y;
            const distSprite = Math.sqrt(dx * dx + dy * dy);

            let deltaAngulo = Math.atan2(dy, dx) - jugador.angulo;
            while (deltaAngulo > Math.PI) deltaAngulo -= 2 * Math.PI;
            while (deltaAngulo < -Math.PI) deltaAngulo += 2 * Math.PI;

            if (Math.abs(deltaAngulo) > FOV) continue;

            const distCorr = distSprite * Math.cos(deltaAngulo);
            if (distCorr >= distPared || distCorr <= SPRITE_CORRECTION_NEAR) continue;

            const xCentro = Math.floor((0.5 + deltaAngulo / FOV) * ANCHO_3D);
            const altSprite = Math.min(ALTO * 2, Math.floor(ALTO / distCorr));
            const anchoSprite = Math.floor(altSprite * 0.5);
            const startX = xCentro - Math.floor(anchoSprite / 2);
            const endX = xCentro + Math.floor(anchoSprite / 2);
            const tc = (colCentro - startX) / anchoSprite;

            if (colCentro >= startX && colCentro < endX && tc >= 0.08 && tc <= 0.92) {
                enemigos.splice(idx, 1);
                kills++;
                hitMarkerTimer = HIT_MARKER_DURATION;
                playHit();
                break;
            }
        }
    }

    // =========================================================================
    // ITEMS (PICKUPS)
    // =========================================================================
    function verificarPickups() {
        for (const item of items) {
            if (!item.activo) continue;
            const dist = Math.hypot(item.x - jugador.x, item.y - jugador.y);
            if (dist < ITEM_PICKUP_DIST) {
                item.activo = false;
                if (item.tipo === 'salud') {
                    playerHP = Math.min(PLAYER_MAX_HP, playerHP + SALUD_RECUPERACION);
                    playPickup();
                } else if (item.tipo === 'ametralladora') {
                    tieneAmetralladora = true;
                    playPickupWeapon();
                }
            }
        }
    }

    function renderizarItems() {
        const activos = items.filter(it => it.activo);
        const ordenados = activos.sort((a, b) => {
            const da = (a.x - jugador.x) ** 2 + (a.y - jugador.y) ** 2;
            const db = (b.x - jugador.x) ** 2 + (b.y - jugador.y) ** 2;
            return db - da;
        });

        for (const item of ordenados) {
            const dx = item.x - jugador.x;
            const dy = item.y - jugador.y;
            const distSprite = Math.sqrt(dx * dx + dy * dy);

            if (distSprite < SPRITE_NEAR_CLIP) continue;

            let deltaAngulo = Math.atan2(dy, dx) - jugador.angulo;
            while (deltaAngulo > Math.PI) deltaAngulo -= 2 * Math.PI;
            while (deltaAngulo < -Math.PI) deltaAngulo += 2 * Math.PI;

            if (Math.abs(deltaAngulo) > FOV) continue;

            const distCorr = distSprite * Math.cos(deltaAngulo);
            if (distCorr <= SPRITE_CORRECTION_NEAR) continue;

            const xCentro = Math.floor((0.5 + deltaAngulo / FOV) * ANCHO_3D);
            const altSprite = Math.min(ALTO, Math.floor(ALTO / distCorr * 0.4));
            const anchoSprite = Math.floor(altSprite * 0.8);

            const floatOffset = Math.sin(performance.now() * ITEM_FLOAT_SPEED) * Math.floor(altSprite * 0.08);

            const startX = xCentro - Math.floor(anchoSprite / 2);
            const endX = xCentro + Math.floor(anchoSprite / 2);
            const spriteTop = Math.floor(MITAD_ALTO - altSprite / 2) + floatOffset;

            for (let col = startX; col < endX; col++) {
                if (col < 0 || col >= ANCHO_3D) continue;
                if (distCorr >= zBuffer[col]) continue;

                const tc = (col - startX) / anchoSprite;

                if (item.tipo === 'salud') {
                    const spriteH = altSprite;
                    const shade = Math.max(0.2, 1 - distSprite / SHADE_DIVISOR);

                    const crossW = 0.3;
                    const crossH = 0.3;
                    const inVertBar = tc > (0.5 - crossW / 2) && tc < (0.5 + crossW / 2);
                    const inHorizBar = tc > 0.1 && tc < 0.9;

                    if (inVertBar) {
                        const r = Math.floor(255 * shade);
                        const g = Math.floor(40 * shade);
                        const b = Math.floor(40 * shade);
                        ctx.fillStyle = `rgb(${r},${g},${b})`;
                        ctx.fillRect(col, spriteTop, 1, spriteH);
                    } else if (inHorizBar) {
                        const midY = spriteTop + Math.floor(spriteH * 0.35);
                        const barH = Math.floor(spriteH * crossH);
                        const r = Math.floor(255 * shade);
                        const g = Math.floor(40 * shade);
                        const b = Math.floor(40 * shade);
                        ctx.fillStyle = `rgb(${r},${g},${b})`;
                        ctx.fillRect(col, midY, 1, barH);
                    }

                    if (tc > 0.05 && tc < 0.95) {
                        const alpha = 0.15 * shade;
                        ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
                        ctx.fillRect(col, spriteTop - 2, 1, spriteH + 4);
                    }
                } else if (item.tipo === 'ametralladora') {
                    const spriteH = altSprite;
                    const shade = Math.max(0.2, 1 - distSprite / SHADE_DIVISOR);

                    const barrelTop = spriteTop + Math.floor(spriteH * 0.3);
                    const barrelH = Math.floor(spriteH * 0.15);
                    const bodyTop = spriteTop + Math.floor(spriteH * 0.35);
                    const bodyH = Math.floor(spriteH * 0.35);
                    const gripTop = spriteTop + Math.floor(spriteH * 0.65);
                    const gripH = Math.floor(spriteH * 0.25);

                    if (tc > 0.05 && tc < 0.95) {
                        const g = Math.floor(80 * shade);
                        ctx.fillStyle = `rgb(${g},${g},${g})`;
                        ctx.fillRect(col, barrelTop, 1, barrelH);
                    }

                    if (tc > 0.25 && tc < 0.85) {
                        const r = Math.floor(60 * shade);
                        const g = Math.floor(60 * shade);
                        const b = Math.floor(70 * shade);
                        ctx.fillStyle = `rgb(${r},${g},${b})`;
                        ctx.fillRect(col, bodyTop, 1, bodyH);
                    }

                    if (tc > 0.35 && tc < 0.55) {
                        const r = Math.floor(100 * shade);
                        const g = Math.floor(70 * shade);
                        const b = Math.floor(40 * shade);
                        ctx.fillStyle = `rgb(${r},${g},${b})`;
                        ctx.fillRect(col, gripTop, 1, gripH);
                    }

                    const glow = Math.sin(performance.now() * 0.005) * 0.5 + 0.5;
                    if (tc > 0.25 && tc < 0.85) {
                        ctx.fillStyle = `rgba(255, 200, 0, ${0.1 * glow * shade})`;
                        ctx.fillRect(col, spriteTop - 2, 1, spriteH + 4);
                    }
                }
            }
        }
    }

    // =========================================================================
    // CROSSHAIR + HUD
    // =========================================================================
    function renderizarMira() {
        const cx = ANCHO_3D / 2;
        const cy = ALTO / 2;
        const gap = 4;
        const tam = 11;

        ctx.strokeStyle = cooldownDisparo > 0 ? 'rgba(255,80,0,0.9)' : 'rgba(0,255,0,0.9)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(cx - tam, cy); ctx.lineTo(cx - gap, cy);
        ctx.moveTo(cx + gap, cy); ctx.lineTo(cx + tam, cy);
        ctx.moveTo(cx, cy - tam); ctx.lineTo(cx, cy - gap);
        ctx.moveTo(cx, cy + gap); ctx.lineTo(cx, cy + tam);
        ctx.stroke();
        ctx.lineWidth = 1;

        // Hit marker
        if (hitMarkerTimer > 0) {
            const alpha = hitMarkerTimer / HIT_MARKER_DURATION;
            ctx.strokeStyle = `rgba(255, 255, 255, ${alpha})`;
            ctx.lineWidth = 2;
            const hm = 8;
            ctx.beginPath();
            ctx.moveTo(cx - hm, cy - hm); ctx.lineTo(cx - 2, cy - 2);
            ctx.moveTo(cx + hm, cy - hm); ctx.lineTo(cx + 2, cy - 2);
            ctx.moveTo(cx - hm, cy + hm); ctx.lineTo(cx - 2, cy + 2);
            ctx.moveTo(cx + hm, cy + hm); ctx.lineTo(cx + 2, cy + 2);
            ctx.stroke();
            ctx.lineWidth = 1;
        }
    }

    function renderizarHUD() {
        // Game over overlay
        if (gameOver) {
            ctx.fillStyle = 'rgba(0,0,0,0.7)';
            ctx.fillRect(0, 0, ANCHO_3D, ALTO);
            ctx.fillStyle = '#ff0000';
            ctx.font = 'bold 36px Courier New';
            ctx.textAlign = 'center';
            ctx.fillText('HAS MUERTO', ANCHO_3D / 2, MITAD_ALTO - 18);
            ctx.fillStyle = '#ffcc00';
            ctx.font = 'bold 16px Courier New';
            ctx.fillText(`Kills: ${kills}  |  [R] para reintentar`, ANCHO_3D / 2, MITAD_ALTO + 20);
            ctx.textAlign = 'left';
            return;
        }

        // Victoria overlay — precedencia: gameOver > nivelCompletado
        if (nivelCompletado) {
            ctx.fillStyle = 'rgba(0,0,0,0.7)';
            ctx.fillRect(0, 0, ANCHO_3D, ALTO);
            ctx.fillStyle = '#00ff00';
            ctx.font = 'bold 36px Courier New';
            ctx.textAlign = 'center';
            ctx.fillText('¡NIVEL COMPLETADO!', ANCHO_3D / 2, MITAD_ALTO - 18);
            ctx.fillStyle = '#ffcc00';
            ctx.font = 'bold 16px Courier New';
            ctx.fillText(`Kills: ${kills}  |  [R] para jugar de nuevo`, ANCHO_3D / 2, MITAD_ALTO + 20);
            ctx.textAlign = 'left';
            return;
        }

        // HP bar background
        const hpBarX = ANCHO_3D - 158;
        const hpBarY = 8;
        const hpBarW = 150;
        const hpBarH = 18;
        ctx.fillStyle = 'rgba(0,0,0,0.45)';
        ctx.fillRect(hpBarX, hpBarY, hpBarW, hpBarH);

        // HP bar fill
        const hpRatio = playerHP / PLAYER_MAX_HP;
        const hpColor = hpRatio > 0.5 ? '#00ff00' : hpRatio > 0.25 ? '#ffcc00' : '#ff3300';
        ctx.fillStyle = hpColor;
        ctx.fillRect(hpBarX + 2, hpBarY + 2, (hpBarW - 4) * hpRatio, hpBarH - 4);

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 11px Courier New';
        ctx.fillText(`${playerHP}/${PLAYER_MAX_HP}`, hpBarX + 4, hpBarY + 13);

        // Enemy counter
        ctx.fillStyle = 'rgba(0,0,0,0.45)';
        ctx.fillRect(6, 6, 148, 22);
        ctx.fillStyle = '#00ff00';
        ctx.font = 'bold 13px Courier New';
        ctx.fillText(`ENEMIGOS: ${enemigos.length}`, 12, 22);

        // Kill counter
        ctx.fillStyle = 'rgba(0,0,0,0.45)';
        ctx.fillRect(6, 32, 148, 22);
        ctx.fillStyle = '#ffcc00';
        ctx.font = 'bold 13px Courier New';
        ctx.fillText(`KILLS: ${kills}`, 12, 48);

        // Reload indicator
        if (cooldownDisparo > 0) {
            ctx.fillStyle = 'rgba(0,0,0,0.45)';
            ctx.fillRect(6, 58, 148, 22);
            ctx.fillStyle = '#ff6600';
            ctx.font = 'bold 13px Courier New';
            ctx.fillText('RECARGANDO...', 12, 74);
        }

        // Weapon indicator
        const weapY = cooldownDisparo > 0 ? 84 : 58;
        ctx.fillStyle = 'rgba(0,0,0,0.45)';
        ctx.fillRect(6, weapY, 148, 22);
        ctx.fillStyle = tieneAmetralladora ? '#ff8800' : '#888888';
        ctx.font = 'bold 13px Courier New';
        ctx.fillText(tieneAmetralladora ? 'ARMA: AMETRALLADORA' : 'ARMA: PISTOLA', 12, weapY + 16);

        // Indicador de cuenta atrás — visible solo si temporizadorActivo
        if (temporizadorActivo) {
            const restante = Math.max(0, Math.ceil((temporizadorFinMs - performance.now()) / 1000));
            const textoContador = `BUSCA LA SALIDA: ${restante}s`;
            ctx.font = 'bold 14px Courier New';
            const anchoTexto = ctx.measureText(textoContador).width;
            const boxW = anchoTexto + 20;
            const boxH = 24;
            const boxX = ANCHO_3D / 2 - boxW / 2;
            const boxY = ALTO / 2 - 10;
            // Fondo con borde — consistente con cajas HUD existentes
            ctx.fillStyle = 'rgba(0,0,0,0.55)';
            ctx.fillRect(boxX, boxY, boxW, boxH);
            ctx.strokeStyle = '#00ff00';
            ctx.lineWidth = 1;
            ctx.strokeRect(boxX, boxY, boxW, boxH);
            // Texto — rojo urgente si <= 5s, verde normal en otro caso
            ctx.fillStyle = restante <= 5 ? '#ff3300' : '#00ff00';
            ctx.textAlign = 'center';
            ctx.fillText(textoContador, ANCHO_3D / 2, boxY + 16);
            ctx.textAlign = 'left';
        }
    }

    // =========================================================================
    // MINIMAP (reuses cached rays)
    // =========================================================================
    function renderizarMinimapa() {
        const offsetX = ANCHO_3D;

        ctx.fillStyle = '#050505';
        ctx.fillRect(offsetX, 0, ANCHO_MAPA, ALTO);

        const tamCelda = Math.min(ANCHO_MAPA / laberinto.columnas, ALTO / laberinto.filas);

        for (let f = 0; f < laberinto.filas; f++) {
            for (let c = 0; c < laberinto.columnas; c++) {
                const tipoCeldaMapa = laberinto.mapa[f][c].tipo;
                ctx.fillStyle = tipoCeldaMapa === 'pared' ? '#004400' : tipoCeldaMapa === 'salida' ? '#00ffff' : '#111';
                ctx.strokeStyle = '#002200';
                ctx.fillRect(offsetX + c * tamCelda, f * tamCelda, tamCelda, tamCelda);
                ctx.strokeRect(offsetX + c * tamCelda, f * tamCelda, tamCelda, tamCelda);
            }
        }

        // Use cached rays from 3D render instead of re-casting
        ctx.strokeStyle = 'rgba(0, 255, 0, 0.15)';
        for (const ray of rayCache) {
            ctx.beginPath();
            ctx.moveTo(offsetX + jugador.x * tamCelda, jugador.y * tamCelda);
            ctx.lineTo(
                offsetX + (jugador.x + Math.cos(ray.angulo) * ray.dist) * tamCelda,
                (jugador.y + Math.sin(ray.angulo) * ray.dist) * tamCelda
            );
            ctx.stroke();
        }

        for (const e of enemigos) {
            const ex = offsetX + e.x * tamCelda;
            const ey = e.y * tamCelda;
            const s = Math.max(2, tamCelda * 0.4);

            ctx.fillStyle = e.chasing ? '#ff0000' : '#ff3300';
            // Head
            ctx.beginPath();
            ctx.arc(ex, ey - s * 0.5, s * 0.3, 0, Math.PI * 2);
            ctx.fill();
            // Body
            ctx.fillRect(ex - s * 0.2, ey - s * 0.15, s * 0.4, s * 0.6);
            // Legs
            ctx.fillRect(ex - s * 0.25, ey + s * 0.45, s * 0.2, s * 0.35);
            ctx.fillRect(ex + s * 0.05, ey + s * 0.45, s * 0.2, s * 0.35);
        }

        for (const item of items) {
            if (!item.activo) continue;
            const ix = offsetX + item.x * tamCelda;
            const iy = item.y * tamCelda;
            const s = Math.max(3, tamCelda * 0.35);

            if (item.tipo === 'salud') {
                ctx.fillStyle = '#ff3333';
                const pulse = Math.sin(performance.now() * 0.005) * 0.3 + 0.7;
                ctx.globalAlpha = pulse;
                ctx.fillRect(ix - s * 0.15, iy - s * 0.5, s * 0.3, s);
                ctx.fillRect(ix - s * 0.5, iy - s * 0.15, s, s * 0.3);
                ctx.globalAlpha = 1;
            } else if (item.tipo === 'ametralladora') {
                ctx.fillStyle = '#ffaa00';
                const pulse = Math.sin(performance.now() * 0.006) * 0.3 + 0.7;
                ctx.globalAlpha = pulse;
                ctx.fillRect(ix - s * 0.5, iy - s * 0.1, s, s * 0.2);
                ctx.fillRect(ix - s * 0.15, iy - s * 0.35, s * 0.3, s * 0.7);
                ctx.globalAlpha = 1;
            }
        }

        const jugX = offsetX + jugador.x * tamCelda;
        const jugY = jugador.y * tamCelda;
        ctx.fillStyle = '#00ff00';
        ctx.beginPath();
        ctx.arc(jugX, jugY, 5, 0, 2 * Math.PI);
        ctx.fill();
        ctx.strokeStyle = '#00ff00';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(jugX, jugY);
        ctx.lineTo(jugX + Math.cos(jugador.angulo) * 15, jugY + Math.sin(jugador.angulo) * 15);
        ctx.stroke();
        ctx.lineWidth = 1;
    }

    // =========================================================================
    // INPUT
    // =========================================================================
    window.addEventListener('keydown', (ev) => {
        if (ev.key === 'r' || ev.key === 'R') { inicializar(); return; }
        if (ev.key === ' ') { ev.preventDefault(); disparar(); return; }
        teclasPresionadas.add(ev.key);
    });

    window.addEventListener('keyup', (ev) => {
        teclasPresionadas.delete(ev.key);
    });

    // =========================================================================
    // MOVEMENT (wall-sliding)
    // =========================================================================
    function esCamino(x, y) {
        const fy = Math.floor(y);
        const fx = Math.floor(x);
        if (fy < 0 || fy >= laberinto.filas || fx < 0 || fx >= laberinto.columnas) return false;
        const tipo = laberinto.mapa[fy][fx].tipo;
        return tipo === 'camino' || tipo === 'salida';
    }

    function procesarMovimiento() {
        let { x, y, angulo } = jugador;

        if (teclasPresionadas.has('ArrowLeft')) angulo -= PLAYER_ROT_SPEED;
        if (teclasPresionadas.has('ArrowRight')) angulo += PLAYER_ROT_SPEED;

        const dx = Math.cos(angulo);
        const dy = Math.sin(angulo);
        const r = PLAYER_COLLISION_RADIUS;

        if (teclasPresionadas.has('ArrowUp')) {
            const nx = x + dx * PLAYER_MOVE_SPEED;
            const ny = y + dy * PLAYER_MOVE_SPEED;
            // Slide: try X independently
            if (esCamino(nx + r, y + r) && esCamino(nx - r, y + r) &&
                esCamino(nx + r, y - r) && esCamino(nx - r, y - r)) {
                x = nx;
            }
            // Slide: try Y independently
            if (esCamino(x + r, ny + r) && esCamino(x - r, ny + r) &&
                esCamino(x + r, ny - r) && esCamino(x - r, ny - r)) {
                y = ny;
            }
        }

        if (teclasPresionadas.has('ArrowDown')) {
            const nx = x - dx * PLAYER_MOVE_SPEED;
            const ny = y - dy * PLAYER_MOVE_SPEED;
            if (esCamino(nx + r, y + r) && esCamino(nx - r, y + r) &&
                esCamino(nx + r, y - r) && esCamino(nx - r, y - r)) {
                x = nx;
            }
            if (esCamino(x + r, ny + r) && esCamino(x - r, ny + r) &&
                esCamino(x + r, ny - r) && esCamino(x - r, ny - r)) {
                y = ny;
            }
        }

        jugador = { x, y, angulo };
    }

    // =========================================================================
    // GAME LOOP
    // =========================================================================
    function buclePrincipal() {
        if (cooldownDisparo > 0) cooldownDisparo--;
        if (muzzleFlashTimer > 0) muzzleFlashTimer--;
        if (hitMarkerTimer > 0) hitMarkerTimer--;
        if (damageFlashTimer > 0) damageFlashTimer--;
        if (enemyAttackTimer > 0) enemyAttackTimer--;

        if (gameOver || nivelCompletado) {
            renderizar3D();
            renderizarHUD();
            requestAnimationFrame(buclePrincipal);
            return;
        }

        procesarMovimiento();
        actualizarEnemigos();
        verificarPickups();
        verificarVictoria();
        gestionarTemporizador();

        renderizar3D();
        renderizarEnemigos();
        renderizarItems();
        renderizarMira();
        renderizarHUD();
        renderizarMinimapa();

        requestAnimationFrame(buclePrincipal);
    }

    inicializar();
    buclePrincipal();
})();
