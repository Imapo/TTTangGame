// === КЛАСС ТАНКА ===
class Tank {
    constructor(x, y, type = 'player', level = 1, enemyType = 'BASIC') {
        this.position = new Vector2(x, y);
        this.direction = DIRECTIONS.UP;

        // НОВОЕ: Система прокачки для игрока
        if (type === 'player') {
            this.playerLevel = 1;
            this.experience = 0;
            this.upgrade = PLAYER_UPGRADES.LEVEL_1;

            this.speed = this.upgrade.speed;
            this.color = this.upgrade.color;
            this.health = this.upgrade.health;
            this.bulletSpeed = this.upgrade.bulletSpeed;
            this.reloadTime = this.upgrade.reloadTime;
            this.bulletPower = this.upgrade.bulletPower;
            this.canDestroyConcrete = this.upgrade.canDestroyConcrete;
        } else {
            // Характеристики врагов в зависимости от типа и уровня
            const enemyConfig = ENEMY_TYPES[enemyType];
            const levelMultiplier = level === 1 ? 1 : 1.2;

            this.speed = enemyConfig.speed * TANK_SPEED * levelMultiplier;
            this.color = enemyConfig.color;
            this.health = enemyConfig.health;
            this.bulletSpeed = enemyConfig.bulletSpeed;
            this.reloadTime = enemyConfig.reloadTime;
            this.bulletPower = 1;
            this.canDestroyConcrete = false;
        }

        this.type = type;
        this.enemyType = enemyType;
        this.size = TILE_SIZE - 8;
        this.canShoot = true;
        this.username = type === 'enemy' ? this.generateEnemyName(enemyType) : '';
        this.spawnProtection = 0;
        this.shield = null;
        this.isDestroyed = false;
        this.stuckTimer = 0;

        // Свойства для танков с бонусами
        this.hasBonus = false;
        this.bonusType = null;
        this.blinkTimer = 0;
        this.blinkAlpha = 1.0;
        this.blinkDirection = -1;

        // Свойства для неуязвимости
        this.isInvincible = false;
        this.invincibilityTimer = 0;
        this.invincibilityDuration = 0;
        this.invincibilityBlink = 0;

        // Свойства для автонаведения
        this.hasAutoAim = false;
        this.autoAimTimer = 0;
        this.autoAimDuration = 0;
        this.autoAimBlink = 0;

        // Добавляем свойство заморозки
        this.isFrozen = false;
        this.freezeProgress = 0;
        this.freezeStartTime = 0;
        this.freezeDuration = 0;
        this.iceCrystals = [];

        // НОВОЕ: Свойства для анти-застревания
        this.stuckCheckTimer = 0;
        this.lastPosition = new Vector2(x, y);
        this.stuckTime = 0;
        this.escapeAttempts = 0;

        // НОВОЕ: Свойства для ИИ
        this.aiLevel = ENEMY_AI_LEVELS.BASIC;
        this.ai = null; // Будет создан позже
        this.currentDirectionTime = 0;
        this.maxDirectionTime = 90; // 3 секунды при 30 FPS

        // ИСПРАВЛЕНИЕ: Правильная инициализация патрулирования
        if (type === 'enemy') {
            this.patrolState = 'MOVING'; // Начинаем с движения!
            this.patrolTimer = 0;
            this.nextStateChangeTime = 0;
            this.lookAroundDirection = this.direction;
            this.lookAroundProgress = 0;

            // Устанавливаем время первого перехода
            const now = Date.now();
            const initialMoveTime = PATROL_BEHAVIOR.MOVE_MIN_TIME +
            Math.random() * (PATROL_BEHAVIOR.MOVE_MAX_TIME - PATROL_BEHAVIOR.MOVE_MIN_TIME);
            this.nextStateChangeTime = now + initialMoveTime;
        }

        // Для врагов определяем, есть ли бонус
        if (type === 'enemy') {
            this.determineBonus();
        }

        // УБЕДИТЕСЬ что этот код есть для врагов:
        if (type === 'enemy') {
            this.levelStats = {
                shots: 0,
                wallsDestroyed: 0,
                playerKills: 0,
                baseDestroyed: false,
                totalScore: 0
            };
        }

        // НОВОЕ: Система следов и памяти пути (только для врагов с базовым ИИ)
        if (type === 'enemy') {
            this.tracks = []; // Массив следов гусениц
            this.lastTrackPos = new Vector2(x, y);
            this.pathMemory = new Map(); // Карта запомненных позиций
            this.memoryTimer = 0;
        }

        // ПЕРЕИМЕНОВАЛ: защита → атака
        this.isInBaseZone = false;
        this.baseAttackMode = false;  // БЫЛО: baseDefenseMode
        this.redLightBlink = 0;
        this.baseZoneEntryTime = 0;
    }

    // Метод для получения направления стрельбы к базе
    getBaseShootDirection() {
        if (!this.isInBaseZone || !game || !game.map.basePosition) return null;

        if (!this.isInBaseZone || !game || !game.map.basePosition) return null;

        const basePos = game.map.basePosition;
        const baseZone = game.getZoneId(basePos.x * TILE_SIZE + TILE_SIZE/2, basePos.y * TILE_SIZE + TILE_SIZE/2);
        const currentZone = game.getZoneId(this.position.x, this.position.y);

        console.log(`🎯 ${this.username} в зоне [${currentZone.x},${currentZone.y}], база в [${baseZone.x},${baseZone.y}]`);

        // Логика направлений как ты описал
        if (currentZone.y === 7) {
            // Нижний ряд - база слева или справа
            if (currentZone.x <= 3) return DIRECTIONS.RIGHT;  // [2,7], [3,7] → вправо
            if (currentZone.x >= 5) return DIRECTIONS.LEFT;   // [5,7], [6,7] → влево
        }

        if (currentZone.y === 5) {
            // Верхний ряд - база снизу
            return DIRECTIONS.DOWN;  // [3,5], [4,5], [5,5] → вниз
        }

        if (currentZone.y === 6) {
            // Средний ряд
            if (currentZone.x <= 2) return DIRECTIONS.RIGHT;  // [2,6] → вправо
            if (currentZone.x >= 6) return DIRECTIONS.LEFT;   // [6,6] → влево
        }

        // По умолчанию - в сторону базы
        const dx = basePos.x * TILE_SIZE - this.position.x;
        const dy = basePos.y * TILE_SIZE - this.position.y;

        if (Math.abs(dx) > Math.abs(dy)) {
            return dx > 0 ? DIRECTIONS.RIGHT : DIRECTIONS.LEFT;
        } else {
            return dy > 0 ? DIRECTIONS.DOWN : DIRECTIONS.UP;
        }
    }

    // Метод для добавления следа гусениц
    addTrack() {
        if (this.type !== 'enemy') return;

        const distance = Math.sqrt(
            Math.pow(this.position.x - this.lastTrackPos.x, 2) +
            Math.pow(this.position.y - this.lastTrackPos.y, 2)
        );

        // Добавляем след только если проехали достаточное расстояние
        if (distance >= TRACK_SYSTEM.TRACK_SPACING) {
            this.tracks.push({
                x: this.position.x,
                y: this.position.y,
                direction: this.direction,
                lifetime: TRACK_SYSTEM.TRACK_LIFETIME,
                alpha: 1.0,
                initialLifetime: TRACK_SYSTEM.TRACK_LIFETIME // Сохраняем начальное время
            });
            this.lastTrackPos = this.position.clone();

            // Ограничиваем количество следов
            if (this.tracks.length > 40) {
                this.tracks.shift();
            }
        }
    }

    // Метод для обновления следов
    updateTracks() {
        if (this.type !== 'enemy') return;

        for (let i = this.tracks.length - 1; i >= 0; i--) {
            this.tracks[i].lifetime--;

            // ПЛАВНОЕ ИСЧЕЗНОВЕНИЕ - без резких изменений
            this.tracks[i].alpha = this.tracks[i].lifetime / this.tracks[i].initialLifetime;

            // Удаляем старые следы
            if (this.tracks[i].lifetime <= 0) {
                this.tracks.splice(i, 1);
            }
        }
    }

    // Метод для запоминания текущей позиции
    rememberPosition() {
        if (this.type !== 'enemy' || this.aiLevel !== ENEMY_AI_LEVELS.BASIC) return;

        const gridX = Math.floor(this.position.x / TRACK_SYSTEM.MEMORY_GRID_SIZE);
        const gridY = Math.floor(this.position.y / TRACK_SYSTEM.MEMORY_GRID_SIZE);
        const key = `${gridX},${gridY}`;

        // Запоминаем позицию с временной меткой
        this.pathMemory.set(key, {
            timestamp: this.memoryTimer,
            visits: (this.pathMemory.get(key)?.visits || 0) + 1
        });
    }

