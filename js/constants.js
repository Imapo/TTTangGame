// === КОНСТАНТЫ И НАСТРОЙКИ ===
const TILE_SIZE = 32;
const TANK_SPEED = 3;
const BULLET_SPEED = 8;
const CANVAS_WIDTH = 832;
const CANVAS_HEIGHT = 832;
const FPS = 60;
const FRAME_TIME = 1000 / FPS;
const MAX_ENEMIES_ON_SCREEN = 4;
const TOTAL_ENEMIES_PER_LEVEL = 20;
const RESPAWN_DELAY = 3000;
const SPAWN_ANIMATION_DURATION = 3000;
const PLAYER_SHIELD_DURATION = 5000;

// Направления (обычные объекты)
const DIRECTIONS = {
    UP: { x: 0, y: -1 },
    DOWN: { x: 0, y: 1 },
    LEFT: { x: -1, y: 0 },
    RIGHT: { x: 1, y: 0 }
};

// Точки спавна врагов
const SPAWN_POINTS = [
    { x: 416, y: 100 },    // Центр сверху
{ x: 732, y: 100 },    // Правый верх
{ x: 100, y: 100 }     // Левый верх
];

// Типы тайлов карты
const TILE_TYPES = {
    EMPTY: 0,
    BRICK: 1,
    WATER: 3,
    BASE: 4,
    CONCRETE: 5
};
