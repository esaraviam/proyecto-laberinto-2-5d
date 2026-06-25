import {
    FOV,
    RENDER_DIST,
    TEX_SIZE,
    ANCHO_3D,
    ANCHO_MAPA,
    ALTO,
    MITAD_ALTO,
    MUZZLE_FLASH_DURATION,
    HIT_MARKER_DURATION,
    DAMAGE_FLASH_DURATION,
    SHADE_DIVISOR,
    FACE_DARKEN_FACTOR,
    SPRITE_NEAR_CLIP,
    SPRITE_CORRECTION_NEAR,
    ITEM_FLOAT_SPEED,
    SALIDA_PULSO_HZ,
    PLAYER_MAX_HP,
} from './constants.js';
import { state } from './state.js';
import { muroTexData, techoTexData, sueloTexData } from './textures.js';
import { lanzarRayoDDA, zBuffer, rayCache } from './raycaster.js';

// ---------------------------------------------------------------------------
// Canvas privado — ÚNICO acceso a ctx en toda la aplicación
// ---------------------------------------------------------------------------
const canvas = document.getElementById('pantallaDoom');
const ctx = canvas.getContext('2d');
const frameBuffer = ctx.createImageData(ANCHO_3D, ALTO);
const buf = frameBuffer.data;

// ---------------------------------------------------------------------------
// renderizar3D
// ---------------------------------------------------------------------------
export function renderizar3D() {
    const jugador   = state.jugador;

    // Paso 1: Suelo + techo texturizados con perspectiva
    for (let y = 0; y < ALTO; y++) {
        const isCeiling = y < MITAD_ALTO;
        const texData = isCeiling ? techoTexData : sueloTexData;

        const distFromCenter = Math.abs(y - MITAD_ALTO);
        const perspectiveFade = Math.max(0.15, 1 - (distFromCenter / MITAD_ALTO) * 0.6);

        const texV = isCeiling
            ? Math.floor(((MITAD_ALTO - y) / MITAD_ALTO) * TEX_SIZE * 2) % TEX_SIZE
            : Math.floor(((y - MITAD_ALTO) / MITAD_ALTO) * TEX_SIZE * 2) % TEX_SIZE;

        const rowOffset = y * ANCHO_3D * 4;
        for (let x = 0; x < ANCHO_3D; x++) {
            const texU = Math.floor(x / ANCHO_3D * TEX_SIZE * 2) % TEX_SIZE;
            const texIdx = (texV * TEX_SIZE + texU) * 4;
            const i = rowOffset + x * 4;
            buf[i]     = Math.floor(texData[texIdx]     * perspectiveFade);
            buf[i + 1] = Math.floor(texData[texIdx + 1] * perspectiveFade);
            buf[i + 2] = Math.floor(texData[texIdx + 2] * perspectiveFade);
            buf[i + 3] = 255;
        }
    }

    // Paso 2: Paredes (DDA) — llenar zBuffer y rayCache
    rayCache.length = 0;

    for (let x = 0; x < ANCHO_3D; x++) {
        const anguloRayo = (jugador.angulo - FOV / 2) + (x / ANCHO_3D) * FOV;
        const resultado  = lanzarRayoDDA(anguloRayo);
        const distancia  = resultado.dist * Math.cos(anguloRayo - jugador.angulo);

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
            const shade  = Math.min(0.94, distancia / SHADE_DIVISOR + faceDarken);
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
                const texV  = Math.floor(((y - wallTop) / alturaPared) * TEX_SIZE);
                const texIdx = (texV * TEX_SIZE + texU) * 4;
                const shade  = Math.min(0.94, distancia / SHADE_DIVISOR + faceDarken);
                const i = (y * ANCHO_3D + x) * 4;
                buf[i]     = Math.floor(muroTexData[texIdx]     * (1 - shade));
                buf[i + 1] = Math.floor(muroTexData[texIdx + 1] * (1 - shade));
                buf[i + 2] = Math.floor(muroTexData[texIdx + 2] * (1 - shade));
                buf[i + 3] = 255;
            }
        }
    }

    // Paso 3: Flush del buffer de píxeles
    ctx.putImageData(frameBuffer, 0, 0);

    // Paso 4: Damage flash overlay
    if (state.damageFlashTimer > 0) {
        const alpha = (state.damageFlashTimer / DAMAGE_FLASH_DURATION) * 0.35;
        ctx.fillStyle = `rgba(255, 0, 0, ${alpha})`;
        ctx.fillRect(0, 0, ANCHO_3D, ALTO);
    }

    // Paso 5: Muzzle flash overlay
    if (state.muzzleFlashTimer > 0) {
        const cx     = ANCHO_3D / 2;
        const cy     = ALTO / 2 + 40;
        const alpha  = state.muzzleFlashTimer / MUZZLE_FLASH_DURATION;
        const radius = 30 + (MUZZLE_FLASH_DURATION - state.muzzleFlashTimer) * 8;
        const grad   = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
        grad.addColorStop(0,   `rgba(255, 255, 100, ${alpha * 0.9})`);
        grad.addColorStop(0.4, `rgba(255, 150, 30,  ${alpha * 0.5})`);
        grad.addColorStop(1,   'rgba(255, 80, 0, 0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.fill();
    }
}