    // Метод для проверки, был ли танк в этой позиции недавно
    hasBeenHereRecently(x, y) {
        if (this.type !== 'enemy' || this.aiLevel !== ENEMY_AI_LEVELS.BASIC) return false;

        const gridX = Math.floor(x / TRACK_SYSTEM.MEMORY_GRID_SIZE);
        const gridY = Math.floor(y / TRACK_SYSTEM.MEMORY_GRID_SIZE);
        const key = `${gridX},${gridY}`;

        const memory = this.pathMemory.get(key);
        if (!memory) return false;

        // Проверяем, не посещали ли мы эту ячейку недавно
        const timeSinceVisit = this.memoryTimer - memory.timestamp;
        return timeSinceVisit < TRACK_SYSTEM.MEMORY_DECAY_TIME && memory.visits > 2;
    }

    // Метод для получения "штрафа" за посещенную позицию
    getPositionPenalty(x, y) {
        if (this.type !== 'enemy' || this.aiLevel !== ENEMY_AI_LEVELS.BASIC) return 0;

        const gridX = Math.floor(x / TRACK_SYSTEM.MEMORY_GRID_SIZE);
        const gridY = Math.floor(y / TRACK_SYSTEM.MEMORY_GRID_SIZE);
        const key = `${gridX},${gridY}`;

        const memory = this.pathMemory.get(key);
        if (!memory) return 0;

        const timeSinceVisit = this.memoryTimer - memory.timestamp;
        if (timeSinceVisit < TRACK_SYSTEM.MEMORY_DECAY_TIME) {
            // Чем чаще посещали и чем недавно - тем больше штраф
            const recency = 1 - (timeSinceVisit / TRACK_SYSTEM.MEMORY_DECAY_TIME);
            return memory.visits * recency * 50; // Штраф от 0 до 100+
        }

        return 0;
    }

    // Метод для отрисовки следов гусениц
    drawTracks(ctx) {
        if (this.type !== 'enemy' || this.tracks.length === 0) return;

        ctx.save();

        this.tracks.forEach(track => {
            ctx.save();
            ctx.translate(track.x, track.y);

            // Поворачиваем в направлении движения
            let angle = 0;
            if (track.direction === DIRECTIONS.RIGHT) angle = Math.PI / 2;
            else if (track.direction === DIRECTIONS.DOWN) angle = Math.PI;
            else if (track.direction === DIRECTIONS.LEFT) angle = -Math.PI / 2;
            ctx.rotate(angle);

            // Рисуем след гусеницы - более реалистичный
            ctx.globalAlpha = track.alpha * 0.4; // Постоянная прозрачность

            // Цвет следа - темно-серый как настоящая грязь
            ctx.fillStyle = '#333333';

            // Две параллельные линии - гусеницы (более тонкие)
            const trackWidth = this.size * 0.5;
            const trackHeight = this.size * 0.08;
            const spacing = this.size * 0.25;

            // Левая гусеница
            ctx.fillRect(-trackWidth/2, -spacing/2, trackWidth, trackHeight);
            // Правая гусеница
            ctx.fillRect(-trackWidth/2, spacing/2 - trackHeight, trackWidth, trackHeight);

            // ТЕКСТУРА СЛЕДА - добавляем неровности
            ctx.globalAlpha = track.alpha * 0.2;
            ctx.fillStyle = '#555555';

            // Случайные пятна на следах для реалистичности
            for (let i = 0; i < 3; i++) {
                const spotX = -trackWidth/2 + Math.random() * trackWidth;
                const spotY = -spacing/2 + Math.random() * trackHeight;
                const spotSize = 2 + Math.random() * 3;
                ctx.fillRect(spotX, spotY, spotSize, spotSize);
            }

            for (let i = 0; i < 3; i++) {
                const spotX = -trackWidth/2 + Math.random() * trackWidth;
                const spotY = spacing/2 - trackHeight + Math.random() * trackHeight;
                const spotSize = 2 + Math.random() * 3;
                ctx.fillRect(spotX, spotY, spotSize, spotSize);
            }

            ctx.restore();
        });

        ctx.restore();
    }

    // Метод для отрисовки визуализации памяти пути (для дебага)
    drawPathMemory(ctx) {
        if (this.type !== 'enemy' || this.aiLevel !== ENEMY_AI_LEVELS.BASIC) return;
        if (!this.debugShowMemory) return;

        ctx.save();

        this.pathMemory.forEach((memory, key) => {
            const [gridX, gridY] = key.split(',').map(Number);
            const x = gridX * TRACK_SYSTEM.MEMORY_GRID_SIZE;
            const y = gridY * TRACK_SYSTEM.MEMORY_GRID_SIZE;

            const timeSinceVisit = this.memoryTimer - memory.timestamp;
            if (timeSinceVisit < TRACK_SYSTEM.MEMORY_DECAY_TIME) {
                const alpha = 0.3 * (1 - timeSinceVisit / TRACK_SYSTEM.MEMORY_DECAY_TIME);
                const intensity = Math.min(memory.visits / 5, 1);

                ctx.globalAlpha = alpha;
                ctx.fillStyle = `rgba(255, ${255 - intensity * 200}, 0, ${alpha})`;
                ctx.fillRect(
                    x - TRACK_SYSTEM.MEMORY_GRID_SIZE/2,
                    y - TRACK_SYSTEM.MEMORY_GRID_SIZE/2,
                    TRACK_SYSTEM.MEMORY_GRID_SIZE,
                    TRACK_SYSTEM.MEMORY_GRID_SIZE
                );

                // Показываем количество посещений
                ctx.globalAlpha = alpha * 0.8;
                ctx.fillStyle = '#FFFFFF';
                ctx.font = '8px Arial';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(memory.visits.toString(), x, y);
            }
        });

        ctx.restore();
    }

    // ИСПРАВЛЕННЫЙ МЕТОД: Обновление состояния патрулирования
    updatePatrolState() {
        if (this.type !== 'enemy' || this.isDestroyed || this.isFrozen) return;

        const now = Date.now();

        // Если пришло время сменить состояние
        if (now >= this.nextStateChangeTime) {
            this.changePatrolState();
        }

        // Обновление текущего состояния
        switch (this.patrolState) {
            case 'LOOKING_AROUND':
                this.updateLookAround();
                break;
            case 'STOPPED':
                // Просто стоим на месте
                break;
            case 'MOVING':
                // Движение обрабатывается в основном update
                break;
        }
    }

    // ИСПРАВЛЕННЫЙ МЕТОД: Смена состояния патрулирования
    changePatrolState() {
        const now = Date.now();

        switch (this.patrolState) {
            case 'MOVING':
                // Решаем, что делать после движения
                if (Math.random() < PATROL_BEHAVIOR.LOOK_AROUND_CHANCE) {
                    // Осматриваемся
                    this.patrolState = 'LOOKING_AROUND';
                    this.lookAroundDirection = this.direction;
                    this.lookAroundProgress = 0;
                    const lookTime = PATROL_BEHAVIOR.STOP_MIN_TIME +
                    Math.random() * (PATROL_BEHAVIOR.STOP_MAX_TIME - PATROL_BEHAVIOR.STOP_MIN_TIME);
                    this.nextStateChangeTime = now + lookTime;
                } else {
                    // Просто стоим
                    this.patrolState = 'STOPPED';
                    const stopTime = PATROL_BEHAVIOR.STOP_MIN_TIME +
                    Math.random() * (PATROL_BEHAVIOR.STOP_MAX_TIME - PATROL_BEHAVIOR.STOP_MIN_TIME);
                    this.nextStateChangeTime = now + stopTime;
                }
                break;

            case 'STOPPED':
            case 'LOOKING_AROUND':
                // Возвращаемся к движению
                this.patrolState = 'MOVING';
                const moveTime = PATROL_BEHAVIOR.MOVE_MIN_TIME +
                Math.random() * (PATROL_BEHAVIOR.MOVE_MAX_TIME - PATROL_BEHAVIOR.MOVE_MIN_TIME);
                this.nextStateChangeTime = now + moveTime;

                // С вероятностью меняем направление после остановки
                if (Math.random() < PATROL_BEHAVIOR.DIRECTION_CHANGE_ON_STOP) {
                    this.changeRandomDirection();
                }
                break;
        }

        //console.log(`🎯 ${this.username} -> ${this.getPatrolStateName()}`);
    }

    // НОВЫЙ МЕТОД: Обновление осмотра вокруг
    updateLookAround() {
        this.lookAroundProgress += 0.02; // Скорость осмотра

        if (this.lookAroundProgress >= 1) {
            this.lookAroundProgress = 0;
            this.cycleLookAroundDirection();
        }
    }

