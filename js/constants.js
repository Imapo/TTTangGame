// === КОНСТАНТЫ И НАСТРОЙКИ ===
const TILE_SIZE = 32;
const TANK_SPEED = 3;
const BULLET_SPEED = 8;
const CANVAS_WIDTH = 832;
const CANVAS_HEIGHT = 832;
const FPS = 60;
const FRAME_TIME = 1000 / FPS;
const MAX_ENEMIES_ON_SCREEN = 2;
const TOTAL_ENEMIES_PER_LEVEL = 6;
const RESPAWN_DELAY = 3000;
const SPAWN_ANIMATION_DURATION = 3000;
const PLAYER_SHIELD_DURATION = 5000;
const DEBUG_MODE = true; // Поставь true чтобы видеть границы коллизии

const EXIT_ANIMATION_DURATION = 2000;
const EXIT_WIDTH = 60;

// Типы проходов
const EXIT_TYPES = {
    TOP: 'top',
    BOTTOM: 'bottom',
    LEFT: 'left',
    RIGHT: 'right'
};

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

// === СИСТЕМА ИИ ДЛЯ ВРАГОВ ===
const ENEMY_AI_LEVELS = {
    BASIC: 'BASIC',
    ADVANCED: 'ADVANCED'
};

// Дальность видимости для разных типов врагов
const VISION_RANGES = {
    'BASIC': 200,
    'FAST': 250,
    'HEAVY': 180,
    'SNIPER': 400,
    'BASE_VISION': 350  // Отдельная дальность для базы
};

// Шансы стрельбы при видимости игрока
const SHOOT_CHANCES = {
    'BASIC': 0.002,   // 2% каждый кадр
    'FAST': 0.0025,   // 2.5%
    'HEAVY': 0.0015,  // 1.5% (медленная перезарядка)
    'SNIPER': 0.001   // 1% но с дальним обстрелом
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
        speed: 0.25,  // БЫЛО: 0.35 - УМЕНЬШЕНО
        health: 1,
        color: '#FF4444',
        bulletSpeed: 5,
        reloadTime: 40
    },
    FAST: {
        chance: 0.25,
        speed: 0.45,  // БЫЛО: 0.7 - УМЕНЬШЕНО (все еще быстрый, но не слишком)
        health: 1,
        color: '#FFFF00',
        bulletSpeed: 5,
        reloadTime: 30
    },
    HEAVY: {
        chance: 0.1,
        speed: 0.18,  // БЫЛО: 0.25 - УМЕНЬШЕНО (должен быть медленным)
        health: 3,
        color: '#800080',
        bulletSpeed: 4,
        reloadTime: 60
    },
    SNIPER: {
        chance: 0.15,
        speed: 0.22,  // БЫЛО: 0.3 - УМЕНЬШЕНО
        health: 1,
        color: '#00FF00',
        bulletSpeed: 15,
        reloadTime: 80
    },
    // ДОБАВЛЯЕМ ТИП ДЛЯ ЗРИТЕЛЕЙ
    VIEWER: {
        chance: 0, // Не появляется случайно
        speed: 0.3,
        health: 2,
        color: '#FF69B4', // Базовый цвет (будет переопределен)
        bulletSpeed: 6,
        reloadTime: 80
    }
};