// ---------------------------------------------------------------------------
// renderizarEnemigos
// ---------------------------------------------------------------------------
export function renderizarEnemigos() {
    const jugador  = state.jugador;
    const enemigos = state.enemigos;
    const isHit    = state.hitMarkerTimer > 0;

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
        while (deltaAngulo >  Math.PI) deltaAngulo -= 2 * Math.PI;
        while (deltaAngulo < -Math.PI) deltaAngulo += 2 * Math.PI;

        if (Math.abs(deltaAngulo) > FOV) continue;

        const distCorr = distSprite * Math.cos(deltaAngulo);
        if (distCorr <= SPRITE_CORRECTION_NEAR) continue;

        const xCentro   = Math.floor((0.5 + deltaAngulo / FOV) * ANCHO_3D);
        const altSprite  = Math.min(ALTO * 2, Math.floor(ALTO / distCorr));
        const anchoSprite = Math.floor(altSprite * 0.5);

        const startX   = xCentro - Math.floor(anchoSprite / 2);
        const endX     = xCentro + Math.floor(anchoSprite / 2);
        const spriteTop = Math.floor(MITAD_ALTO - altSprite / 2);

        const sway = Math.sin(performance.now() / 200) * 0.02;

        // Proporciones de partes corporales
        const headR = 0.14;
        const bodyR = 0.40;
        const legsR = 0.34;
        const feetR = 0.12;

        for (let col = startX; col < endX; col++) {
            if (col < 0 || col >= ANCHO_3D) continue;
            if (distCorr >= zBuffer[col]) continue;

            const tc = (col - startX) / anchoSprite + sway;

            // Cabeza — círculo de silueta
            const headRadius  = anchoSprite * 0.22;
            const colDistHead = Math.abs((col + 0.5) - xCentro);
            const hasHead = colDistHead < headRadius;

            // Cuerpo + brazos
            const bodyStartX = startX + anchoSprite * 0.22;
            const bodyEndX   = startX + anchoSprite * 0.78;
            const armStartX  = startX + anchoSprite * 0.12;
            const armEndX    = startX + anchoSprite * 0.88;
            const hasBody    = col >= bodyStartX && col < bodyEndX;
            const hasArm     = (col >= armStartX && col < bodyStartX) || (col >= bodyEndX && col < armEndX);

            // Piernas
            const legW     = 0.12;
            const leftLeg  = tc > (0.5 - legW - 0.04) && tc < (0.5 - 0.04);
            const rightLeg = tc > (0.5 + 0.04)         && tc < (0.5 + legW + 0.04);
            const hasLeg   = leftLeg || rightLeg;

            // Pies
            const footW    = 0.14;
            const leftFoot  = tc > (0.5 - footW - 0.02) && tc < (0.5 - 0.02);
            const rightFoot = tc > (0.5 + 0.02)          && tc < (0.5 + footW + 0.02);
            const hasFoot   = leftFoot || rightFoot;

            const brillo = Math.max(30, Math.floor(210 - distSprite * 18));

            // Flash blanco en hit
            if (isHit) {
                if (hasHead) {
                    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
                    ctx.fillRect(col, spriteTop, 1, Math.floor(altSprite * headR));
                }
                if (hasBody || hasArm) {
                    ctx.fillStyle = 'rgba(255, 230, 230, 0.9)';
                    ctx.fillRect(col, spriteTop + Math.floor(altSprite * headR), 1, Math.floor(altSprite * bodyR));
                }
                if (hasLeg) {
                    ctx.fillStyle = 'rgba(255, 180, 180, 0.8)';
                    ctx.fillRect(col, spriteTop + Math.floor(altSprite * (headR + bodyR)), 1, Math.floor(altSprite * legsR));
                }
                if (hasFoot) {
                    ctx.fillStyle = 'rgba(255, 120, 120, 0.7)';
                    ctx.fillRect(col, spriteTop + Math.floor(altSprite * (headR + bodyR + legsR)), 1, Math.floor(altSprite * feetR));
                }
                continue;
            }

            // Cabeza
            if (hasHead) {
                const headH   = Math.floor(altSprite * headR);
                const headTop = spriteTop;
                ctx.fillStyle = `rgb(${Math.floor(brillo * 0.72)}, ${Math.floor(brillo * 0.68)}, ${Math.floor(brillo * 0.55)})`;
                ctx.fillRect(col, headTop, 1, headH);
                const eyeY  = headTop + Math.floor(headH * 0.35);
                const eyeX1 = xCentro - Math.floor(headRadius * 0.5);
                const eyeX2 = xCentro + Math.floor(headRadius * 0.5);
                if (col === eyeX1 || col === eyeX2) {
                    ctx.fillStyle = `rgb(255, ${Math.floor(20 + distSprite * 5)}, 0)`;
                    ctx.fillRect(col, eyeY, 1, 2);
                }
                const mouthY = headTop + Math.floor(headH * 0.7);
                if (col > eyeX1 && col < eyeX2) {
                    ctx.fillStyle = `rgb(${Math.floor(brillo * 0.3)}, ${Math.floor(brillo * 0.15)}, ${Math.floor(brillo * 0.12)})`;
                    ctx.fillRect(col, mouthY, 1, 1);
                }
            }

            // Torso
            if (hasBody) {
                const bodyH   = Math.floor(altSprite * bodyR);
                const bodyTop = spriteTop + Math.floor(altSprite * headR);
                const darker  = e.chasing ? 1.05 : 0.9;
                ctx.fillStyle = `rgb(${Math.floor(brillo * 0.55 * darker)}, ${Math.floor(brillo * 0.22 * darker)}, ${Math.floor(brillo * 0.18 * darker)})`;
                ctx.fillRect(col, bodyTop, 1, bodyH);
                if (col >= xCentro - 3 && col <= xCentro + 3) {
                    ctx.fillStyle = `rgb(${Math.floor(brillo * 0.7)}, ${Math.floor(brillo * 0.65)}, ${Math.floor(brillo * 0.5)})`;
                    ctx.fillRect(col, bodyTop, 1, Math.max(1, Math.floor(altSprite * 0.03)));
                }
                if (e.chasing) {
                    ctx.fillStyle = 'rgba(180, 20, 0, 0.35)';
                    const stainH   = Math.floor(altSprite * 0.12);
                    const stainTop = bodyTop + Math.floor(bodyH * 0.3);
                    ctx.fillRect(col, stainTop, 1, stainH);
                }
            }

            // Brazos
            if (hasArm) {
                const armH   = Math.floor(altSprite * (bodyR * 0.85));
                const armTop = spriteTop + Math.floor(altSprite * headR) + Math.floor(altSprite * bodyR * 0.08);
                ctx.fillStyle = `rgb(${Math.floor(brillo * 0.6)}, ${Math.floor(brillo * 0.28)}, ${Math.floor(brillo * 0.2)})`;
                ctx.fillRect(col, armTop, 1, armH);
                const handY = armTop + armH - Math.max(1, Math.floor(altSprite * 0.04));
                ctx.fillStyle = `rgb(${Math.floor(brillo * 0.75)}, ${Math.floor(brillo * 0.65)}, ${Math.floor(brillo * 0.5)})`;
                ctx.fillRect(col, handY, 1, Math.max(1, Math.floor(altSprite * 0.04)));
            }

            // Piernas
            if (hasLeg) {
                const legH   = Math.floor(altSprite * legsR);
                const legTop = spriteTop + Math.floor(altSprite * (headR + bodyR));
                ctx.fillStyle = `rgb(${Math.floor(brillo * 0.4)}, ${Math.floor(brillo * 0.35)}, ${Math.floor(brillo * 0.38)})`;
                ctx.fillRect(col, legTop, 1, legH);
                const kneeY = legTop + Math.floor(legH * 0.4);
                ctx.fillStyle = `rgb(${Math.floor(brillo * 0.3)}, ${Math.floor(brillo * 0.28)}, ${Math.floor(brillo * 0.3)})`;
                ctx.fillRect(col, kneeY, 1, 1);
            }

            // Pies
            if (hasFoot) {
                const footH   = Math.floor(altSprite * feetR);
                const footTop = spriteTop + Math.floor(altSprite * (headR + bodyR + legsR));
                ctx.fillStyle = `rgb(${Math.floor(brillo * 0.25)}, ${Math.floor(brillo * 0.22)}, ${Math.floor(brillo * 0.28)})`;
                ctx.fillRect(col, footTop, 1, footH);
            }
        }
    }
}