    // НОВЫЙ МЕТОД: Циклическое изменение направления при осмотре
    cycleLookAroundDirection() {
        const directions = [DIRECTIONS.UP, DIRECTIONS.RIGHT, DIRECTIONS.DOWN, DIRECTIONS.LEFT];
        const currentIndex = directions.findIndex(dir =>
        dir.x === this.lookAroundDirection.x && dir.y === this.lookAroundDirection.y
        );

        const nextIndex = (currentIndex + 1) % directions.length;
        this.lookAroundDirection = directions[nextIndex];
    }

    // НОВЫЙ МЕТОД: Случайная смена направления
    changeRandomDirection() {
        const directions = Object.values(DIRECTIONS);
        const availableDirections = directions.filter(dir => dir !== this.direction);
        this.direction = availableDirections[Math.floor(Math.random() * availableDirections.length)];
    }

    // НОВЫЙ МЕТОД: Получение имени состояния для отладки
    getPatrolStateName() {
        const states = {
            'MOVING': '🚗 Движение',
            'STOPPED': '🛑 Остановка',
            'LOOKING_AROUND': '👀 Осмотр'
        };
        return states[this.patrolState] || this.patrolState;
    }

    // ОБНОВЛЯЕМ методы учета статистики с отладкой
    recordShot() {
        if (this.type === 'enemy' && this.levelStats) {
            this.levelStats.shots++;
            this.calculateTotalScore();
        }
    }

    recordWallDestroyed(count = 1) {
        if (this.type === 'enemy' && this.levelStats) {
            this.levelStats.wallsDestroyed += count;
            this.calculateTotalScore();
        }
    }

    recordPlayerKill() {
        if (this.type === 'enemy' && this.levelStats) {
            this.levelStats.playerKills++;
            this.calculateTotalScore();
        }
    }

    recordBaseDestroyed() {
        if (this.type === 'enemy' && this.levelStats) {
            this.levelStats.baseDestroyed = true;
            this.calculateTotalScore();
        }
    }

    calculateTotalScore() {
        if (this.type === 'enemy' && this.levelStats) {
            this.levelStats.totalScore =
            (this.levelStats.shots * LEVEL_STATS_POINTS.SHOT) +
            (this.levelStats.wallsDestroyed * LEVEL_STATS_POINTS.WALL_DESTROYED) +
            (this.levelStats.playerKills * LEVEL_STATS_POINTS.PLAYER_KILL) +
            (this.levelStats.baseDestroyed ? LEVEL_STATS_POINTS.BASE_DESTROYED : 0);
        }
    }

    // НОВЫЙ МЕТОД: Сброс статистики
    resetLevelStats() {
        if (this.type === 'enemy') {
            this.levelStats = {
                shots: 0,
                wallsDestroyed: 0,
                playerKills: 0,
                baseDestroyed: false,
                totalScore: 0
            };
        }
    }

    // НОВЫЙ МЕТОД: Инициализация ИИ
    initAI() {
        if (this.type !== 'enemy') return;

        if (this.aiLevel === ENEMY_AI_LEVELS.BASIC) {
            this.ai = new BasicEnemyAI(this);
        } else {
            this.ai = new EnemyAI(this);
        }
    }

    // НОВЫЙ МЕТОД: Определение уровня ИИ на основе уровня игры
    setAILevel(gameLevel) {
        if (gameLevel <= 5) {
            this.aiLevel = ENEMY_AI_LEVELS.BASIC;
        } else {
            this.aiLevel = ENEMY_AI_LEVELS.ADVANCED;
        }

        // Переинициализируем ИИ
        this.initAI();
    }

    // ИСПРАВЛЯЕМ метод canSeePlayer
    canSeePlayer(player, map) {
        if (!player || player.isDestroyed || !map) return false;

        const visionRange = VISION_RANGES[this.enemyType] || VISION_RANGES.BASIC;

        // Проверяем расстояние
        const distance = Math.sqrt(
            Math.pow(this.position.x - player.position.x, 2) +
            Math.pow(this.position.y - player.position.y, 2)
        );

        if (distance > visionRange) return false;

        // Проверяем линию видимости (прямую без препятствий)
        return this.hasLineOfSight(player.position.x, player.position.y, map);
    }

    // НОВЫЙ МЕТОД: Проверка прямой видимости
    hasLineOfSight(targetX, targetY, map) {
        if (!map || !map.checkCollision) return false;

        // Используем алгоритм Брезенхема для проверки линии
        const steps = 20; // Количество проверок вдоль линии
        const dx = (targetX - this.position.x) / steps;
        const dy = (targetY - this.position.y) / steps;

        for (let i = 1; i < steps; i++) {
            const checkX = this.position.x + dx * i;
            const checkY = this.position.y + dy * i;

            // Создаем маленький прямоугольник для проверки столкновения
            const checkBounds = new Rectangle(checkX - 2, checkY - 2, 4, 4);

            // Если на пути есть препятствие - видимости нет
            if (map.checkCollision(checkBounds)) {
                return false;
            }
        }

        return true;
    }

    // ОБНОВЛЯЕМ метод addExperience
    addExperience(enemyType) {
        if (this.type !== 'player') return;

        const expGained = EXP_PER_KILL[enemyType] || 10;
        this.experience += expGained;

        console.log(`🎯 +${expGained} опыта за уничтожение ${enemyType} танка. Всего: ${this.experience}`);

        // Проверяем возможность апгрейда
        this.checkLevelUp();
    }

    // ОБНОВЛЯЕМ метод checkLevelUp
    checkLevelUp() {
        const nextLevel = this.playerLevel + 1;
        const expRequired = EXP_REQUIREMENTS[nextLevel];

        if (expRequired && this.experience >= expRequired) {
            this.upgradeToLevel(nextLevel);
            // После апгрейда снова проверяем, не можем ли мы подняться еще
            this.checkLevelUp();
        }
    }

    // УПРОЩАЕМ метод upgradeToLevel
    upgradeToLevel(newLevel) {
        const upgradeKey = `LEVEL_${newLevel}`;
        const newUpgrade = PLAYER_UPGRADES[upgradeKey];

        if (!newUpgrade) return;

        this.playerLevel = newLevel;
        this.upgrade = newUpgrade;

        // Обновляем характеристики
        this.speed = newUpgrade.speed;
        this.color = newUpgrade.color;
        this.bulletSpeed = newUpgrade.bulletSpeed;
        this.reloadTime = newUpgrade.reloadTime;
        this.bulletPower = newUpgrade.bulletPower;
        this.canDestroyConcrete = newUpgrade.canDestroyConcrete;

        // Добавляем здоровье если есть бонус
        if (newUpgrade.health > this.health) {
            this.health = newUpgrade.health;
        }

        console.log(`🚀 Апгрейд до ${newUpgrade.name}! Уровень ${newLevel}`);

        // НОВОЕ: Обновляем статистику в game
        if (typeof game !== 'undefined') {
            game.updatePlayerLevel(newLevel);
        }

        // Визуальный эффект апгрейда
        this.showUpgradeEffect();
    }

    // НОВЫЙ МЕТОД: Визуальный эффект при апгрейде
    showUpgradeEffect() {
        if (typeof game !== 'undefined') {
            // Создаем взрыв для эффекта
            game.effectManager.addExplosion(this.position.x, this.position.y, 'bonus');
            game.screenShake = 15;

            // Показываем сообщение
            this.showUpgradeMessage();
        }
    }

    // НОВЫЙ МЕТОД: Показ сообщения об апгрейде
    showUpgradeMessage() {
        const message = `🚀 ${this.upgrade.name}! Уровень ${this.playerLevel}`;
        console.log(message);

        // Можно добавить всплывающее сообщение в UI
        if (typeof game !== 'undefined' && game.showUpgradeNotification) {
            game.showUpgradeNotification(message);
        }
    }

    // НОВЫЙ МЕТОД: Активация автонаведения
    activateAutoAim(duration = 15000) { // Добавляем значение по умолчанию
        if (this.type !== 'player') return;

        this.hasAutoAim = true;
        this.autoAimDuration = duration || 15000; // Защита от undefined
        this.autoAimTimer = 0;
        this.autoAimBlink = 0;
        console.log(`🎯 Активировано автонаведение на ${this.autoAimDuration/1000}сек`);
    }

    // В классе Tank ИСПРАВЛЯЕМ метод updateAutoAim:
    updateAutoAim() {
        if (this.hasAutoAim) {
            this.autoAimTimer += 16; // ~60 FPS

            // Защита от NaN
            if (isNaN(this.autoAimTimer)) this.autoAimTimer = 0;
            if (isNaN(this.autoAimDuration)) this.autoAimDuration = 15000;

            this.autoAimBlink++;

            // ИСПРАВЛЕНИЕ: Правильная проверка истечения времени
            if (this.autoAimTimer >= this.autoAimDuration) {
                this.hasAutoAim = false;
                this.autoAimTimer = 0;
                this.autoAimDuration = 0;
                console.log('🎯 Автонаведение закончилось');

                // Принудительно обновляем UI
                if (typeof game !== 'undefined') {
                    game.updateStatusIndicators();
                }
            }
        }
    }