// === УНИКАЛЬНЫЕ ИМЕНА ДЛЯ ТАНКОВ ===
const ENEMY_NAMES = {
    BASIC: ['Стальной', 'Охотник', 'Страж', 'Воин', 'Защитник', 'Боец', 'Солдат', 'Рейнджер'],
    FAST: ['Молния', 'Вихрь', 'Ураган', 'Стриж', 'Скаут', 'Гонщик', 'Скорость', 'Зефир'],
    HEAVY: ['Титан', 'Голиаф', 'Циклоп', 'Мастодонт', 'Броненосец', 'Крепость', 'Бастион', 'Гром'],
    SNIPER: ['Снайпер', 'Прицел', 'Меткий', 'Орёл', 'Ястреб', 'Ассасин', 'Точность', 'Стрелок'],
    // ДОБАВЛЯЕМ ДЛЯ ЗРИТЕЛЕЙ (будут использоваться если имя не указано)
    VIEWER: ['Зритель', 'Фанат', 'Подписчик', 'Чатик', 'Стример', 'Болельщик']
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
        duration: 30000,
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

// === СИСТЕМА СТАТИСТИКИ УРОВНЯ ===
const LEVEL_STATS_POINTS = {
    SHOT: 1,
    WALL_DESTROYED: 5,
    PLAYER_KILL: 100,
    BASE_DESTROYED: 1000
};

// Добавьте в начало файла с константами
const TELEPORT_RADIUS = 30;
const TELEPORT_ANIMATION_DURATION = 2000; // 2 секунды

// В constants.js обновляем PATROL_BEHAVIOR:
const PATROL_BEHAVIOR = {
    MOVE_MIN_TIME: 3000,    // Увеличиваем время движения
    MOVE_MAX_TIME: 7000,
    STOP_MIN_TIME: 800,     // Уменьшаем время остановки
    STOP_MAX_TIME: 2000,
    LOOK_AROUND_CHANCE: 0.4, // Уменьшаем вероятность осмотра
    DIRECTION_CHANGE_ON_STOP: 0.4
};

// ДОБАВЛЯЕМ в constants.js:
const DEBUG_COLORS = {
    BASIC_AI: '#4CAF50',    // Зеленый для базового ИИ
    ADVANCED_AI: '#FF9800', // Оранжевый для продвинутого ИИ
    PLAYER_VISION: '#FF4444', // Красный для видимости игрока
    BASE_VISION: '#9C27B0'  // Фиолетовый для видимости базы
};

// === СИСТЕМА СЛЕДОВ ГУСЕНИЦ И ПАМЯТИ ПУТИ ===
const TRACK_SYSTEM = {
    TRACK_LIFETIME: 600,
    TRACK_FADE_TIME: 60,
    TRACK_SPACING: 10, // УВЕЛИЧИВАЕМ расстояние между следами (было 6)
    MEMORY_GRID_SIZE: 16,
    MEMORY_DECAY_TIME: 1000,
    SHOW_TRACKS: false
};

// === СИСТЕМА ВИЗУАЛИЗАЦИИ СЕТКИ ===
window.ZONE_SYSTEM = {
    ZONE_SIZE: 96,              // Уменьшим размер зоны для лучшего соответствия
    SHOW_ZONE_BORDERS: false,
    SHOW_ZONE_NUMBERS: false,
    ZONE_COLOR: 'rgba(255, 255, 255, 0.2)',
    TEXT_COLOR: 'rgba(255, 255, 255, 0.6)',
    GAME_AREA: {
        startX: TILE_SIZE,      // Начинаем от первой стены
        startY: TILE_SIZE,
        width: CANVAS_WIDTH - TILE_SIZE * 2,   // Исключаем границы
        height: CANVAS_HEIGHT - TILE_SIZE * 2
    }
};

// === СИСТЕМА ЗОН БАЗЫ ===
window.BASE_ZONE_SYSTEM = {
    PROTECTED_RADIUS: 2,
    PLAYER_BASE_COLOR: 'rgba(0, 255, 0, 0.1)',     // Очень прозрачный зеленый
    CRITICAL_ZONE_COLOR: 'rgba(255, 0, 0, 0.15)',  // Очень прозрачный красный
    SHOW_BASE_ZONES: false
};

// === СИСТЕМА ПОДАРКОВ ===
const GIFT_BONUSES = {
    // Используем существующие типы бонусов
    'rose': {
        bonusType: BONUS_TYPES.SHIELD,
        message: '🛡️ Щит от',
        duration: 10000
    },
    'coin': {
        bonusType: BONUS_TYPES.AUTO_AIM,
        message: '🎯 Автоприцел от',
        duration: 15000
    },
    'diamond': {
        bonusType: BONUS_TYPES.TIME_STOP,
        message: '⏰ Стоп-время от',
        duration: 8000
    },

    // Средние подарки
    'cake': {
        bonusType: BONUS_TYPES.FORTIFY,
        message: '🏰 Укрепление базы от',
        duration: 30000
    },
    'crown': {
        bonusType: BONUS_TYPES.SHIELD, // Используем SHIELD как аналог неуязвимости
        message: '✨ Усиленный щит от',
        duration: 15000
    },
    'ice': {
        bonusType: 'CURSE_FREEZE',
        message: '❄️ Заморозка от',
        duration: 10000, // 10 секунд
        isCurse: true
    },
    // ПРОКЛЯТИЕ РЕВЕРСА (новый эффект)
    'skull': {
        bonusType: 'CURSE_REVERSE',
        message: '💀 Реверс движения от',
        duration: 15000, // 15 секунд
        isCurse: true
    }
};

// Типы подарков для автоматического определения
const GIFT_TYPES = {
    // Малые подарки
    'rose': ['роза', 'rose', 'цветок', 'flower'],
    'coin': ['коин', 'coin', 'монета', 'money'],
    'diamond': ['алмаз', 'diamond', 'бриллиант', 'кристалл'],
    // Средние подарки
    'cake': ['торт', 'cake', 'пирог', 'pie'],
    'crown': ['корона', 'crown', 'королевский'],
    // ЗАМОРОЗКА
    'ice': ['лед', 'ice', 'мороз', 'freeze', 'холод', '❄️', '🌨️'],
    // ПРОКЛЯТИЕ РЕВЕРСА
    'skull': ['череп', 'skull', 'проклятие', 'curse', 'смерть', 'реверс', 'reverse', '💀', '☠️']
};

// === СИСТЕМА ПРОКЛЯТИЙ ===
const CURSE_EFFECTS = {
    FREEZE: {
        duration: 10000,
        sound: 'playerFreeze',
        color: '#00B4FF',
        particleColor: '#87CEEB'
    },
    REVERSE: {
        duration: 15000,
        sound: 'playerReverse',
        color: '#00FF00',
        particleColor: '#32CD32'
    }
};