// ---------------------------------------------------------------------------
// renderizarItems
// ---------------------------------------------------------------------------
export function renderizarItems() {
    const jugador = state.jugador;

    const ordenados = state.items
        .filter(it => it.activo)
        .sort((a, b) => {
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
        while (deltaAngulo >  Math.PI) deltaAngulo -= 2 * Math.PI;
        while (deltaAngulo < -Math.PI) deltaAngulo += 2 * Math.PI;

        if (Math.abs(deltaAngulo) > FOV) continue;

        const distCorr = distSprite * Math.cos(deltaAngulo);
        if (distCorr <= SPRITE_CORRECTION_NEAR) continue;

        const xCentro    = Math.floor((0.5 + deltaAngulo / FOV) * ANCHO_3D);
        const altSprite  = Math.min(ALTO, Math.floor(ALTO / distCorr * 0.4));
        const anchoSprite = Math.floor(altSprite * 0.8);

        const floatOffset = Math.sin(performance.now() * ITEM_FLOAT_SPEED) * Math.floor(altSprite * 0.08);

        const startX   = xCentro - Math.floor(anchoSprite / 2);
        const endX     = xCentro + Math.floor(anchoSprite / 2);
        const spriteTop = Math.floor(MITAD_ALTO - altSprite / 2) + floatOffset;

        for (let col = startX; col < endX; col++) {
            if (col < 0 || col >= ANCHO_3D) continue;
            if (distCorr >= zBuffer[col]) continue;

            const tc    = (col - startX) / anchoSprite;
            const shade = Math.max(0.2, 1 - distSprite / SHADE_DIVISOR);

            if (item.tipo === 'salud') {
                const crossW   = 0.3;
                const crossH   = 0.3;
                const inVertBar  = tc > (0.5 - crossW / 2) && tc < (0.5 + crossW / 2);
                const inHorizBar = tc > 0.1 && tc < 0.9;

                if (inVertBar) {
                    ctx.fillStyle = `rgb(${Math.floor(255 * shade)},${Math.floor(40 * shade)},${Math.floor(40 * shade)})`;
                    ctx.fillRect(col, spriteTop, 1, altSprite);
                } else if (inHorizBar) {
                    const midY = spriteTop + Math.floor(altSprite * 0.35);
                    const barH = Math.floor(altSprite * crossH);
                    ctx.fillStyle = `rgb(${Math.floor(255 * shade)},${Math.floor(40 * shade)},${Math.floor(40 * shade)})`;
                    ctx.fillRect(col, midY, 1, barH);
                }

                if (tc > 0.05 && tc < 0.95) {
                    ctx.fillStyle = `rgba(255, 255, 255, ${0.15 * shade})`;
                    ctx.fillRect(col, spriteTop - 2, 1, altSprite + 4);
                }

            } else if (item.tipo === 'ametralladora') {
                const barrelTop = spriteTop + Math.floor(altSprite * 0.3);
                const barrelH   = Math.floor(altSprite * 0.15);
                const bodyTop   = spriteTop + Math.floor(altSprite * 0.35);
                const bodyH     = Math.floor(altSprite * 0.35);
                const gripTop   = spriteTop + Math.floor(altSprite * 0.65);
                const gripH     = Math.floor(altSprite * 0.25);

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
                    ctx.fillRect(col, spriteTop - 2, 1, altSprite + 4);
                }
            }
        }
    }
}