    // НОВЫЙ МЕТОД: Определяем, будет ли у танка бонус
    determineBonus() {
        if (Math.random() < (typeof BONUS_TANK_CHANCE !== 'undefined' ? BONUS_TANK_CHANCE : 0.2)) {
            this.hasBonus = true;
            const bonusTypes = Object.values(BONUS_TYPES || {
                LIFE: { id: 'LIFE', symbol: '❤️', color: '#FF4081' },
                SHIELD: { id: 'SHIELD', symbol: '🛡️', color: '#00BFFF' },
                TIME_STOP: { id: 'TIME_STOP', symbol: '⏰', color: '#00FFFF' }
            });
            this.bonusType = bonusTypes[Math.floor(Math.random() * bonusTypes.length)];
            console.log(`🎯 Танк ${this.username} несет бонус: ${this.bonusType.id}`);
        }
    }

    // НОВЫЙ МЕТОД: Плавное мигание
    updateBlink() {
        if (this.hasBonus && this.type === 'enemy') {
            this.blinkTimer++;

            // Изменяем прозрачность плавно
            const blinkSpeed = 0.08;
            this.blinkAlpha += this.blinkDirection * blinkSpeed;

            // Ограничиваем прозрачность от 0.5 до 1.0
            if (this.blinkAlpha <= 0.5) {
                this.blinkAlpha = 0.5;
                this.blinkDirection = 1;
            } else if (this.blinkAlpha >= 1.0) {
                this.blinkAlpha = 1.0;
                this.blinkDirection = -1;
            }
        }
    }

    // Генерация имени в зависимости от типа врага
    generateEnemyName(enemyType) {
        const typeNames = ENEMY_NAMES[enemyType] || ['Враг'];
        return typeNames[Math.floor(Math.random() * typeNames.length)];
    }

    // НОВЫЙ МЕТОД: Активация неуязвимости
    activateInvincibility(duration = 10000) {
        this.isInvincible = true;
        this.invincibilityDuration = duration;
        this.invincibilityTimer = 0;
        this.invincibilityBlink = 0;
        console.log(`🛡️ Активирована неуязвимость на ${duration/1000}сек`);
    }

    // НОВЫЙ МЕТОД: Обновление неуязвимости
    updateInvincibility() {
        if (this.isInvincible) {
            this.invincibilityTimer += 16; // примерно 60 FPS
            this.invincibilityBlink++;

            if (this.invincibilityTimer >= this.invincibilityDuration) {
                this.isInvincible = false;
                console.log('🛡️ Неуязвимость закончилась');
            }
        }
    }

    // ОБНОВЛЯЕМ метод takeDamage для учета дополнительного здоровья
    takeDamage() {
        if (this.hasShield() || this.isInvincible) {
            console.log('🛡️ Урон заблокирован щитом/неуязвимостью');
            return false;
        }

        this.health--;
        if (this.health <= 0) {
            this.isDestroyed = true;
            if (this.hasBonus) {
                return 'bonus';
            }
            return true;
        } else {
            console.log(`❤️ Осталось здоровья: ${this.health}`);
            return false;
        }
    }

    // ОБНОВЛЯЕМ метод update
    update() {
        if (this.isDestroyed) return;

        // Проверка нахождения в зоне базы
        if (this.type === 'enemy' && game) {
            const wasInBaseZone = this.isInBaseZone;
            this.isInBaseZone = game.isInBaseProtectedZone(this.position.x, this.position.y);

            if (this.isInBaseZone && !wasInBaseZone) {
                // Только что вошел в зону базы - ВКЛЮЧАЕМ РЕЖИМ АТАКИ!
                this.baseAttackMode = true;
                this.baseZoneEntryTime = Date.now();
                console.log(`💥 ${this.username} вошел в зону базы! РЕЖИМ АТАКИ!`);
            }

            if (!this.isInBaseZone && wasInBaseZone) {
                // Вышел из зоны базы
                this.baseAttackMode = false;
                console.log(`💥 ${this.username} вышел из зоны базы`);
            }

            // Обновляем мигание лампочки
            if (this.baseAttackMode) {
                this.redLightBlink++;
            }
        }

        // ОБНОВЛЯЕМ ПЕРВЫМ: систему патрулирования для врагов с базовым ИИ
        if (this.type === 'enemy' && this.aiLevel === ENEMY_AI_LEVELS.BASIC) {
            this.updatePatrolState();
        }

        // НОВОЕ: Обновляем систему следов и памяти
        if (this.type === 'enemy') {
            this.updateTracks();
            this.memoryTimer++;

            // Добавляем следы каждые несколько кадров
            if (this.memoryTimer % 3 === 0) {
                this.addTrack();
                this.rememberPosition();
            }
        }

        // ОБНОВЛЯЕМ ПЕРВЫМ: систему патрулирования для врагов с базовым ИИ
        if (this.type === 'enemy' && this.aiLevel === ENEMY_AI_LEVELS.BASIC) {
            this.updatePatrolState();
        }

        // ОБНОВЛЯЕМ ИИ для врагов
        if (this.type === 'enemy' && typeof game !== 'undefined') {
            this.setAILevel(game.level);
        }

        // Обновляем эффект заморозки
        if (this.isFrozen) {
            const elapsed = Date.now() - this.freezeStartTime;
            const progress = elapsed / this.freezeDuration;

            if (progress >= 1) {
                // Размораживаем
                this.isFrozen = false;
                this.speed = this.originalSpeed;
                this.canShoot = this.originalCanShoot;
                this.iceCrystals = [];
                console.log('❄️ Танк разморожен');
            } else {
                // Обновляем прогресс заморозки/таяния
                if (progress < 0.1) {
                    // Быстрое замерзание (1.2 секунды)
                    this.freezeProgress = progress * 10;
                } else if (progress > 0.92) {
                    // Медленное таяние (1 секунда) - синхронизируем со звуком
                    this.freezeProgress = 1 - ((progress - 0.92) * 12.5);
                } else {
                    // Полная заморозка
                    this.freezeProgress = 1;
                }

                // Обновляем кристаллы
                this.updateIceCrystals();
            }
            return;
        }

        // Обновляем неуязвимость
        this.updateInvincibility();

        // Обновляем автонаведение
        this.updateAutoAim();

        if (this.spawnProtection > 0) {
            this.spawnProtection--;
        }

        // Обновляем щит
        if (this.shield) {
            if (!this.shield.update()) {
                this.shield = null;
            }
        }

        if (!this.canShoot) {
            this.reloadTime--;
            if (this.reloadTime <= 0) {
                this.canShoot = true;
            }
        }

        if (this.stuckTimer < 100) {
            this.stuckTimer++;
        }

        if (this.hasBonus && this.type === 'enemy') {
            this.updateBlink();
        }
    }

    // ОБНОВЛЯЕМ метод для врагов (будет вызываться из EnemyManager)
    updateEnemyAI(map, otherTanks, brickFragments, player) {
        if (this.isDestroyed || this.type !== 'enemy' || !map || this.isFrozen) return;

        // Инициализируем ИИ если еще не создан
        if (!this.ai) {
            this.initAI();
        }

        if (this.ai) {
            this.ai.update(map, player, otherTanks, brickFragments);
        }
    }

    // НОВЫЙ МЕТОД: Проверка застревания (упрощенная версия)
    checkIfStuck() {
        this.stuckCheckTimer++;

        // Проверяем каждые 30 кадров
        if (this.stuckCheckTimer >= 30) {
            this.stuckCheckTimer = 0;

            // Вычисляем расстояние от последней позиции
            const distanceMoved = Math.sqrt(
                Math.pow(this.position.x - this.lastPosition.x, 2) +
                Math.pow(this.position.y - this.lastPosition.y, 2)
            );

            // Если танк почти не двигался - он застрял
            if (distanceMoved < 2) {
                this.stuckTime++;

                // Если застрял более 5 секунд - пытаемся спасти
                if (this.stuckTime > 10) { // 10 * 30 кадров = ~5 секунд
                    this.attemptEscape();
                }
            } else {
                // Двигается нормально - сбрасываем таймер
                this.stuckTime = 0;
                this.escapeAttempts = 0;
            }

            // Сохраняем текущую позицию для следующей проверки
            this.lastPosition = this.position.clone();
        }
    }

