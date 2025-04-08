// config.js
export const MOVE_SPEED = 8;
export const GRAVITY = 35;
export const JUMP_FORCE = 15;
export const AIR_FRICTION = 1.2;
export const MAX_AIR_SPEED = 7;


export const ATTACK_DAMAGE = 8;
export const ATTACK_RATE = 0.4;
export const ATTACK_DURATION = 0.2;
export const HITBOX_WIDTH = 1.2;
export const HITBOX_HEIGHT = 0.6;
export const HITBOX_OFFSET_X = 0.8;
export const BASE_KNOCKBACK = 9;
export const KNOCKBACK_CONTROL_LOCKOUT_DURATION = 0.25;
export const KNOCKBACK_SCALING = 0.2;

export const RANGED_ATTACK_RATE = 1.0; // Seconds between shots
export const PROJECTILE_SPEED = 15;
export const PROJECTILE_DAMAGE = 5;
export const PROJECTILE_KNOCKBACK = 3; // Base knockback for projectile
export const PROJECTILE_LIFETIME = 2;

export const GameState = {
    CHARACTER_SELECT: 'CHARACTER_SELECT',
    MAP_SELECT: 'MAP_SELECT',
    LOADING: 'LOADING',
    GAMEPLAY: 'GAMEPLAY',
    GAME_OVER: 'GAME_OVER'
};

export const CHARACTERS = [
    { id: 'frodo', name: 'Frodo', color: 0xaaaa00 },
    { id: 'gandalf', name: 'Gandalf', color: 0xcccccc },
    { id: 'legolas', name: 'Legolas', color: 0x00cc00 },
    { id: 'gimli', name: 'Gimli', color: 0xcc0000 },
    { id: 'aragorn', name: 'Aragorn', color: 0x0055aa },
];

export const MAPS = [
    {
        id: 'shire',
        name: 'The Shire',
        bgColor: 0x88cc88,
        platforms: [
            { x: 0, y: -4, w: 15, h: 1 },
            { x: -5, y: -1, w: 4, h: 0.5 },
            { x: 5, y: -1, w: 4, h: 0.5 },
        ]
    },
    {
        id: 'moria',
        name: 'Moria',
        bgColor: 0x555566,
        platforms: [
            { x: -6, y: -4, w: 6, h: 1 },
            { x: 6, y: -4, w: 6, h: 1 },
            { x: 0, y: 0, w: 5, h: 0.7 },
        ]
    },
    {
        id: 'helms_deep',
        name: "Helm's Deep",
        bgColor: 0xaaaaaa,
        platforms: [
            { x: 0, y: -4.5, w: 20, h: 1 },
            { x: -7, y: -1.5, w: 6, h: 0.7 },
            { x: 7, y: -1.5, w: 6, h: 0.7 },
        ]
    },
];