// ---------------------------------------------------------------------------
// renderizarMira
// ---------------------------------------------------------------------------
export function renderizarMira() {
    const cx  = ANCHO_3D / 2;
    const cy  = ALTO / 2;
    const gap = 4;
    const tam = 11;

    ctx.strokeStyle = state.cooldownDisparo > 0 ? 'rgba(255,80,0,0.9)' : 'rgba(0,255,0,0.9)';
    ctx.lineWidth   = 1.5;
    ctx.beginPath();
    ctx.moveTo(cx - tam, cy); ctx.lineTo(cx - gap, cy);
    ctx.moveTo(cx + gap, cy); ctx.lineTo(cx + tam, cy);
    ctx.moveTo(cx, cy - tam); ctx.lineTo(cx, cy - gap);
    ctx.moveTo(cx, cy + gap); ctx.lineTo(cx, cy + tam);
    ctx.stroke();
    ctx.lineWidth = 1;

    // Hit marker — 4 diagonales que se desvanecen
    if (state.hitMarkerTimer > 0) {
        const alpha = state.hitMarkerTimer / HIT_MARKER_DURATION;
        ctx.strokeStyle = `rgba(255, 255, 255, ${alpha})`;
        ctx.lineWidth   = 2;
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

// ---------------------------------------------------------------------------
// renderizarHUD
// ---------------------------------------------------------------------------
export function renderizarHUD() {
    const {
        gameOver,
        nivelCompletado,
        playerHP,
        kills,
        cooldownDisparo,
        tieneAmetralladora,
        temporizadorActivo,
        temporizadorFinMs,
        enemigos,
    } = state;

    // Overlay Game Over
    if (gameOver) {
        ctx.fillStyle = 'rgba(0,0,0,0.7)';
        ctx.fillRect(0, 0, ANCHO_3D, ALTO);
        ctx.fillStyle   = '#ff0000';
        ctx.font        = 'bold 36px Courier New';
        ctx.textAlign   = 'center';
        ctx.fillText('HAS MUERTO', ANCHO_3D / 2, MITAD_ALTO - 18);
        ctx.fillStyle = '#ffcc00';
        ctx.font      = 'bold 16px Courier New';
        ctx.fillText(`Kills: ${kills}  |  [R] para reintentar`, ANCHO_3D / 2, MITAD_ALTO + 20);
        ctx.textAlign = 'left';
        return;
    }

    // Overlay Victoria
    if (nivelCompletado) {
        ctx.fillStyle = 'rgba(0,0,0,0.7)';
        ctx.fillRect(0, 0, ANCHO_3D, ALTO);
        ctx.fillStyle = '#00ff00';
        ctx.font      = 'bold 36px Courier New';
        ctx.textAlign = 'center';
        ctx.fillText('¡NIVEL COMPLETADO!', ANCHO_3D / 2, MITAD_ALTO - 18);
        ctx.fillStyle = '#ffcc00';
        ctx.font      = 'bold 16px Courier New';
        ctx.fillText(`Kills: ${kills}  |  [R] para jugar de nuevo`, ANCHO_3D / 2, MITAD_ALTO + 20);
        ctx.textAlign = 'left';
        return;
    }

    // Barra de HP
    const hpBarX = ANCHO_3D - 158;
    const hpBarY = 8;
    const hpBarW = 150;
    const hpBarH = 18;
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(hpBarX, hpBarY, hpBarW, hpBarH);

    const hpRatio = playerHP / PLAYER_MAX_HP;
    ctx.fillStyle  = hpRatio > 0.5 ? '#00ff00' : hpRatio > 0.25 ? '#ffcc00' : '#ff3300';
    ctx.fillRect(hpBarX + 2, hpBarY + 2, (hpBarW - 4) * hpRatio, hpBarH - 4);

    ctx.fillStyle = '#ffffff';
    ctx.font      = 'bold 11px Courier New';
    ctx.fillText(`${playerHP}/${PLAYER_MAX_HP}`, hpBarX + 4, hpBarY + 13);

    // Contador de enemigos
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(6, 6, 148, 22);
    ctx.fillStyle = '#00ff00';
    ctx.font      = 'bold 13px Courier New';
    ctx.fillText(`ENEMIGOS: ${enemigos.length}`, 12, 22);

    // Contador de kills
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(6, 32, 148, 22);
    ctx.fillStyle = '#ffcc00';
    ctx.font      = 'bold 13px Courier New';
    ctx.fillText(`KILLS: ${kills}`, 12, 48);

    // Indicador de recarga
    if (cooldownDisparo > 0) {
        ctx.fillStyle = 'rgba(0,0,0,0.45)';
        ctx.fillRect(6, 58, 148, 22);
        ctx.fillStyle = '#ff6600';
        ctx.font      = 'bold 13px Courier New';
        ctx.fillText('RECARGANDO...', 12, 74);
    }

    // Indicador de arma
    const weapY = cooldownDisparo > 0 ? 84 : 58;
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(6, weapY, 148, 22);
    ctx.fillStyle = tieneAmetralladora ? '#ff8800' : '#888888';
    ctx.font      = 'bold 13px Courier New';
    ctx.fillText(tieneAmetralladora ? 'ARMA: AMETRALLADORA' : 'ARMA: PISTOLA', 12, weapY + 16);

    // Cuenta regresiva
    if (temporizadorActivo) {
        const restante      = Math.max(0, Math.ceil((temporizadorFinMs - performance.now()) / 1000));
        const textoContador = `BUSCA LA SALIDA: ${restante}s`;
        ctx.font = 'bold 14px Courier New';
        const anchoTexto = ctx.measureText(textoContador).width;
        const boxW = anchoTexto + 20;
        const boxH = 24;
        const boxX = ANCHO_3D / 2 - boxW / 2;
        const boxY = ALTO / 2 - 10;
        ctx.fillStyle = 'rgba(0,0,0,0.55)';
        ctx.fillRect(boxX, boxY, boxW, boxH);
        ctx.strokeStyle = '#00ff00';
        ctx.lineWidth   = 1;
        ctx.strokeRect(boxX, boxY, boxW, boxH);
        ctx.fillStyle = restante <= 5 ? '#ff3300' : '#00ff00';
        ctx.textAlign = 'center';
        ctx.fillText(textoContador, ANCHO_3D / 2, boxY + 16);
        ctx.textAlign = 'left';
    }
}

// ---------------------------------------------------------------------------
// renderizarMinimapa
// ---------------------------------------------------------------------------
export function renderizarMinimapa() {
    const jugador   = state.jugador;
    const laberinto = state.laberinto;
    const enemigos  = state.enemigos;
    const items     = state.items;
    const offsetX   = ANCHO_3D;

    // Fondo
    ctx.fillStyle = '#050505';
    ctx.fillRect(offsetX, 0, ANCHO_MAPA, ALTO);

    const tamCelda = Math.min(ANCHO_MAPA / laberinto.columnas, ALTO / laberinto.filas);

    // Celdas del mapa
    for (let f = 0; f < laberinto.filas; f++) {
        for (let c = 0; c < laberinto.columnas; c++) {
            const tipo = laberinto.mapa[f][c].tipo;
            ctx.fillStyle   = tipo === 'pared' ? '#004400' : tipo === 'salida' ? '#00ffff' : '#111';
            ctx.strokeStyle = '#002200';
            ctx.fillRect  (offsetX + c * tamCelda, f * tamCelda, tamCelda, tamCelda);
            ctx.strokeRect(offsetX + c * tamCelda, f * tamCelda, tamCelda, tamCelda);
        }
    }

    // Rayos del FOV — reutiliza rayCache (no relanza rayos)
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

    // Siluetas de enemigos
    for (const e of enemigos) {
        const ex = offsetX + e.x * tamCelda;
        const ey = e.y * tamCelda;
        const s  = Math.max(2, tamCelda * 0.4);

        ctx.fillStyle = e.chasing ? '#ff0000' : '#ff3300';
        ctx.beginPath();
        ctx.arc(ex, ey - s * 0.5, s * 0.3, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillRect(ex - s * 0.2,  ey - s * 0.15, s * 0.4, s * 0.6);
        ctx.fillRect(ex - s * 0.25, ey + s * 0.45, s * 0.2, s * 0.35);
        ctx.fillRect(ex + s * 0.05, ey + s * 0.45, s * 0.2, s * 0.35);
    }

    // Ítems con pulso
    for (const item of items) {
        if (!item.activo) continue;
        const ix = offsetX + item.x * tamCelda;
        const iy = item.y * tamCelda;
        const s  = Math.max(3, tamCelda * 0.35);

        if (item.tipo === 'salud') {
            const pulse = Math.sin(performance.now() * 0.005) * 0.3 + 0.7;
            ctx.fillStyle   = '#ff3333';
            ctx.globalAlpha = pulse;
            ctx.fillRect(ix - s * 0.15, iy - s * 0.5,  s * 0.3, s);
            ctx.fillRect(ix - s * 0.5,  iy - s * 0.15, s,        s * 0.3);
            ctx.globalAlpha = 1;
        } else if (item.tipo === 'ametralladora') {
            const pulse = Math.sin(performance.now() * 0.006) * 0.3 + 0.7;
            ctx.fillStyle   = '#ffaa00';
            ctx.globalAlpha = pulse;
            ctx.fillRect(ix - s * 0.5,  iy - s * 0.1,  s,        s * 0.2);
            ctx.fillRect(ix - s * 0.15, iy - s * 0.35, s * 0.3,  s * 0.7);
            ctx.globalAlpha = 1;
        }
    }

    // Jugador — círculo verde + línea de dirección
    const jugX = offsetX + jugador.x * tamCelda;
    const jugY = jugador.y * tamCelda;
    ctx.fillStyle = '#00ff00';
    ctx.beginPath();
    ctx.arc(jugX, jugY, 5, 0, 2 * Math.PI);
    ctx.fill();
    ctx.strokeStyle = '#00ff00';
    ctx.lineWidth   = 2;
    ctx.beginPath();
    ctx.moveTo(jugX, jugY);
    ctx.lineTo(jugX + Math.cos(jugador.angulo) * 15, jugY + Math.sin(jugador.angulo) * 15);
    ctx.stroke();
    ctx.lineWidth = 1;
}