    // НОВЫЙ МЕТОД: Попытка выхода из застревания
    attemptEscape() {
        this.escapeAttempts++;
        console.log(`🆘 Танк ${this.username} застрял! Попытка спасения #${this.escapeAttempts}`);

        // Пытаемся телепортировать в случайную безопасную позицию
        if (this.escapeAttempts <= 3) {
            if (this.tryFindSafePosition()) {
                console.log(`✅ Танк ${this.username} спасен!`);
                this.stuckTime = 0;
                this.escapeAttempts = 0;
            }
        } else {
            // Если не удалось спасти после 3 попыток - уничтожаем
            console.log(`💥 Танк ${this.username} уничтожен из-за застревания`);
            this.isDestroyed = true;
        }
    }

    // НОВЫЙ МЕТОД: Поиск безопасной позиции
    tryFindSafePosition() {
        if (typeof game === 'undefined' || !game.map) return false;

        const attempts = 10;

        for (let i = 0; i < attempts; i++) {
            // Пытаемся найти позицию в пределах игрового поля
            const newX = TILE_SIZE + Math.random() * (CANVAS_WIDTH - TILE_SIZE * 2);
            const newY = TILE_SIZE + Math.random() * (CANVAS_HEIGHT - TILE_SIZE * 2);

            const testBounds = new Rectangle(
                newX - this.size/2 + 2,
                newY - this.size/2 + 2,
                this.size - 4,
                this.size - 4
            );

            // Проверяем что позиция свободна
            if (!game.map.checkCollision(testBounds) &&
                !this.checkTankCollisionAtPosition(newX, newY) &&
                this.isPositionInBounds(newX, newY)) {

                // Нашли безопасную позицию - телепортируем
                this.position.x = newX;
            this.position.y = newY;
            return true;
                }
        }

        return false;
    }

    // НОВЫЙ МЕТОД: Проверка столкновения с другими танками на позиции
    checkTankCollisionAtPosition(testX, testY) {
        if (typeof game === 'undefined') return false;

        const testBounds = new Rectangle(
            testX - this.size/2 + 2,
            testY - this.size/2 + 2,
            this.size - 4,
            this.size - 4
        );

        // Проверяем столкновение с игроком
        if (!game.player.isDestroyed && testBounds.intersects(game.player.getBounds())) {
            return true;
        }

        // Проверяем столкновение с другими врагами
        if (game.enemyManager && game.enemyManager.enemies) {
            for (const enemy of game.enemyManager.enemies) {
                if (enemy !== this && !enemy.isDestroyed && testBounds.intersects(enemy.getBounds())) {
                    return true;
                }
            }
        }

        return false;
    }

    // НОВЫЙ МЕТОД: Проверка что позиция в пределах игрового поля
    isPositionInBounds(x, y) {
        return x >= TILE_SIZE + this.size/2 &&
        x <= CANVAS_WIDTH - TILE_SIZE - this.size/2 &&
        y >= TILE_SIZE + this.size/2 &&
        y <= CANVAS_HEIGHT - TILE_SIZE - this.size/2;
    }

    updateIceCrystals() {
        this.iceCrystals.forEach(crystal => {
            crystal.rotation += 0.02;
            crystal.pulse += 0.1;
            crystal.growth = Math.min(1, crystal.growth + 0.1);
            crystal.alpha = this.freezeProgress;
        });
    }

    // НОВЫЙ МЕТОД: Поиск ближайшего врага для автонаведения
    findNearestTarget(enemies, map) {
        if (!this.hasAutoAim || !enemies || enemies.length === 0) return null;

        let nearestEnemy = null;
        let nearestDistance = Infinity;

        enemies.forEach(enemy => {
            if (enemy.isDestroyed) return;

            const distance = Math.sqrt(
                Math.pow(this.position.x - enemy.position.x, 2) +
                Math.pow(this.position.y - enemy.position.y, 2)
            );

            // Проверяем прямую видимость (упрощенно)
            if (this.hasLineOfSight(enemy.position.x, enemy.position.y, map) && distance < nearestDistance) {
                nearestDistance = distance;
                nearestEnemy = enemy;
            }
        });

        return nearestEnemy;
    }

    // ОБНОВЛЯЕМ метод resolveTankCollision для предотвращения выталкивания за границы
    resolveTankCollision(otherTank) {
        const dx = this.position.x - otherTank.position.x;
        const dy = this.position.y - otherTank.position.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance === 0) return;

        const minDistance = this.size;
        const overlap = minDistance - distance;

