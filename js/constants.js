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
    CONCRETE: 5,
    GRASS: 6
};

// === СИСТЕМА ПРОКАЧКИ ИГРОКА ===
const PLAYER_UPGRADES = {
    LEVEL_1: {
        level: 1,
        color: '#4CAF50', // Зеленый
        speed: 3.0,
        bulletSpeed: 5,
        reloadTime: 20,
        health: 1,
        bulletPower: 1,
        canDestroyConcrete: false,
        name: 'Базовый танк'
    },
    LEVEL_2: {
        level: 2,
        color: '#2196F3', // Синий
        speed: 3.2,
        bulletSpeed: 6,
        reloadTime: 18,
        health: 1,
        bulletPower: 1,
        canDestroyConcrete: false,
        name: 'Улучшенный танк'
    },
    LEVEL_3: {
        level: 3,
        color: '#FF9800', // Оранжевый
        speed: 3.5,
        bulletSpeed: 7,
        reloadTime: 15,
        health: 1,
        bulletPower: 2, // Пробивает кирпичи за 1 выстрел
        canDestroyConcrete: false,
        name: 'Продвинутый танк'
    },
    LEVEL_4: {
        level: 4,
        color: '#F44336', // Красный
        speed: 3.8,
        bulletSpeed: 8,
        reloadTime: 12,
        health: 2, // +1 жизнь
        bulletPower: 2,
        canDestroyConcrete: true, // Может разрушать бетон!
        name: 'Элитный танк'
    }
};

// Опыт за уничтожение врагов
const EXP_PER_KILL = {
    'BASIC': 10,
    'FAST': 15,
    'HEAVY': 25,
    'SNIPER': 20
};

// Опыт для перехода на следующий уровень
const EXP_REQUIREMENTS = {
    1: 0,   // Начальный уровень
    2: 50,  // 5 базовых танков
    3: 120, // Еще 7 танков
    4: 220  // Еще 10 танков
};

// === ТИПЫ ТАНКОВ ПРОТИВНИКОВ ===
const ENEMY_TYPES = {
    BASIC: {
        chance: 0.5,
        speed: 0.35,
        health: 1,
        color: '#FF4444',
        bulletSpeed: 4,
        reloadTime: 40
    },
    FAST: {
        chance: 0.25,
        speed: 0.7,
        health: 1,
        color: '#FFFF00',
        bulletSpeed: 5,
        reloadTime: 30
    },
    HEAVY: {
        chance: 0.1,
        speed: 0.25,
        health: 3,
        color: '#800080',
        bulletSpeed: 3,
        reloadTime: 60
    },
    SNIPER: {
        chance: 0.15,
        speed: 0.3,
        health: 1,
        color: '#00FF00',
        bulletSpeed: 7,
        reloadTime: 80
    }
};

// === УНИКАЛЬНЫЕ ИМЕНА ДЛЯ ТАНКОВ ===
const ENEMY_NAMES = {
    BASIC: ['Стальной', 'Охотник', 'Страж', 'Воин', 'Защитник', 'Боец', 'Солдат', 'Рейнджер'],
    FAST: ['Молния', 'Вихрь', 'Ураган', 'Стриж', 'Скаут', 'Гонщик', 'Скорость', 'Зефир'],
    HEAVY: ['Титан', 'Голиаф', 'Циклоп', 'Мастодонт', 'Броненосец', 'Крепость', 'Бастион', 'Гром'],
    SNIPER: ['Снайпер', 'Прицел', 'Меткий', 'Орёл', 'Ястреб', 'Ассасин', 'Точность', 'Стрелок']
};

// === СИСТЕМА БОНУСОВ ===
const BONUS_TYPES = {
    LIFE: {
        id: 'LIFE',
        symbol: '❤️',
        color: '#FF4081',
        duration: 0,
        chance: 0.4,
        sound: 'lifeBonus'
    },
    SHIELD: {
        id: 'SHIELD',
        symbol: '🛡️',
        color: '#2196F3',
        duration: 10000,
        chance: 0.3,
        sound: 'bonusPickup'
    },
    FORTIFY: {
        id: 'FORTIFY',
        symbol: '🏰',
        color: '#4CAF50',
        duration: 60000,
        chance: 0.3,
        sound: 'bonusPickup'
    },
    AUTO_AIM: {
        id: 'AUTO_AIM',
        symbol: '🎯',
        color: '#9C27B0',
        duration: 15000,
        chance: 0.2,
        sound: 'bonusPickup'
    },
    TIME_STOP: {
        id: 'TIME_STOP',
        symbol: '⏰',
        color: '#00FFFF',
        sound: 'timeStop',
        duration: 8000
    }
};
const BONUS_TANK_CHANCE = 0.2;
const BONUS_TANK_BLINK_INTERVAL = 100;
const BONUS_SPAWN_CHANCE = 0.01;
const BONUS_LIFETIME = 10000;

// === ТАБЛИЦА ЛИДЕРОВ ===
let leaderboard = [];

// === КЛЮЧИ LOCALSTORAGE ===
const STORAGE_KEYS = {
    LEADERBOARD: 'tankGame_leaderboard'
};
