// Constantes globales del motor raycasting 2.5D.
// Este módulo no importa nada — es la raíz del DAG de dependencias.

// --- Renderizado ---
export const FOV = Math.PI / 3;
export const RENDER_DIST = 30;
export const TEX_SIZE = 64;

// --- Dimensiones del canvas ---
export const ANCHO_3D = 640;
export const ANCHO_MAPA = 320;
export const ALTO = 480;
export const MITAD_ALTO = ALTO / 2;

// --- Armas ---
export const COOLDOWN_DISPARO = 22;
export const COOLDOWN_AMETRALLADORA = 6;
export const MUZZLE_FLASH_DURATION = 4;
export const HIT_MARKER_DURATION = 8;

// --- Enemigos ---
export const ENEMY_SPEED = 0.04;
export const ENEMY_CHASE_SPEED = 0.06;
export const ENEMY_CHASE_RANGE = 8;
export const ENEMY_MIN_DIST = 1.2;
export const ENEMY_DAMAGE = 8;
export const ENEMY_ATTACK_COOLDOWN = 30;

// --- Jugador ---
export const PLAYER_MOVE_SPEED = 0.08;
export const PLAYER_ROT_SPEED = 0.05;
export const PLAYER_COLLISION_RADIUS = 0.2;
export const PLAYER_MAX_HP = 100;
export const DAMAGE_FLASH_DURATION = 6;

// --- Sombreado ---
export const SHADE_DIVISOR = 13;
export const FACE_DARKEN_FACTOR = 0.18;

// --- Sprites ---
export const SPRITE_NEAR_CLIP = 0.3;
export const SPRITE_CORRECTION_NEAR = 0.1;

// --- Ítems de salud ---
export const ITEM_PICKUP_DIST = 0.6;
export const SALUD_ITEMS_MAX = 3;
export const SALUD_RECUPERACION = 25;
export const ITEM_FLOAT_SPEED = 0.003;

// --- Temporizador de búsqueda ---
export const TIEMPO_BUSQUEDA_MS = 30000;

// --- Salida del laberinto ---
export const SALIDA_COLOR = [0, 255, 255];
export const SALIDA_PULSO_HZ = 3;