        if (overlap > 0) {
            const pushX = (dx / distance) * overlap * 0.5;
            const pushY = (dy / distance) * overlap * 0.5;

            // НОВОЕ: Проверяем границы перед применением отталкивания
            const newThisX = this.position.x + pushX;
            const newThisY = this.position.y + pushY;
            const newOtherX = otherTank.position.x - pushX;
            const newOtherY = otherTank.position.y - pushY;

            // Применяем отталкивание только если новые позиции в пределах поля
            if (this.isPositionInBounds(newThisX, newThisY)) {
                this.position.x = newThisX;
                this.position.y = newThisY;
            }

            if (otherTank.isPositionInBounds(newOtherX, newOtherY)) {
                otherTank.position.x = newOtherX;
                otherTank.position.y = newOtherY;
            }

            this.stuckTimer = 0;
            otherTank.stuckTimer = 0;
        }
    }

    // НОВЫЕ МЕТОДЫ ДЛЯ АКТИВАЦИИ БОНУСОВ
    activateShield(duration = 5000) { // duration в миллисекундах
        this.shield = new ShieldEffect(this);
        this.shield.duration = duration; // Устанавливаем нужную длительность
        console.log(`🛡️ Активирован щит на ${duration/1000}сек`);
    }

    // Добавляем метод заморозки
    freeze(duration) {
        if (this.type !== 'enemy') return;

        this.isFrozen = true;
        this.freezeStartTime = Date.now();
        this.freezeDuration = duration;
        this.originalSpeed = this.speed;
        this.originalCanShoot = this.canShoot;
        this.speed = 0;
        this.canShoot = false;

        // Создаем кристаллы льда
        this.createIceCrystals();

        console.log(`❄️ Танк ${this.username} заморожен на ${duration/1000}сек`);
    }

    createIceCrystals() {
        this.iceCrystals = [];
        const crystalCount = 8 + Math.floor(Math.random() * 8);

        for (let i = 0; i < crystalCount; i++) {
            this.iceCrystals.push({
                x: (Math.random() - 0.5) * this.size * 1.5,
                                  y: (Math.random() - 0.5) * this.size * 1.5,
                                  size: 3 + Math.random() * 6,
                                  rotation: Math.random() * Math.PI * 2,
                                  growth: 0,
                                  alpha: 1,
                                  pulse: Math.random() * Math.PI * 2
            });
        }
    }

    hasShield() {
        return this.shield && this.shield.active;
    }

    move(newDirection, map, otherTanks = [], brickFragments = []) {
        if (this.isDestroyed || this.isFrozen) return false;

        const oldDirection = this.direction;
        this.direction = newDirection;

        const directionVector = new Vector2(this.direction.x, this.direction.y);
        let currentSpeed = this.speed;

        const newPos = this.position.add(directionVector.multiply(currentSpeed));

        // ЖЕСТКАЯ ГРАНИЦА ДЛЯ РЕЖИМА АТАКИ БАЗЫ
        if (this.baseAttackMode && game) {
            const baseZone = game.getBaseZone();
            const newZone = game.getZoneId(newPos.x, newPos.y);

            const distanceToBase = Math.max(
                Math.abs(newZone.x - baseZone.x),
                                            Math.abs(newZone.y - baseZone.y)
            );

            // ЕСЛИ НОВАЯ ПОЗИЦИЯ ВНЕ ЗОНЫ БАЗЫ - БЛОКИРУЕМ ДВИЖЕНИЕ
            if (distanceToBase > 2) {
                console.log(`🚫 ${this.username} ЗАБЛОКИРОВАН: попытка выехать из зоны базы!`);
                this.direction = oldDirection; // Возвращаем старое направление
                return false;
            }
        }

        const tankBounds = new Rectangle(
            newPos.x - this.size/2 + 2,
            newPos.y - this.size/2 + 2,
            this.size - 4,
            this.size - 4
        );

        if (map && map.checkCollision && map.checkCollision(tankBounds)) {
            return false;
        }

        if (otherTanks) {
            for (const otherTank of otherTanks) {
                if (otherTank !== this && !otherTank.isDestroyed && tankBounds.intersects(otherTank.getBounds())) {
                    return false;
                }
            }
        }

        let fragmentCollision = false;
        if (brickFragments) {
            for (const fragment of brickFragments) {
                if (fragment.collisionEnabled && fragment.active && tankBounds.intersects(fragment.getBounds())) {
                    fragmentCollision = true;
                    break;
                }
            }
        }

        if (fragmentCollision) {
            let speedMultiplier;
            if (this.type === 'player') {
                speedMultiplier = 0.6;
            } else {
                speedMultiplier = 0.8;
            }

            const adjustedSpeed = currentSpeed * speedMultiplier;
            const adjustedPos = this.position.add(directionVector.multiply(adjustedSpeed));

            // НОВОЕ: Проверка границ для adjusted позиции
            if (!this.isPositionInBounds(adjustedPos.x, adjustedPos.y)) {
                return false;
            }

            const adjustedBounds = new Rectangle(
                adjustedPos.x - this.size/2 + 2,
                adjustedPos.y - this.size/2 + 2,
                this.size - 4,
                this.size - 4
            );

            if (!map.checkCollision(adjustedBounds)) {
                let tankCollision = false;
                if (otherTanks) {
                    for (const otherTank of otherTanks) {
                        if (otherTank !== this && !otherTank.isDestroyed && adjustedBounds.intersects(otherTank.getBounds())) {
                            tankCollision = true;
                            break;
                        }
                    }
                }

                if (!tankCollision) {
                    this.position = adjustedPos;
                    return true;
                }
            }

            return false;
        } else {
            this.position = newPos;
            return true;
        }
    }

    // ОБНОВЛЯЕМ метод shoot для учета улучшенных пуль
    shoot(nearestEnemy = null) {
        if (this.isDestroyed || !this.canShoot || this.isFrozen) return null;

        this.canShoot = false;
        this.reloadTime = this.type === 'player' ? this.upgrade.reloadTime :
        this.enemyType === 'FAST' ? 25 :
        this.enemyType === 'HEAVY' ? 60 : 40;

        let direction = this.direction;

        // ПОВОРАЧИВАЕМ ДУЛО ПРИ АТАКЕ БАЗЫ
        if (this.type === 'enemy' && this.baseAttackMode) {
            const baseDirection = this.getBaseShootDirection();
            if (baseDirection) {
                direction = baseDirection;
                // ОБНОВЛЯЕМ НАПРАВЛЕНИЕ ТАНКА чтобы дуло повернулось
                this.direction = baseDirection;
                console.log(`🎯 ${this.username} поворачивает дуло к базе: ${this.getDirectionName(baseDirection)}`);
            }
        }

        // Автонаведение для игрока (оставляем как было)
        if (this.type === 'player' && this.hasAutoAim && nearestEnemy) {
            const dx = nearestEnemy.position.x - this.position.x;
            const dy = nearestEnemy.position.y - this.position.y;

            if (Math.abs(dx) > Math.abs(dy)) {
                direction = dx > 0 ? DIRECTIONS.RIGHT : DIRECTIONS.LEFT;
            } else {
                direction = dy > 0 ? DIRECTIONS.DOWN : DIRECTIONS.UP;
            }
        }

        const directionVector = new Vector2(direction.x, direction.y);
        const offset = directionVector.multiply(this.size / 2 + 5);
        const bulletX = this.position.x + offset.x;
        const bulletY = this.position.y + offset.y;

        const bullet = new Bullet(bulletX, bulletY, direction, this.type, this,
                                  this.hasAutoAim, nearestEnemy, this.bulletPower);

        if (this.type === 'enemy' && typeof game !== 'undefined') {
            game.soundManager.playEnemyShot(this.enemyType);
        }

        return bullet;
    }

    getDirectionName(direction) {
        if (direction === DIRECTIONS.UP) return 'ВВЕРХ';
        if (direction === DIRECTIONS.DOWN) return 'ВНИЗ';
        if (direction === DIRECTIONS.LEFT) return 'ВЛЕВО';
        if (direction === DIRECTIONS.RIGHT) return 'ВПРАВО';
        return 'НЕИЗВЕСТНО';
    }

    // ОБНОВЛЯЕМ метод draw для отображения состояния патрулирования
    draw(ctx) {
        if (this.isDestroyed) return;

        // СНАЧАЛА рисуем следы гусениц (под танком)
        this.drawTracks(ctx);

        // ПОТОМ визуализацию памяти пути (если включено)
        if (this.type === 'enemy' && this.ai && this.ai.debugShowMemory) {
            this.drawPathMemory(ctx);
        }

        ctx.save();
        ctx.translate(this.position.x, this.position.y);

        // ВСЕГДА используем основное направление для корпуса танка
        let angle = 0;
        if (this.direction === DIRECTIONS.RIGHT) angle = Math.PI / 2;
        else if (this.direction === DIRECTIONS.DOWN) angle = Math.PI;
        else if (this.direction === DIRECTIONS.LEFT) angle = -Math.PI / 2;

        ctx.rotate(angle);

        // Эффект неуязвимости (мигание)
        if (this.isInvincible) {
            const blinkVisible = Math.floor(this.invincibilityBlink / 5) % 2 === 0;
            if (!blinkVisible) {
                ctx.globalAlpha = 0.3;
            }
        }
        else if (this.spawnProtection > 0 && this.spawnProtection % 10 < 5) {
            ctx.globalAlpha = 0.5;
        }

        // Корпус танка (цвет теперь зависит от уровня)
        ctx.fillStyle = this.color;
        ctx.fillRect(-this.size/2, -this.size/2, this.size, this.size);

        // НОВОЕ: Башня танка (круглая)
        this.drawTurret(ctx);

        // Индикатор уровня на корпусе
        if (this.type === 'player' && this.playerLevel > 1) {
            this.drawLevelIndicator(ctx);
        }

        // Особое оформление для танков с бонусами
        if (this.hasBonus) {
            ctx.strokeStyle = `rgba(255, 255, 255, ${this.blinkAlpha})`;
            ctx.lineWidth = 3;
            ctx.strokeRect(-this.size/2, -this.size/2, this.size, this.size);
            ctx.shadowColor = '#FFFFFF';
            ctx.shadowBlur = 10 * this.blinkAlpha;
        }

        // Детали корпуса (убираем старый квадрат, теперь есть башня)
        ctx.fillStyle = this.type === 'player' ? this.getDarkColor(this.color) : '#CC3333';

        // Рисуем люк на башне вместо квадрата на корпусе
        ctx.fillStyle = '#2C3E50'; // Темно-серый для люка
        ctx.beginPath();
        ctx.arc(0, 0, this.size/6, 0, Math.PI * 2);
        ctx.fill();

        // Дуло (толще для высоких уровней)
        const barrelWidth = this.size * (this.type === 'player' ?
        0.15 + (this.playerLevel * 0.015) : 0.2);
        const barrelLength = this.size * 0.8;

        ctx.fillStyle = '#333';
        ctx.fillRect(-barrelWidth/2, -barrelLength - 2, barrelWidth, barrelLength);

        // Сброс тени
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1.0;

        // Рисуем электронный блок автонаведения
        if (this.hasAutoAim && this.type === 'player') {
            this.drawAutoAimDevice(ctx);
        }

        // Отрисовка башни - может поворачиваться независимо при осмотре
        this.drawTurret(ctx, this.patrolState === 'LOOKING_AROUND' ? this.lookAroundDirection : this.direction);

        // НОВОЕ: Мигающая красная лампочка при защите базы
        // В методе draw добавь более заметную индикацию:
        if (this.baseAttackMode) {
            const blinkVisible = Math.floor(this.redLightBlink / 8) % 2 === 0;
            if (blinkVisible) {
                // Большая красная лампочка АТАКИ
                ctx.fillStyle = '#FF0000';
                ctx.beginPath();
                ctx.arc(this.size/2 - 8, -this.size/2 + 8, 6, 0, Math.PI * 2);
                ctx.fill();

                // Яркое свечение
                ctx.shadowColor = '#FF0000';
                ctx.shadowBlur = 15;
                ctx.fill();
                ctx.shadowBlur = 0;

                // Текст "АТАКА" вместо "ЗАЩИТА"
                ctx.fillStyle = '#FF0000';
                ctx.font = 'bold 10px Arial';
                ctx.textAlign = 'center';
                ctx.fillText('АТАКА', 0, -this.size/2 - 10);
            }
        }

        ctx.restore();

        // Рисуем щит поверх танка
        if (this.shield) {
            this.shield.draw(ctx);
        }

        // Визуальный эффект неуязвимости
        if (this.isInvincible) {
            this.drawInvincibilityEffect(ctx);
        }

        // Отображаем иконку бонуса над танком
        if (this.hasBonus) {
            const iconAlpha = 0.3 + (this.blinkAlpha * 0.7);
            ctx.fillStyle = `rgba(0, 0, 0, ${0.7 * iconAlpha})`;
            const textWidth = ctx.measureText(this.bonusType.symbol).width + 8;
            ctx.fillRect(
                this.position.x - textWidth/2,
                this.position.y - this.size - 25,
                textWidth,
                20
            );
            ctx.fillStyle = this.bonusType.color;
            ctx.globalAlpha = iconAlpha;
            ctx.font = 'bold 14px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(this.bonusType.symbol, this.position.x, this.position.y - this.size - 12);
            ctx.globalAlpha = 1.0;
        }

        // ОТОБРАЖЕНИЕ ИНФОРМАЦИИ О ТАНКЕ (единый метод для всех режимов)
        if (this.type === 'enemy' && this.username && !this.isDestroyed) {
            this.drawEnemyInfo(ctx);
        }

        // Рисуем эффект заморозки поверх танка
        if (this.isFrozen && this.freezeProgress > 0) {
            this.drawFreezeEffect(ctx);
        }

        // Визуальные эффекты для разных состояний патрулирования
        if (this.type === 'enemy' && this.aiLevel === ENEMY_AI_LEVELS.BASIC) {
            this.drawPatrolEffects(ctx);
        }
    }

    // ОБНОВЛЯЕМ метод отрисовки башни
    drawTurret(ctx, direction) {
        const turretRadius = this.size / 3;

        // Поворачиваем башню в нужном направлении
        let turretAngle = 0;
        if (direction === DIRECTIONS.RIGHT) turretAngle = Math.PI / 2;
        else if (direction === DIRECTIONS.DOWN) turretAngle = Math.PI;
        else if (direction === DIRECTIONS.LEFT) turretAngle = -Math.PI / 2;

        ctx.save();
        ctx.rotate(turretAngle);

        // Основная башня
        ctx.fillStyle = this.type === 'player' ? this.getDarkColor(this.color) : '#AA3333';
        ctx.beginPath();
        ctx.arc(0, 0, turretRadius, 0, Math.PI * 2);
        ctx.fill();

        // Обводка башни
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 1;
        ctx.stroke();

        // Детали на башне (люк)
        ctx.fillStyle = '#2C3E50';
        ctx.beginPath();
        ctx.arc(0, 0, turretRadius / 2, 0, Math.PI * 2);
        ctx.fill();

        // Блики на башне для объема
        ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.beginPath();
        ctx.arc(-turretRadius/3, -turretRadius/3, turretRadius/4, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();

        // Дуло (рисуем в направлении башни)
        ctx.save();
        ctx.rotate(turretAngle);

        const barrelWidth = this.size * (this.type === 'player' ? 0.15 + (this.playerLevel * 0.015) : 0.2);
        const barrelLength = this.size * 0.8;

        ctx.fillStyle = '#333';
        ctx.fillRect(-barrelWidth/2, -barrelLength - 2, barrelWidth, barrelLength);

        ctx.restore();
    }

    // ОБНОВЛЯЕМ метод drawPatrolEffects:
    drawPatrolEffects(ctx) {
        if (this.type !== 'enemy' || this.aiLevel !== ENEMY_AI_LEVELS.BASIC) return;

        ctx.save();
        ctx.translate(this.position.x, this.position.y);

        switch (this.patrolState) {
            case 'LOOKING_AROUND':
                // Пульсирующий желтый круг при осмотре
                const pulse = (Math.sin(Date.now() * 0.01) + 1) * 0.5;
                ctx.strokeStyle = `rgba(255, 255, 0, ${0.3 + pulse * 0.2})`;
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.arc(0, 0, this.size * 0.7, 0, Math.PI * 2);
                ctx.stroke();
                break;

            case 'STOPPED':
                // Мигающий красный круг при остановке
                const blink = Math.floor(Date.now() / 500) % 2 === 0;
                if (blink) {
                    ctx.strokeStyle = 'rgba(255, 0, 0, 0.4)';
                    ctx.lineWidth = 2;
                    ctx.beginPath();
                    ctx.arc(0, 0, this.size * 0.6, 0, Math.PI * 2);
                    ctx.stroke();
                }
                break;

            case 'MOVING':
                // Слабый зеленый след при движении
                ctx.strokeStyle = 'rgba(0, 255, 0, 0.2)';
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.arc(0, 0, this.size * 0.5, 0, Math.PI * 2);
                ctx.stroke();
                break;
        }

        ctx.restore();
    }

    // В методе drawEnemyInfo ИСПРАВЛЯЕМ позиционирование:
    drawEnemyInfo(ctx) {
        if (this.type !== 'enemy' || this.isDestroyed || !this.username) return;

        ctx.save();
        ctx.translate(this.position.x, this.position.y);

        // Собираем информацию в зависимости от режима
        const debugLines = [];

        // Всегда: имя с аватаркой
        const tempAvatars = {
            'BASIC': '🚵‍♂️',
            'FAST': '🌠',
            'HEAVY': '🦏',
            'SNIPER': '🎯'
        };
        const avatar = tempAvatars[this.enemyType] || '👤';
        debugLines.push(`${avatar} ${this.username}`);

        // Только в дебаг-режиме: дополнительная информация
        const isDebugMode = typeof game !== 'undefined' && game.debugShowVision;
        if (isDebugMode) {
            // Строка 2: Здоровье
            const healthIcons = ['❤️', '❤️❤️', '❤️❤️❤️'];
            const healthIcon = healthIcons[this.health - 1] || '❤️';
            debugLines.push(`${healthIcon} Жизней = ${this.health}`);

            // Строка 3: Тип ИИ
            const aiIcons = {
                [ENEMY_AI_LEVELS.BASIC]: '🚲 Базовый ИИ',
                [ENEMY_AI_LEVELS.ADVANCED]: '🚨 Продвинутый ИИ'
            };
            debugLines.push(`${aiIcons[this.aiLevel] || '❓ Неизвестный ИИ'}`);

            // Строка 4: Состояние
            let stateLine = '';

            // Для базового ИИ - состояние патрулирования
            if (this.aiLevel === ENEMY_AI_LEVELS.BASIC) {
                const stateIcons = {
                    'MOVING': '🚗 Еду',
                    'STOPPED': '🛑 Стою',
                    'LOOKING_AROUND': '👀 Осматриваюсь'
                };
                stateLine = stateIcons[this.patrolState] || '❓';
            }
            // Для продвинутого ИИ - состояние атаки
            else if (this.aiLevel === ENEMY_AI_LEVELS.ADVANCED && this.ai) {
                const player = typeof game !== 'undefined' ? game.player : null;
                const map = typeof game !== 'undefined' ? game.map : null;

                if (player && !player.isDestroyed && this.canSeePlayer(player, map)) {
                    stateLine = '😈 Вижу игрока';
                } else if (this.ai.state === 'ATTACK_BASE') {
                    stateLine = '💀 Вижу базу';
                } else if (this.ai.state === 'ATTACK_PLAYER' && this.ai.lastKnownPlayerPosition) {
                    stateLine = '🎯 Ищу игрока';
                } else {
                    stateLine = '🤔 Не вижу игрока';
                }
            } else {
                stateLine = '🤔 Не вижу игрока';
            }

            debugLines.push(stateLine);
        }

        // Вычисляем размеры блока
        const lineHeight = 14;
        const padding = 6;
        const totalHeight = debugLines.length * lineHeight + padding * 2;
        const maxWidth = this.getMaxTextWidth(ctx, debugLines) + padding * 2;

        // ИСПРАВЛЕНИЕ: Позиционируем блок СЛЕВА от танка (как раньше)
        const blockX = -this.size - maxWidth - 15; // Слева от танка
        const blockY = -this.size - totalHeight - 10; // Выше танка

        // Градиентный фон
        const gradient = ctx.createLinearGradient(blockX, blockY, blockX + maxWidth, blockY + totalHeight);
        gradient.addColorStop(0, 'rgba(0, 0, 0, 0.85)');
        gradient.addColorStop(1, 'rgba(50, 50, 50, 0.85)');

        ctx.fillStyle = gradient;
        ctx.fillRect(blockX, blockY, maxWidth, totalHeight);

        // Обводка (УБИРАЕМ оранжевую обводку в дебаг-режиме)
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.lineWidth = 1;
        ctx.strokeRect(blockX, blockY, maxWidth, totalHeight);

        // Отображаем строки информации с выравниванием по левому краю
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 11px Arial';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';

        debugLines.forEach((line, index) => {
            const yPos = blockY + padding + (index * lineHeight) + lineHeight/2;
            const xPos = blockX + padding;

            // Тень для лучшей читаемости
            ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
            ctx.fillText(line, xPos + 1, yPos + 1);

            // Основной текст
            ctx.fillStyle = '#FFFFFF';
            ctx.fillText(line, xPos, yPos);
        });

        // Стрелка-указатель к танку (ИСПРАВЛЯЕМ направление)
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(blockX + maxWidth, blockY + totalHeight/2); // От правого края блока
        ctx.lineTo(-this.size/2, 0); // К центру танка
        ctx.stroke();

        ctx.restore();
    }

    // Вспомогательный метод для вычисления ширины текста
    getMaxTextWidth(ctx, lines) {
        ctx.save();
        ctx.font = 'bold 11px Arial';
        let maxWidth = 0;
        lines.forEach(line => {
            const width = ctx.measureText(line).width;
            if (width > maxWidth) maxWidth = width;
        });
            ctx.restore();
            return maxWidth;
    }

    // ДОБАВЛЯЕМ в класс Tank:
    canSeeBase(map) {
        if (!map || !map.basePosition) return false;

        const basePos = map.basePosition;
        const distance = Math.sqrt(
            Math.pow(this.position.x - basePos.x, 2) +
            Math.pow(this.position.y - basePos.y, 2)
        );

        const baseVisionRange = VISION_RANGES.BASE_VISION || 350;
        if (distance > baseVisionRange) return false;

        return this.hasLineOfSight(basePos.x, basePos.y, map);
    }

    // НОВЫЙ МЕТОД: Отрисовка башни танка
    drawTurret(ctx) {
        const turretRadius = this.size / 3;

        // Основная башня
        ctx.fillStyle = this.type === 'player' ? this.getDarkColor(this.color) : '#AA3333';
        ctx.beginPath();
        ctx.arc(0, 0, turretRadius, 0, Math.PI * 2);
        ctx.fill();

        // Обводка башни
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 1;
        ctx.stroke();

        // Детали на башне (люк)
        ctx.fillStyle = '#2C3E50';
        ctx.beginPath();
        ctx.arc(0, 0, turretRadius / 2, 0, Math.PI * 2);
        ctx.fill();

        // Блики на башне для объема
        ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.beginPath();
        ctx.arc(-turretRadius/3, -turretRadius/3, turretRadius/4, 0, Math.PI * 2);
        ctx.fill();
    }

    // НОВЫЙ МЕТОД: Отрисовка индикатора уровня на башне (вместо корпуса)
    drawLevelIndicator(ctx) {
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 9px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(this.playerLevel.toString(), 0, 0);
    }

    // НОВЫЙ МЕТОД: Получение темного цвета для деталей
    getDarkColor(baseColor) {
        // Простое затемнение цвета
        return baseColor.replace(')', ', 0.7)').replace('rgb', 'rgba');
    }

    // НОВЫЙ МЕТОД: Эффект неуязвимости
    drawInvincibilityEffect(ctx) {
        ctx.save();
        ctx.translate(this.position.x, this.position.y);

        const time = Date.now() * 0.01;
        const pulse = Math.sin(time) * 0.3 + 0.7;

        // Синее сияние
        const gradient = ctx.createRadialGradient(0, 0, this.size * 0.5, 0, 0, this.size * 1.5);
        gradient.addColorStop(0, 'rgba(100, 200, 255, 0.8)');
        gradient.addColorStop(1, 'rgba(100, 200, 255, 0)');

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(0, 0, this.size * 1.5 * pulse, 0, Math.PI * 2);
        ctx.fill();

        // Вращающиеся частицы
        ctx.strokeStyle = `rgba(255, 255, 255, ${pulse})`;
        ctx.lineWidth = 2;
        for (let i = 0; i < 8; i++) {
            const angle = (i / 8) * Math.PI * 2 + time * 0.5;
            const innerRadius = this.size * 0.8;
            const outerRadius = this.size * 1.8;

            const x1 = Math.cos(angle) * innerRadius;
            const y1 = Math.sin(angle) * innerRadius;
            const x2 = Math.cos(angle) * outerRadius;
            const y2 = Math.sin(angle) * outerRadius;

            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.stroke();
        }

        ctx.restore();
    }

    // НОВЫЙ МЕТОД: Отрисовка электронного блока автонаведения
    drawAutoAimDevice(ctx) {
        ctx.save();

        // Позиция на ЛЕВОЙ стороне кормы танка
        const blockWidth = this.size * 0.3;  // Высота блока (теперь по вертикали)
        const blockHeight = this.size * 0.3; // Ширина блока (теперь по горизонтали)
        const blockX = -this.size/2 - blockHeight + 10; // Слева от танка
        const blockY = -blockWidth/2 - 6; // По центру по вертикали

        // Поворачиваем блок на 90 градусов
        ctx.rotate(-Math.PI / 2);

        // Основа блока
        ctx.fillStyle = '#2C3E50';
        ctx.fillRect(blockX, blockY, blockHeight, blockWidth);

        // Обводка
        ctx.strokeStyle = '#34495E';
        ctx.lineWidth = 1;
        ctx.strokeRect(blockX, blockY, blockHeight, blockWidth);

        // Мигающие индикаторы (теперь вертикальное расположение)
        const time = Date.now() * 0.001;
        const ledSize = blockWidth * 0.15;

        // Синий индикатор (мигает быстро) - ВЕРХНИЙ
        const blueAlpha = 0.3 + Math.sin(time * 8) * 0.3;
        ctx.fillStyle = `rgba(0, 150, 255, ${blueAlpha})`;
        ctx.fillRect(blockX + blockHeight * 0.3, blockY + blockWidth * 0.2, ledSize, ledSize);

        // Зеленый индикатор (мигает средне) - СРЕДНИЙ
        const greenAlpha = 0.3 + Math.sin(time * 5 + 1) * 0.3;
        ctx.fillStyle = `rgba(0, 255, 100, ${greenAlpha})`;
        ctx.fillRect(blockX + blockHeight * 0.3, blockY + blockWidth * 0.5, ledSize, ledSize);

        // Красный индикатор (мигает медленно) - НИЖНИЙ
        const redAlpha = 0.3 + Math.sin(time * 3 + 2) * 0.3;
        ctx.fillStyle = `rgba(255, 50, 50, ${redAlpha})`;
        ctx.fillRect(blockX + blockHeight * 0.3, blockY + blockWidth * 0.8, ledSize, ledSize);

        // Свечение
        ctx.shadowColor = '#9C27B0';
        ctx.shadowBlur = 5;
        ctx.strokeStyle = `rgba(156, 39, 176, 0.3)`;
        ctx.lineWidth = 2;
        ctx.strokeRect(blockX - 1, blockY - 1, blockHeight + 2, blockWidth + 2);
        ctx.shadowBlur = 0;

        ctx.restore();
    }

    drawFreezeEffect(ctx) {
        ctx.save();
        ctx.translate(this.position.x, this.position.y);

        // Голубое свечение вокруг замороженного танка
        const glowIntensity = this.freezeProgress * 0.3;
        const gradient = ctx.createRadialGradient(0, 0, this.size * 0.5, 0, 0, this.size * 1.2);
        gradient.addColorStop(0, `rgba(100, 200, 255, ${glowIntensity})`);
        gradient.addColorStop(1, 'rgba(100, 200, 255, 0)');

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(0, 0, this.size * 1.2, 0, Math.PI * 2);
        ctx.fill();

        // Ледяная корка на танке
        ctx.fillStyle = `rgba(200, 230, 255, ${this.freezeProgress * 0.3})`;
        ctx.fillRect(-this.size/2, -this.size/2, this.size, this.size);

        // Кристаллы льда
        this.iceCrystals.forEach(crystal => {
            if (crystal.growth > 0) {
                ctx.save();
                ctx.translate(crystal.x, crystal.y);
                ctx.rotate(crystal.rotation);

                const pulse = Math.sin(crystal.pulse) * 0.2 + 0.8;
                const alpha = crystal.alpha * crystal.growth * pulse;

                // Блестящие кристаллы
                ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
                ctx.strokeStyle = `rgba(200, 230, 255, ${alpha})`;
                ctx.lineWidth = 1;

                // Рисуем кристалл (шестиугольник)
                ctx.beginPath();
                for (let i = 0; i < 6; i++) {
                    const angle = (i / 6) * Math.PI * 2;
                    const x = Math.cos(angle) * crystal.size;
                    const y = Math.sin(angle) * crystal.size;
                    if (i === 0) ctx.moveTo(x, y);
                    else ctx.lineTo(x, y);
                }
                ctx.closePath();
                ctx.fill();
                ctx.stroke();

                // Блики на кристаллах
                ctx.fillStyle = `rgba(255, 255, 255, ${alpha * 0.8})`;
                ctx.beginPath();
                ctx.arc(crystal.size * 0.3, -crystal.size * 0.3, crystal.size * 0.2, 0, Math.PI * 2);
                ctx.fill();

                ctx.restore();
            }
        });

        // Иней по краям танка
        ctx.strokeStyle = `rgba(255, 255, 255, ${this.freezeProgress * 0.6})`;
        ctx.lineWidth = 2;
        ctx.strokeRect(-this.size/2, -this.size/2, this.size, this.size);

        ctx.restore();
    }

    getBounds() {
        return new Rectangle(
            this.position.x - this.size/2,
            this.position.y - this.size/2,
            this.size,
            this.size
        );
    }
}
