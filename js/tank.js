class Tank {
    constructor(x, y, type = 'player', level = 1, enemyType = 'BASIC') {
        this.position = new Vector2(x, y);
        this.direction = DIRECTIONS.UP;
        this.type = type;
        this.enemyType = enemyType;
        this.size = TILE_SIZE - 8;
        // 🔥 НОВЫЕ СВОЙСТВА ДЛЯ ОГАРКОВ И ИНФО-БЛОКА
        this.isDestroyed = false;
        // 🔥 ДОБАВЛЯЕМ СВОЙСТВА ДЛЯ ОГАРКОВ
        this.isWreck = false;
        this.wreckAlpha = 1.0;            // Прозрачность всего танка как огарка
        this.avatarFadeAlpha = 1.0;       // Прозрачность аватарки (особенно для зрителей)
        this.infoBlockAlpha = 1.0;        // Прозрачность инфоблока
        this.infoBlockMinAlpha = 0.7;     // Минимальная прозрачность инфоблока
        this.infoBlockMaxAlpha = 1.0;     // Максимальная прозрачность инфоблока
        this.infoBlockChatActivated = false;
        this.infoBlockChatTimer = 0;
        this.infoBlockHovered = false;
        // 🔥 НОВЫЕ СВОЙСТВА ДЛЯ СООБЩЕНИЙ ОГАРКОВ
        this.wreckChatMessage = null; // Отдельное сообщение для огарка
        this.wreckMessageAlpha = 1.0;
        this.wreckMessageTimer = 0; // Таймер для сообщения огарка
        this.canShoot = true;
        this.hasBonus = false;
        this.isFrozen = false;
        this.isInvincible = false;
        this.hasAutoAim = false;
        this.baseAttackMode = false;
        this.isInBaseZone = false;
        // СИСТЕМА СООБЩЕНИЙ (для зрителей)
        this.chatMessages = [];          // Очередь сообщений
        this.currentMessage = null;      // Текущее отображаемое сообщение
        this.messageStartTime = 0;       // Время начала показа текущего сообщения
        this.messageAlpha = 1.0;         // Прозрачность сообщения
        this.messageFadeState = 'SHOW';  // Состояние: SHOW, FADE_OUT, FADE_IN
        this.messageFadeProgress = 0;    // Прогресс плавного перехода
        this.messageTimer = null;        // Таймер для исчезновения
        // 🔥 ДОБАВИТЬ ЭТИ СВОЙСТВА ДЛЯ ЗРИТЕЛЕЙ:
        this.isViewerTank = false; // Будет true для танков зрителей
        this.hasViewerBonus = false; // Есть ли бонус
        this.viewerBonusType = null; // Тип бонуса
        this.isSubscriber = false; // Подписчик ли
        this.viewerName = ''; // Имя для отображения

        if (type === 'player') {
            this.playerLevel = level;
            this.experience = 0;

            // Всегда применяем апгрейд для игрока
            const upgradeKey = `LEVEL_${Math.min(level, 4)}`;
            const upgrade = PLAYER_UPGRADES[upgradeKey];

            if (upgrade) {
                this.applyUpgrade(upgrade);
                console.log(`Танк создан с уровнем ${level}:`, upgrade);
            }

            this.checkLevelUp();
        } else {
            this.initEnemy(level, enemyType);
        }

        if (type === 'player') {
            this.direction = DIRECTIONS.UP;
        } else {
            this.direction = DIRECTIONS.DOWN;  // Всегда вниз для врагов
        }

        this.type = type;
        this.enemyType = enemyType;

        this.initCommonProperties();
    }

    // 🔥 ИСПРАВЛЕННЫЙ МЕТОД turnIntoWreck
    turnIntoWreck() {
        if (this.isWreck) return;

        console.log(`🔥 Танк ${this.username || this.enemyType} превращается в огарок`);

        this.isDestroyed = true;
        this.isWreck = true;

        // 🔥 ИСПРАВЛЕНИЕ 1: БОЛЬШАЯ ПРОЗРАЧНОСТЬ МОДЕЛИ
        this.wreckAlpha = 0.7;           // Было 0.3 - СЛИШКОМ ПРОЗРАЧНО!

        // 🔥 ИСПРАВЛЕНИЕ 2: БОЛЕЕ СВЕТЛЫЕ ЦВЕТА ДЛЯ ЛУЧШЕЙ ВИДИМОСТИ
        this.wreckBodyColor = '#444444';    // Серый вместо черного
        this.wreckTrackColor = '#333333';   // Темно-серый
        this.wreckTurretColor = '#555555';  // Средне-серый
        this.wreckBarrelColor = '#666666';  // Светло-серый

        // 🔥 ИСПРАВЛЕНИЕ 3: ИНФОБЛОК ВСЕГДА ВИДИМ
        this.infoVisible = true;
        this.infoAlpha = 0.2;            // Почти невидим по умолчанию
        this.avatarAlpha = 0.15;

        // 🔥 ИСПРАВЛЕНИЕ 4: СОХРАНЯЕМ ОРИГИНАЛЬНЫЕ СВОЙСТВА
        this.originalColor = this.color;
        this.originalUsername = this.username;
        this.originalAvatarUrl = this.avatarUrl;
        this.originalAvatarImage = this.avatarImage;
        this.originalHealth = this.health;
        this.originalEnemyType = this.enemyType;

        // 🔥 СВОЙСТВА ДЛЯ ИСКОРОК
        this.sparks = [];           // Массив искорок
        this.sparkTimer = 0;        // Таймер для создания искорок
        this.sparkInterval = 30;    // Каждые 0.5 секунд при 60 FPS
        this.maxSparks = 8;         // Максимум искорок одновременно

        // Цвета искорок
        this.sparkColors = [
            '#FF5500', // Ярко-оранжевый
            '#FFAA00', // Желто-оранжевый
            '#FF3300', // Красно-оранжевый
            '#FF6600'  // Оранжевый
        ];

        this.clearAllEffects();

        // 🔥 ОСТАНАВЛИВАЕМ ВСЁ
        this.speed = 0;
        this.canShoot = false;
        this.hasBonus = false;
        this.isInvincible = false;
        this.hasAutoAim = false;
        this.isFrozen = false;
        this.isReversed = false;
        this.shield = null;

        // 🔥 ОЧИЩАЕМ ЭФФЕКТЫ (это может быть причиной артефактов!)
        this.chatMessages = [];
        this.currentMessage = null;
        this.messageAlpha = 0;
        this.iceCrystals = [];      // Очищаем кристаллы льда
        this.reverseParticles = []; // Очищаем частицы реверса
        this.freezeParticles = [];  // Очищаем частицы заморозки

        console.log(`✅ Огарок создан: прозрачность модели=${this.wreckAlpha}`);
    }

    // 🔥 ПЕРЕПИСАННЫЙ МЕТОД updateWreckState
    updateWreckState() {
        if (!this.isWreck || !this.isDestroyed) return;

        // 🔥 1. ОБНОВЛЯЕМ ИСКОРКИ
        this.updateSparks();

        // 🔥 2. ПРОВЕРКА СООБЩЕНИЙ
        if (this.currentMessage) {
            const elapsed = Date.now() - this.currentMessage.timestamp;
            if (elapsed > 8000) {
                this.currentMessage = null;
            }
        }

        // 🔥 3. ДЕЛАЕМ ИНФОБЛОК ВИДИМЫМ ПРИ НАЛИЧИИ СООБЩЕНИЯ
        if (this.currentMessage && this.infoAlpha < 0.5) {
            this.infoAlpha = 0.9;
            this.avatarAlpha = 0.8;
            this.infoVisible = true;
        }
    }


    // 🔥 УПРОЩЕННЫЙ МЕТОД activateInfoBlockByChat
    activateInfoBlockByChat() {
        if (!this.isWreck || !this.isDestroyed) return;

        // Просто активируем блок на 5 секунд
        this.infoBlockChatActivated = true;
        this.infoBlockChatTimer = 300; // 5 секунд
        this.infoBlockAlpha = this.infoBlockMaxAlpha;
    }

    // 🔥 ПРОВЕРКА НАВЕДЕНИЯ МЫШКИ НА ИНФО-БЛОК
    checkInfoBlockHover(mouseX, mouseY) {
        if (!this.isWreck || !this.isDestroyed || !mouseX || !mouseY) return false;

        // Получаем границы информационного блока
        const blockBounds = this.getInfoBlockBounds();

        // 🔥 ПРОСТАЯ ПРОВЕРКА ТОЧКИ В ПРЯМОУГОЛЬНИКЕ
        const hovered = (
            mouseX >= blockBounds.x &&
            mouseX <= blockBounds.x + blockBounds.width &&
            mouseY >= blockBounds.y &&
            mouseY <= blockBounds.y + blockBounds.height
        );

        // Обновляем состояние только если изменилось
        if (hovered !== this.infoBlockHovered) {
            this.infoBlockHovered = hovered;
        }

        return hovered;
    }

    // 🔥 ГРАНИЦЫ ИНФОРМАЦИОННОГО БЛОКА
    getInfoBlockBounds() {
        if (!this.username) return { x: 0, y: 0, width: 0, height: 0 };

        // Берем реальные размеры из метода drawUnifiedEnemyInfoAtPosition
        // Примерные размеры (на основе вашего кода):
        const username = this.username.toUpperCase();

        // Создаем временный canvas для измерения
        const tempCanvas = document.createElement('canvas');
        const tempCtx = tempCanvas.getContext('2d');

        // Измеряем ширину имени
        tempCtx.font = 'bold 12px Arial';
        const nameWidth = tempCtx.measureText(username).width;

        // Измеряем ширину сердечек здоровья
        tempCtx.font = '12px "Segoe UI Emoji"';
        const heartWidth = tempCtx.measureText('❤️').width;
        const heartsWidth = this.health * heartWidth;

        // Ширина бонуса если есть
        let bonusWidth = 0;
        if (this.isViewerTank && this.hasViewerBonus) {
            bonusWidth = 20 + 2; // Примерная ширина иконки бонуса + отступ
        }

        // Общая ширина содержимого
        let totalWidth = bonusWidth + nameWidth + heartsWidth + 8;
        const textHeight = 14;

        // Учитываем сообщение если есть
        let blockHeight = textHeight + 16;
        if (this.currentMessage && this.messageAlpha > 0.05) {
            blockHeight += 20;
        }

        const padding = 8;
        const blockWidth = Math.max(totalWidth, 100) + padding * 2; // Минимум 100px

        // Позиция блока (на основе логики findBestInfoPosition)
        const { blockX, blockY } = this.findBestInfoPositionForWreck();

        return {
            x: blockX,
            y: blockY,
            width: blockWidth,
            height: blockHeight
        };
    }

    // 🔥 УПРОЩЕННЫЙ МЕТОД ДЛЯ ПОЗИЦИОНИРОВАНИЯ БЛОКА ОГАРКА
    findBestInfoPositionForWreck() {
        // Для огарков всегда располагаем блок сверху
        return {
            blockX: this.position.x - 90, // Половина от примерной ширины
            blockY: this.position.y - this.size - 100,
            preferredSide: 'top'
        };
    }

    // 🔥 ИСПРАВЛЕННЫЙ МЕТОД addChatMessage (для огарков)
    addChatMessage(username, message) {
        console.log(`💬 Сообщение для ${this.isWreck ? 'огарка' : 'танка'} ${this.username}: ${message}`);

        // 🔥 ДЛЯ ОГАРКОВ
        if (this.isWreck && this.isDestroyed) {
            // 🔥 ВАЖНО: Сохраняем сообщение
            this.currentMessage = {
                username: username,
                message: message,
                timestamp: Date.now(),
                isForWreck: true // Помечаем что для огарка
            };

            // 🔥 АКТИВИРУЕМ ИНФОБЛОК НА 8 СЕКУНД
            this.activateWreckInfoBlock();

            // 🔥 ВИЗУАЛЬНАЯ ВСПЫШКА
            if (game && game.effectManager) {
                game.effectManager.addExplosion(
                    this.position.x,
                    this.position.y,
                    'chatActivate'
                );
                game.screenShake = 10;
            }

            // 🔥 ОЧИСТКА ЧЕРЕЗ 8 СЕКУНД
            clearTimeout(this.messageTimer);
            this.messageTimer = setTimeout(() => {
                this.currentMessage = null;
                console.log(`🗑️ Сообщение очищено у огарка ${this.username}`);
            }, 8000);

            return;
        }

        // 🔥 ДЛЯ ЖИВЫХ ТАНКОВ (оригинальная логика)
        this.currentMessage = {
            username: username,
            message: message,
            timestamp: Date.now()
        };

        this.messageAlpha = 1.0;
        this.messageFadeState = 'SHOW';
        this.messageFadeProgress = 0;

        clearTimeout(this.messageTimer);
        this.messageTimer = setTimeout(() => {
            this.startMessageFadeOut();
        }, 5000);
    }

    activateWreckInfoBlock() {
        if (!this.isWreck || !this.isDestroyed) return;

        console.log(`🔥 АКТИВАЦИЯ инфоблока огарка "${this.username}"`);

        // 🔥 УСИЛЕННЫЕ ИСКОРКИ ПРИ АКТИВАЦИИ
        for (let i = 0; i < 5; i++) {
            this.createEnhancedSpark();
        }

        // 🔥 1. ДЕЛАЕМ ИНФОБЛОК ВИДИМЫМ И ЯРКИМ
        this.infoVisible = true;
        this.infoAlpha = 0.9;        // Почти непрозрачный!
        this.avatarAlpha = 0.8;      // Хорошо видимая аватарка
        this.infoBlockHovered = false; // Сбрасываем hover

        console.log(`🎨 Установлены прозрачности: info=${this.infoAlpha}, avatar=${this.avatarAlpha}`);

        // 🔥 2. ОСТАНАВЛИВАЕМ ПРЕДЫДУЩИЙ ТАЙМЕР
        if (this.fadeTimer) {
            clearTimeout(this.fadeTimer);
            console.log(`⏹️ Остановлен предыдущий таймер`);
        }

        // 🔥 3. ЗАПУСКАЕМ НОВЫЙ ТАЙМЕР НА 8 СЕКУНД
        this.fadeTimer = setTimeout(() => {
            if (this.isWreck && this.infoVisible) {
                console.log(`🌫️ 8 секунд прошло, начинаем затухание`);

                // Возвращаем к почти невидимому состоянию
                this.infoAlpha = 0.2;
                this.avatarAlpha = 0.15;

                // НЕ скрываем полностью, только делаем прозрачным
                // this.infoVisible = true; // Оставляем видимым!
            }
        }, 8000);

        // 🔥 4. ОБНОВЛЯЕМ ИНТЕРФЕЙС (если нужно)
        if (game && game.updateUI) {
            setTimeout(() => game.updateUI(), 10);
        }
    }

    handleWreckHover(mouseX, mouseY) {
        if (!this.isWreck || !this.isDestroyed || !mouseX || !mouseY) {
            this.infoBlockHovered = false;
            return false;
        }

        // 🔥 ПРОВЕРЯЕМ ПОПАДАНИЕ В МОДЕЛЬ ОГАРКА (а не в инфоблок)
        const bounds = this.getBounds();
        const hovered = (
            mouseX >= bounds.x &&
            mouseX <= bounds.x + bounds.width &&
            mouseY >= bounds.y &&
            mouseY <= bounds.y + bounds.height
        );

        if (hovered !== this.infoBlockHovered) {
            this.infoBlockHovered = hovered;

            if (hovered) {
                console.log(`🖱️ Наведение на огарок ${this.username}`);
                // 🔥 ПРИ НАВЕДЕНИИ ДЕЛАЕМ ИНФОБЛОК ВИДИМЫМ
                this.infoVisible = true;
                this.infoAlpha = 0.9;
                this.avatarAlpha = 0.8;

                // 🔥 ОСТАНАВЛИВАЕМ АВТО-ЗАТУХАНИЕ
                if (this.fadeTimer) {
                    clearTimeout(this.fadeTimer);
                    this.fadeTimer = null;
                }
            } else {
                console.log(`🖱️ Убрали наведение с огарка ${this.username}`);
                // 🔥 ЧЕРЕЗ 2 СЕКУНДЫ ПОСЛЕ УХОДА - ЗАТУХАНИЕ
                if (this.fadeTimer) {
                    clearTimeout(this.fadeTimer);
                }

                this.fadeTimer = setTimeout(() => {
                    if (this.isWreck && !this.infoBlockHovered) {
                        this.infoAlpha = 0.2;
                        this.avatarAlpha = 0.15;
                    }
                }, 2000);
            }
        }

        return hovered;
    }

    startInfoFadeOut() {
        if (!this.isWreck || !this.infoVisible) return;

        console.log(`🌫️ Начинаем затухание инфоблока огарка ${this.username}`);

        // 🔥 УСТАНАВЛИВАЕМ ВРЕМЯ НАЧАЛА ЗАТУХАНИЯ
        this.infoFadeStartTime = Date.now();
    }

    // Показать следующее сообщение из очереди
    showNextMessage() {
        if (this.chatMessages.length === 0) {
            this.currentMessage = null;
            return;
        }

        this.currentMessage = this.chatMessages.shift();
        this.messageStartTime = Date.now();
        this.messageAlpha = 1.0;
        this.messageFadeState = 'SHOW';
        this.messageFadeProgress = 0;
    }

    // Обновление состояния сообщений
    startMessageFadeOut() {
        if (this.currentMessage) {
            this.messageFadeState = 'FADE_OUT';
            this.messageFadeProgress = 0;
        }
    }

    // 🔥 УПРОЩЕННЫЙ МЕТОД updateChatMessages
    updateChatMessages() {
        if (!this.currentMessage) return;

        // 🔥 ДЛЯ ОГАРКОВ - СООБЩЕНИЕ СВЯЗАНО С ЯРКОСТЬЮ БЛОКА
        if (this.isWreck && this.isDestroyed) {
            // Прозрачность сообщения = прозрачность блока
            this.messageAlpha = this.infoBlockAlpha;

            // Если блок активен (от чата или наведения) - сообщение видно
            if (this.infoBlockChatActivated || this.infoBlockHovered) {
                this.messageAlpha = 1.0;
            }

            // 🔥 НЕ ЗАТУХАЕМ САМОСТОЯТЕЛЬНО - только с блоком
            return;
        }

        // 🔥 ДЛЯ ЖИВЫХ ТАНКОВ - ОРИГИНАЛЬНАЯ ЛОГИКА
        if (this.messageFadeState === 'FADE_OUT') {
            this.messageFadeProgress += 0.02;
            this.messageAlpha = 1 - this.messageFadeProgress;

            if (this.messageFadeProgress >= 1) {
                this.currentMessage = null;
                this.messageAlpha = 1.0;
                this.messageFadeState = 'SHOW';
            }
        }
    }

    drawChatMessage(ctx) {
        if (!this.currentMessage || this.messageAlpha <= 0.01) return;

        ctx.save();

        // Позиция над информационным блоком
        const messageY = -this.size - 85; // Выше информационного блока

        // Фон сообщения
        const messageText = `${this.currentMessage.username}: ${this.currentMessage.message}`;
        ctx.font = 'bold 11px Arial';
        const textWidth = ctx.measureText(messageText).width;
        const textHeight = 14;
        const padding = 6;

        // Позиционируем сообщение по центру над танком
        const messageX = -textWidth / 2;

        // Фон с закругленными углами
        ctx.fillStyle = `rgba(0, 0, 0, ${0.7 * this.messageAlpha})`;
        this.roundRect(ctx, messageX - padding, messageY - textHeight,
                       textWidth + padding * 2, textHeight + padding * 2, 5);
        ctx.fill();

        // Обводка цветом танка
        ctx.strokeStyle = this.color + Math.floor(this.messageAlpha * 255).toString(16).padStart(2, '0');
        ctx.lineWidth = 1;
        this.roundRect(ctx, messageX - padding, messageY - textHeight,
                       textWidth + padding * 2, textHeight + padding * 2, 5);
        ctx.stroke();

        // Текст сообщения
        ctx.fillStyle = `rgba(255, 255, 255, ${this.messageAlpha})`;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(messageText, messageX, messageY);

        // Индикатор времени (полоска внизу)
        if (this.currentMessage) {
            const elapsed = Date.now() - this.messageStartTime;
            const timeProgress = 1 - (elapsed / this.currentMessage.displayTime);

            ctx.fillStyle = this.color;
            ctx.fillRect(messageX - padding, messageY + padding - 2,
                         (textWidth + padding * 2) * Math.max(0, timeProgress), 2);
        }

        ctx.restore();
    }

    roundRect(ctx, x, y, width, height, radius) {
        ctx.beginPath();
        ctx.moveTo(x + radius, y);
        ctx.lineTo(x + width - radius, y);
        ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
        ctx.lineTo(x + width, y + height - radius);
        ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
        ctx.lineTo(x + radius, y + height);
        ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
        ctx.lineTo(x, y + radius);
        ctx.quadraticCurveTo(x, y, x + radius, y);
        ctx.closePath();
    }


    // Метод для диагностики сообщений
    debugChatMessages() {

        this.chatMessages.forEach((msg, index) => {
            const elapsed = Date.now() - msg.timestamp;
        });
    }

    initPlayer(level) {
        this.playerLevel = 1;
        this.experience = 0;
        this.applyUpgrade(PLAYER_UPGRADES.LEVEL_1);
        this.checkLevelUp();
    }

    initEnemy(level, enemyType) {
        // Сохраняем изначальный тип (VIEWER или обычный тип)
        this.originalEnemyType = enemyType;
        this.enemyType = enemyType;

        // Если это зритель - выбираем случайный тип для определения характеристик
        if (enemyType === 'VIEWER') {
            const availableTypes = ['BASIC', 'FAST', 'HEAVY', 'SNIPER'];
            this.viewerPowerType = availableTypes[Math.floor(Math.random() * availableTypes.length)];
            this.isViewerTank = true;

            // Для здоровья и характеристик используем viewerPowerType
            const powerConfig = ENEMY_TYPES[this.viewerPowerType];
            const levelMultiplier = level === 1 ? 1 : 1.2;

            // УСИЛЕННАЯ ВЕРСИЯ СЛУЧАЙНОГО ТИПА
            this.health = powerConfig.health * 1; // ← Умножаем здоровье типа на 2

            // Для HEAVY: 3 × 2 = 6 HP
            // Для других: 1 × 2 = 2 HP

            this.reloadTime = Math.max(8, Math.floor(powerConfig.reloadTime * 0.666)); // В 1.5 раза быстрее
            this.speed = powerConfig.speed * TANK_SPEED * levelMultiplier; // скорость типа
            this.color = powerConfig.color; // цвет типа
            this.bulletSpeed = powerConfig.bulletSpeed; // скорость пуль типа
            this.bulletPower = 1;
            this.canDestroyConcrete = false;

            // Для звука используем viewerPowerType
            // originalEnemyType остаётся 'VIEWER' для идентификации как зритель
            // но для звука будем использовать специальную логику в getSoundType
        } else {
            // Обычный враг
            this.isViewerTank = false;
            const baseConfig = ENEMY_TYPES[enemyType];
            const levelMultiplier = level === 1 ? 1 : 1.2;

            this.speed = baseConfig.speed * TANK_SPEED * levelMultiplier;
            this.color = baseConfig.color;
            this.health = baseConfig.health;
            this.bulletSpeed = baseConfig.bulletSpeed;
            this.reloadTime = baseConfig.reloadTime;
            this.bulletPower = 1;
            this.canDestroyConcrete = false;
        }

        // Генерируем имя в зависимости от типа
        if (this.isViewerTank) {
            // Для зрителей используем специальные имена или обычные имена выбранного типа
            const viewerNames = ENEMY_NAMES.VIEWER || ['Зритель', 'Фанат', 'Подписчик'];
            const typeNames = ENEMY_NAMES[this.viewerPowerType] || ['Враг'];
            const allNames = [...viewerNames, ...typeNames];
            this.username = allNames[Math.floor(Math.random() * allNames.length)];
        } else {
            this.username = this.generateEnemyName(this.enemyType);
        }

        this.aiLevel = ENEMY_AI_LEVELS.BASIC;

        // Статистика
        this.levelStats = {
            shots: 0,
            wallsDestroyed: 0,
            playerKills: 0,
            baseDestroyed: false,
            totalScore: 0
        };

        this.initEnemyAI();
        this.determineBonus();
    }

    initCommonProperties() {
        this.spawnProtection = 0;
        this.shield = null;
        this.stuckTimer = 0;
        this.blinkTimer = 0;
        this.blinkAlpha = 1.0;
        this.blinkDirection = -1;
        this.tracks = [];
        this.lastTrackPos = this.position.clone();
        this.pathMemory = new Map();
        this.memoryTimer = 0;
        this.beaconRotation = 0;
        this.beaconFlashTimer = 0;
        this.iceCrystals = [];
        this.stuckCheckTimer = 0;
        this.lastPosition = this.position.clone();
        this.stuckTime = 0;
        this.escapeAttempts = 0;

        if (this.type === 'enemy') {
            this.initPatrolState();
            this.resetLevelStats();
        }
    }

    initEnemyAI() {
        if (this.type === 'enemy') {
            this.ai = this.aiLevel === ENEMY_AI_LEVELS.BASIC ? new BasicEnemyAI(this) : new EnemyAI(this);
        }
    }

    initPatrolState() {
        this.patrolState = 'MOVING';
        this.patrolTimer = 0;
        this.nextStateChangeTime = Date.now() + PATROL_BEHAVIOR.MOVE_MIN_TIME +
        Math.random() * (PATROL_BEHAVIOR.MOVE_MAX_TIME - PATROL_BEHAVIOR.MOVE_MIN_TIME);
        this.lookAroundDirection = this.direction;
        this.lookAroundProgress = 0;
        this.currentDirectionTime = 0;
        this.maxDirectionTime = 90;
    }

    // ДОБАВЛЕННЫЕ МЕТОДЫ ДЛЯ ИИ
    canSeePlayer(player, map) {
        if (!player || player.isDestroyed || !map) return false;

        const visionRange = VISION_RANGES[this.enemyType] || VISION_RANGES.BASIC;

        // Проверяем расстояние
        const distance = Math.sqrt(
            Math.pow(this.position.x - player.position.x, 2) +
            Math.pow(this.position.y - player.position.y, 2)
        );

        if (distance > visionRange) return false;

        // Проверяем линию видимости
        return this.hasLineOfSight(player.position.x, player.position.y, map);
    }

    hasLineOfSight(targetX, targetY, map) {
        if (!map || !map.checkCollision) return false;

        // Используем алгоритм Брезенхема для проверки линии
        const steps = 20;
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

            // Проверяем прямую видимость
            if (this.hasLineOfSight(enemy.position.x, enemy.position.y, map) && distance < nearestDistance) {
                nearestDistance = distance;
                nearestEnemy = enemy;
            }
        });

        return nearestEnemy;
    }

    getCurrentZone() {
        if (!game) return {x: 0, y: 0};
        return game.getZoneId(this.position.x, this.position.y);
    }

    getDirectionName(direction) {
        if (direction === DIRECTIONS.UP) return 'ВВЕРХ';
        if (direction === DIRECTIONS.DOWN) return 'ВНИЗ';
        if (direction === DIRECTIONS.LEFT) return 'ВЛЕВО';
        if (direction === DIRECTIONS.RIGHT) return 'ВПРАВО';
        return 'НЕИЗВЕСТНО';
    }

    getPatrolStateName() {
        const states = {
            'MOVING': '🚗 Движение',
            'STOPPED': '🛑 Остановка',
            'LOOKING_AROUND': '👀 Осмотр'
        };
        return states[this.patrolState] || this.patrolState;
    }

    // КОНЕЦ ДОБАВЛЕННЫХ МЕТОДОВ

    applyUpgrade(upgrade) {
        this.speed = upgrade.speed;
        this.color = upgrade.color;
        this.bulletSpeed = upgrade.bulletSpeed;
        this.reloadTime = upgrade.reloadTime;
        this.bulletPower = upgrade.bulletPower;
        this.canDestroyConcrete = upgrade.canDestroyConcrete;
        if (upgrade.health > (this.health || 0)) this.health = upgrade.health;
    }

    update() {
        if (this.isWreck && this.isDestroyed) {
            // 🔥 ОГАРКИ ОБНОВЛЯЮТ ТОЛЬКО СОСТОЯНИЕ БЛОКА
            this.updateWreckState();

            // 🔥 ОБНОВЛЯЕМ СООБЩЕНИЯ ЧАТА ДАЖЕ ДЛЯ ОГАРКОВ
            this.updateChatMessages();
            return;
        }

        if (this.isDestroyed) return;

        this.updateBaseZoneStatus();

        if (this.isFrozen) {
            this.updateFreezeState();
            return;
        }

        this.updateSpecialEffects();
        this.updateMovementSystems();
        this.updateCombatSystems();

        // 🔥 ОБНОВЛЕНИЕ СООБЩЕНИЙ ЧАТА
        this.updateChatMessages();
    }

    updateBaseZoneStatus() {
        if (this.type === 'enemy' && game) {
            const wasInBaseZone = this.isInBaseZone;
            this.isInBaseZone = game.isInBaseProtectedZone(this.position.x, this.position.y);

            if (this.isInBaseZone && !wasInBaseZone) {
                this.baseAttackMode = true;
                this.baseZoneEntryTime = Date.now();
            } else if (!this.isInBaseZone && wasInBaseZone) {
                this.baseAttackMode = false;
            }

            if (this.baseAttackMode) {
                this.beaconRotation += 0.2;
                this.beaconFlashTimer++;
            }
        }
    }

    updateFreezeState() {
        const elapsed = Date.now() - this.freezeStartTime;
        const progress = elapsed / this.freezeDuration;

        if (progress >= 1) {
            this.isFrozen = false;
            this.speed = this.originalSpeed;
            this.canShoot = this.originalCanShoot;
            this.iceCrystals = [];
        } else {
            if (progress < 0.1) {
                this.freezeProgress = progress * 10;
            } else if (progress > 0.92) {
                this.freezeProgress = 1 - ((progress - 0.92) * 12.5);
            } else {
                this.freezeProgress = 1;
            }
            this.updateIceCrystals();
        }
    }

    updateSpecialEffects() {
        if (this.isInvincible) this.updateInvincibility();
        if (this.hasAutoAim) this.updateAutoAim();
        if (this.hasBonus && this.type === 'enemy') this.updateBlink();
        if (this.shield && !this.shield.update()) this.shield = null;
        if (this.spawnProtection > 0) this.spawnProtection--;
    }

    updateMovementSystems() {
        if (this.type === 'enemy' && this.aiLevel === ENEMY_AI_LEVELS.BASIC) {
            this.updatePatrolState();
        }

        if (this.type === 'player' || this.type === 'enemy') {
            this.updateTracks();
            this.memoryTimer++;
            if (this.memoryTimer % 3 === 0) {
                this.addTrack();
                if (this.type === 'enemy') this.rememberPosition();
            }
        }
    }

    updateCombatSystems() {
        if (!this.canShoot) {
            this.reloadTime--;
            if (this.reloadTime <= 0) this.canShoot = true;
        }
        if (this.stuckTimer < 100) this.stuckTimer++;
    }

    updatePatrolState() {
        if (Date.now() >= this.nextStateChangeTime) this.changePatrolState();

        switch (this.patrolState) {
            case 'LOOKING_AROUND': this.updateLookAround(); break;
        }
    }

    changePatrolState() {
        const now = Date.now();

        switch (this.patrolState) {
            case 'MOVING':
                if (Math.random() < PATROL_BEHAVIOR.LOOK_AROUND_CHANCE) {
                    this.patrolState = 'LOOKING_AROUND';
                    this.lookAroundDirection = this.direction;
                    this.lookAroundProgress = 0;
                } else {
                    this.patrolState = 'STOPPED';
                }
                break;

            case 'STOPPED':
            case 'LOOKING_AROUND':
                this.patrolState = 'MOVING';
                if (Math.random() < PATROL_BEHAVIOR.DIRECTION_CHANGE_ON_STOP) {
                    this.changeRandomDirection();
                }
                break;
        }

        const time = this.patrolState === 'MOVING' ?
        PATROL_BEHAVIOR.MOVE_MIN_TIME + Math.random() * (PATROL_BEHAVIOR.MOVE_MAX_TIME - PATROL_BEHAVIOR.MOVE_MIN_TIME) :
        PATROL_BEHAVIOR.STOP_MIN_TIME + Math.random() * (PATROL_BEHAVIOR.STOP_MAX_TIME - PATROL_BEHAVIOR.STOP_MIN_TIME);

        this.nextStateChangeTime = now + time;
    }

    updateLookAround() {
        this.lookAroundProgress += 0.02;
        if (this.lookAroundProgress >= 1) {
            this.lookAroundProgress = 0;
            this.cycleLookAroundDirection();
        }
    }

    cycleLookAroundDirection() {
        const directions = [DIRECTIONS.UP, DIRECTIONS.RIGHT, DIRECTIONS.DOWN, DIRECTIONS.LEFT];
        const currentIndex = directions.findIndex(dir => dir.x === this.lookAroundDirection.x && dir.y === this.lookAroundDirection.y);
        this.lookAroundDirection = directions[(currentIndex + 1) % directions.length];
    }

    changeRandomDirection() {
        const directions = Object.values(DIRECTIONS).filter(dir => dir !== this.direction);
        this.direction = directions[Math.floor(Math.random() * directions.length)];
    }

    updateEnemyAI(map, otherTanks, brickFragments, player) {
        if (this.isDestroyed || this.type !== 'enemy' || !map || this.isFrozen) return;

        if (!this.ai) this.initAI();
        if (this.ai) this.ai.update(map, player, otherTanks, brickFragments);
    }

    initAI() {
        if (this.type === 'enemy') {
            this.ai = this.aiLevel === ENEMY_AI_LEVELS.BASIC ? new BasicEnemyAI(this) : new EnemyAI(this);
        }
    }

    move(newDirection, map, otherTanks = [], brickFragments = []) {
        if (this.isDestroyed || this.isFrozen) return false;

        const oldDirection = this.direction;
        this.direction = newDirection;

        if (this.baseAttackMode && game) {
            const newPos = this.position.add(new Vector2(this.direction.x, this.direction.y).multiply(this.speed));
            const baseZone = game.getBaseZone();
            const newZone = game.getZoneId(newPos.x, newPos.y);
            const distanceToBase = Math.max(Math.abs(newZone.x - baseZone.x), Math.abs(newZone.y - baseZone.y));
            if (distanceToBase > 2) {
                this.direction = oldDirection;
                return false;
            }
        }

        const newPos = this.position.add(new Vector2(this.direction.x, this.direction.y).multiply(this.speed));
        const tankBounds = new Rectangle(newPos.x - this.size/2 + 2, newPos.y - this.size/2 + 2, this.size - 4, this.size - 4);

        if (map?.checkCollision?.(tankBounds)) return false;
        if (otherTanks?.some(tank => tank !== this && !tank.isDestroyed && tankBounds.intersects(tank.getBounds()))) return false;

        const fragmentCollision = brickFragments?.some(fragment =>
        fragment.collisionEnabled && fragment.active && tankBounds.intersects(fragment.getBounds()));

        if (fragmentCollision) {
            const speedMultiplier = this.type === 'player' ? 0.6 : 0.8;
            const adjustedPos = this.position.add(new Vector2(this.direction.x, this.direction.y).multiply(this.speed * speedMultiplier));

            if (!this.isPositionInBounds(adjustedPos.x, adjustedPos.y)) return false;

            const adjustedBounds = new Rectangle(adjustedPos.x - this.size/2 + 2, adjustedPos.y - this.size/2 + 2, this.size - 4, this.size - 4);

            if (!map.checkCollision(adjustedBounds) &&
                !otherTanks?.some(tank => tank !== this && !tank.isDestroyed && adjustedBounds.intersects(tank.getBounds()))) {
                this.position = adjustedPos;
            return true;
                }
                return false;
        }

        this.position = newPos;
        return true;
    }

    shoot(nearestEnemy = null) {
        if (this.isDestroyed || !this.canShoot || this.isFrozen) return null;

        this.canShoot = false;

        // Настройка перезарядки
        if (this.type === 'player') {
            this.reloadTime = this.upgrade ? this.upgrade.reloadTime : 40;
        } else {
            this.reloadTime = this.getEnemyReloadTime();
        }

        let direction = this.direction;

        if (this.type === 'enemy' && this.baseAttackMode) {
            const baseDirection = this.getBaseShootDirection();
            if (baseDirection) {
                direction = baseDirection;
                this.direction = baseDirection;
            }
        }

        if (this.type === 'player' && this.hasAutoAim && nearestEnemy) {
            const dx = nearestEnemy.position.x - this.position.x;
            const dy = nearestEnemy.position.y - this.position.y;
            direction = Math.abs(dx) > Math.abs(dy) ?
            (dx > 0 ? DIRECTIONS.RIGHT : DIRECTIONS.LEFT) :
            (dy > 0 ? DIRECTIONS.DOWN : DIRECTIONS.UP);
        }

        const offset = new Vector2(direction.x, direction.y).multiply(this.size / 2 + 5);
        const bulletSpeed = this.bulletSpeed;

        const bullet = new Bullet(
            this.position.x + offset.x,
            this.position.y + offset.y,
            direction,
            this.type,
            this,
            this.hasAutoAim,
            nearestEnemy,
            this.bulletPower,
            bulletSpeed
        );

        if (this.type === 'enemy' && game && game.soundManager) {
            const soundType = this.getSoundType();
            game.soundManager.playEnemyShot(soundType);
        }

        return bullet;
    }

    // В классе Tank добавляем метод:
    getSoundType() {
        if (this.type === 'player') return 'player';

        if (this.type === 'enemy') {
            // Если это танк зрителя, используем viewerPowerType для звука
            if (this.isViewerTank && this.viewerPowerType) {
                return this.viewerPowerType;
            }
            // Иначе используем обычный тип
            return this.enemyType;
        }

        return 'enemy'; // fallback
    }

    // ДОБАВЬТЕ ЭТОТ МЕТОД ДЛЯ ВРАЖЕСКИХ ТАНКОВ
    getEnemyReloadTime() {
        // Если это зритель, используем viewerPowerType для определения базовой перезарядки
        if (this.isViewerTank && this.viewerPowerType) {
            const baseReload = ENEMY_TYPES[this.viewerPowerType].reloadTime;
            return Math.max(8, Math.floor(baseReload * 0.666)); // В 1.5 раза быстрее
        }

        // Обычные враги - из конфига
        return ENEMY_TYPES[this.enemyType].reloadTime;
    }

    getBaseShootDirection() {
        if (!this.isInBaseZone || !game?.map?.basePosition) return null;

        const basePos = game.map.basePosition;
        const currentZone = game.getZoneId(this.position.x, this.position.y);

        if (currentZone.y === 7) {
            if (currentZone.x <= 3) return DIRECTIONS.RIGHT;
            if (currentZone.x >= 5) return DIRECTIONS.LEFT;
        }
        if (currentZone.y === 5) return DIRECTIONS.DOWN;
        if (currentZone.y === 6) {
            if (currentZone.x <= 2) return DIRECTIONS.RIGHT;
            if (currentZone.x >= 6) return DIRECTIONS.LEFT;
        }

        const dx = basePos.x * TILE_SIZE - this.position.x;
        const dy = basePos.y * TILE_SIZE - this.position.y;
        return Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? DIRECTIONS.RIGHT : DIRECTIONS.LEFT) : (dy > 0 ? DIRECTIONS.DOWN : DIRECTIONS.UP);
    }

    // 🔥 ИСПРАВЛЕННЫЙ МЕТОД takeDamage
    takeDamage() {
        // 🔥 ОГАРКИ НЕ МОГУТ ПОЛУЧАТЬ УРОН
        if (this.isWreck && this.isDestroyed) {
            return false;
        }

        if (this.hasShield() || this.isInvincible) return false;

        this.health--;
        if (this.health <= 0) {
            // 🔥 ВСЕ ТАНКИ ПРЕВРАЩАЮТСЯ В ОГАРКИ
            this.turnIntoWreck();
            return 'wreck'; // Возвращаем специальный тип
        }
        return false;
    }

    addExperience(enemyType) {
        if (this.type !== 'player') return;

        const expGained = EXP_PER_KILL[enemyType] || 10;
        this.experience += expGained;
        this.checkLevelUp();
    }

    checkLevelUp() {
        const nextLevel = this.playerLevel + 1;
        const expRequired = EXP_REQUIREMENTS[nextLevel];

        if (expRequired && this.experience >= expRequired) {
            this.upgradeToLevel(nextLevel);
            this.checkLevelUp();
        }
    }

    upgradeToLevel(newLevel) {
        const upgradeKey = `LEVEL_${newLevel}`;
        const newUpgrade = PLAYER_UPGRADES[upgradeKey];
        if (!newUpgrade) return;

        this.playerLevel = newLevel;
        this.upgrade = newUpgrade;
        this.applyUpgrade(newUpgrade);

        if (game) {
            game.updatePlayerLevel(newLevel);
            game.effectManager.addExplosion(this.position.x, this.position.y, 'bonus');
            game.screenShake = 15;
        }
    }

    // Track system methods
    addTrack() {
        const distance = Math.sqrt(Math.pow(this.position.x - this.lastTrackPos.x, 2) + Math.pow(this.position.y - this.lastTrackPos.y, 2));
        if (distance >= TRACK_SYSTEM.TRACK_SPACING) {
            this.tracks.push({
                x: this.position.x, y: this.position.y, direction: this.direction,
                lifetime: TRACK_SYSTEM.TRACK_LIFETIME, alpha: 1.0,
                initialLifetime: TRACK_SYSTEM.TRACK_LIFETIME, isPlayer: this.type === 'player'
            });
            this.lastTrackPos = this.position.clone();
            if (this.tracks.length > 20) this.tracks.shift();
        }
    }

    updateTracks() {
        for (let i = this.tracks.length - 1; i >= 0; i--) {
            this.tracks[i].lifetime--;
            this.tracks[i].alpha = Math.pow(this.tracks[i].lifetime / this.tracks[i].initialLifetime, 1.5);
            if (this.tracks[i].lifetime <= 0) this.tracks.splice(i, 1);
        }
    }

    rememberPosition() {
        if (this.type !== 'enemy' || this.aiLevel !== ENEMY_AI_LEVELS.BASIC) return;

        const gridX = Math.floor(this.position.x / TRACK_SYSTEM.MEMORY_GRID_SIZE);
        const gridY = Math.floor(this.position.y / TRACK_SYSTEM.MEMORY_GRID_SIZE);
        const key = `${gridX},${gridY}`;

        const existing = this.pathMemory.get(key);
        this.pathMemory.set(key, {
            timestamp: this.memoryTimer,
            visits: (existing?.visits || 0) + 1
        });
    }

    getPositionPenalty(x, y) {
        if (this.type !== 'enemy' || this.aiLevel !== ENEMY_AI_LEVELS.BASIC) return 0;

        const gridX = Math.floor(x / TRACK_SYSTEM.MEMORY_GRID_SIZE);
        const gridY = Math.floor(y / TRACK_SYSTEM.MEMORY_GRID_SIZE);
        const key = `${gridX},${gridY}`;

        const memory = this.pathMemory.get(key);
        if (!memory) return 0;

        const timeSinceVisit = this.memoryTimer - memory.timestamp;
        if (timeSinceVisit < TRACK_SYSTEM.MEMORY_DECAY_TIME) {
            const recency = 1 - (timeSinceVisit / TRACK_SYSTEM.MEMORY_DECAY_TIME);
            return memory.visits * recency * 50;
        }

        return 0;
    }

    // Bonus and power-up methods
    determineBonus() {
        if (Math.random() < (BONUS_TANK_CHANCE || 0.2)) {
            this.hasBonus = true;
            const bonusTypes = Object.values(BONUS_TYPES || {
                LIFE: {id: 'LIFE', symbol: '❤️', color: '#FF4081'},
                SHIELD: {id: 'SHIELD', symbol: '🛡️', color: '#00BFFF'},
                TIME_STOP: {id: 'TIME_STOP', symbol: '⏰', color: '#00FFFF'}
            });
            this.bonusType = bonusTypes[Math.floor(Math.random() * bonusTypes.length)];
        }
    }

    updateBlink() {
        this.blinkTimer++;
        const blinkSpeed = 0.08;
        this.blinkAlpha += this.blinkDirection * blinkSpeed;

        if (this.blinkAlpha <= 0.5) {
            this.blinkAlpha = 0.5;
            this.blinkDirection = 1;
        } else if (this.blinkAlpha >= 1.0) {
            this.blinkAlpha = 1.0;
            this.blinkDirection = -1;
        }
    }

    activateShield(duration = 5000) {
        this.shield = new ShieldEffect(this);
        this.shield.duration = duration;
    }

    activateInvincibility(duration = 10000) {
        this.isInvincible = true;
        this.invincibilityDuration = duration;
        this.invincibilityTimer = 0;
        this.invincibilityBlink = 0;
    }

    updateInvincibility() {
        if (this.isInvincible) {
            this.invincibilityTimer += 16;
            this.invincibilityBlink++;
            if (this.invincibilityTimer >= this.invincibilityDuration) {
                this.isInvincible = false;
            }
        }
    }

    activateAutoAim(duration = 15000) {
        this.hasAutoAim = true;
        this.autoAimDuration = duration;
        this.autoAimTimer = 0;
        this.autoAimBlink = 0;
    }

    updateAutoAim() {
        if (this.hasAutoAim) {
            this.autoAimTimer += 16;
            this.autoAimBlink++;
            if (this.autoAimTimer >= this.autoAimDuration) {
                this.hasAutoAim = false;
                this.autoAimTimer = 0;
                this.autoAimDuration = 0;
                if (game) game.updateStatusIndicators();
            }
        }
    }

    freeze(duration) {
        if (this.type !== 'enemy') return;

        this.isFrozen = true;
        this.freezeStartTime = Date.now();
        this.freezeDuration = duration;
        this.originalSpeed = this.speed;
        this.originalCanShoot = this.canShoot;
        this.speed = 0;
        this.canShoot = false;
        this.createIceCrystals();
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

    updateIceCrystals() {
        this.iceCrystals.forEach(crystal => {
            crystal.rotation += 0.02;
            crystal.pulse += 0.1;
            crystal.growth = Math.min(1, crystal.growth + 0.1);
            crystal.alpha = this.freezeProgress;
        });
    }

    // Utility methods
    hasShield() { return this.shield && this.shield.active; }

    isPositionInBounds(x, y) {
        return x >= TILE_SIZE + this.size/2 &&
        x <= CANVAS_WIDTH - TILE_SIZE - this.size/2 &&
        y >= TILE_SIZE + this.size/2 &&
        y <= CANVAS_HEIGHT - TILE_SIZE - this.size/2;
    }

    getBounds() {
        return new Rectangle(
            this.position.x - this.size/2,
            this.position.y - this.size/2,
            this.size,
            this.size
        );
    }

    generateEnemyName(enemyType) {
        return (ENEMY_NAMES[enemyType] || ['Враг'])[Math.floor(Math.random() * (ENEMY_NAMES[enemyType] || ['Враг']).length)];
    }

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

            // Проверяем границы перед применением отталкивания
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

    // Statistics methods
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
            if (game) game.saveEnemyStatsToStorage(this);
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

    // Drawing methods
    draw(ctx) {
        // 🔥 ОГАРКИ
        if (this.isWreck && this.isDestroyed) {
            // 1. Модель огарка с искорками
            this.drawWreckModel(ctx);

            // 2. Инфоблок (если видим)
            if (this.infoVisible && this.infoAlpha > 0.05) {
                this.drawWreckInfoBlock(ctx);
            }
            return;
        }

        // 🔥 ЖИВЫЕ ТАНКИ
        if (this.isDestroyed) return;

        this.drawTracks(ctx);

        if (this.type === 'enemy' && this.ai && this.ai.debugShowMemory) {
            this.drawPathMemory(ctx);
        }

        ctx.save();
        ctx.translate(this.position.x, this.position.y);

        // ЭФФЕКТ РЕВЕРСА - ИНВЕРСИЯ ЦВЕТОВ
        if (this.isReversed) {
            const elapsed = Date.now() - this.reverseStartTime;
            const progress = elapsed / this.reverseDuration;

            if (progress < 1) {
                const pulse = (Math.sin(Date.now() * 0.005) + 1) * 0.3;
                ctx.filter = `hue-rotate(120deg) brightness(${1 + pulse})`;
            } else {
                // Автоматически сбрасываем когда время вышло
                this.isReversed = false;
            }
        }

        let angle = 0;
        if (this.direction === DIRECTIONS.RIGHT) angle = Math.PI / 2;
        else if (this.direction === DIRECTIONS.DOWN) angle = Math.PI;
        else if (this.direction === DIRECTIONS.LEFT) angle = -Math.PI / 2;
        ctx.rotate(angle);

        // Visual effects
        if (this.isInvincible && Math.floor(this.invincibilityBlink / 5) % 2 === 0) {
            ctx.globalAlpha = 0.3;
        } else if (this.spawnProtection > 0 && this.spawnProtection % 10 < 5) {
            ctx.globalAlpha = 0.5;
        }

        // === ВЫБОР МОДЕЛИ ===
        if (this.type === 'player') {
            // ТВОЙ ОРИГИНАЛЬНЫЙ ДИЗАЙН ИГРОКА
            this.drawOriginalPlayerTank(ctx);
        } else if (this.type === 'enemy') {
            // РАЗНЫЕ МОДЕЛИ ДЛЯ ВРАГОВ
            this.drawEnemyTankByType(ctx);
        }

        ctx.globalAlpha = 1.0;
        ctx.restore();

        // Additional effects
        if (this.baseAttackMode) this.drawBeacon(ctx);
        if (this.shield) this.shield.draw(ctx);
        if (this.isInvincible) this.drawInvincibilityEffect(ctx);
        if (this.hasBonus) this.drawBonusIcon(ctx);
        if (this.type === 'enemy' && this.username) this.drawEnemyInfo(ctx);
        if (this.isFrozen && this.freezeProgress > 0) this.drawFreezeEffect(ctx);
        if (this.type === 'enemy' && this.aiLevel === ENEMY_AI_LEVELS.BASIC) this.drawPatrolEffects(ctx);
    }

    drawWreckInfoBlock(ctx) {
        // 🔥 ЕСЛИ ИНФОБЛОК НЕВИДИМ ИЛИ СЛИШКОМ ПРОЗРАЧЕН - НЕ РИСУЕМ
        if (!this.infoVisible || this.infoAlpha <= 0.05) {
            return;
        }

        const username = this.originalUsername || this.username || 'Огарок';

        ctx.save();

        // 🔥 ПРИМЕНЯЕМ ПРОЗРАЧНОСТЬ ИНФОБЛОКА
        ctx.globalAlpha = this.infoAlpha;

        // 🔥 ПОДСЧИТАЕМ РАЗМЕРЫ
        const textHeight = 14;
        const padding = 6;

        // Ширина имени
        ctx.font = 'bold 12px Arial';
        const nameWidth = ctx.measureText(username.toUpperCase()).width;

        // Ширина сердечек
        const hearts = this.originalHealth || this.health || 1;
        const heartsWidth = hearts * 16;

        // 🔥 ПРОВЕРЯЕМ ЕСТЬ ЛИ СООБЩЕНИЕ
        let messageHeight = 0;
        let messageWidth = 0;

        if (this.currentMessage && this.currentMessage.isForWreck) {
            messageHeight = 20;
            const messageText = this.truncateTextWithEmojis(
                `${this.currentMessage.username}: ${this.currentMessage.message}`,
                30
            );
            messageWidth = this.measureTextWithEmojis(ctx, messageText);
        }

        const totalWidth = Math.max(nameWidth + heartsWidth + 20, messageWidth + 20);
        const blockHeight = textHeight + padding * 2 + messageHeight;

        // 🔥 ПОЗИЦИЯ (над огарком)
        const blockX = this.position.x - totalWidth/2;
        const blockY = this.position.y - this.size - blockHeight - 15;

        // 🔥 ФОН ИНФОБЛОКА
        ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
        ctx.fillRect(blockX, blockY, totalWidth, blockHeight);

        // 🔥 ОБВОДКА ЦВЕТОМ ТАНКА
        const strokeColor = this.originalColor || this.color || '#FFFFFF';
        ctx.strokeStyle = strokeColor + Math.floor(this.infoAlpha * 255).toString(16).padStart(2, '0');
        ctx.lineWidth = 2;
        ctx.strokeRect(blockX, blockY, totalWidth, blockHeight);

        // 🔥 ИМЯ
        let currentX = blockX + 8;
        const textY = blockY + textHeight/2 + padding;

        ctx.font = 'bold 12px Arial';
        ctx.fillStyle = '#FFFFFF';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(username.toUpperCase(), currentX, textY);
        currentX += nameWidth + 8;

        // 🔥 СЕРДЕЧКИ
        ctx.font = '12px "Segoe UI Emoji", "Apple Color Emoji", sans-serif';
        ctx.fillStyle = '#FF4444';
        for (let i = 0; i < hearts; i++) {
            ctx.fillText('❤️', currentX, textY);
            currentX += 16;
        }

        // 🔥 СООБЩЕНИЕ (если есть)
        if (this.currentMessage && this.currentMessage.isForWreck) {
            const messageText = this.truncateTextWithEmojis(
                `${this.currentMessage.username}: ${this.currentMessage.message}`,
                30
            );

            const messageY = blockY + textHeight + padding * 2 + 5;

            // Разделительная линия
            ctx.strokeStyle = strokeColor + '77';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(blockX + 4, blockY + textHeight + padding * 1.5);
            ctx.lineTo(blockX + totalWidth - 4, blockY + textHeight + padding * 1.5);
            ctx.stroke();

            // Текст сообщения
            ctx.fillStyle = '#FFFF00'; // Желтый для сообщений огарков
            ctx.font = 'normal 10px Arial';
            ctx.textAlign = 'left';

            const messageParts = this.splitTextWithEmojis(messageText);
            let msgX = blockX + 8;

            for (const part of messageParts) {
                if (this.isEmoji(part)) {
                    ctx.font = '14px "Segoe UI Emoji", "Apple Color Emoji", sans-serif';
                    ctx.fillText(part, msgX, messageY);
                    msgX += 18;
                } else {
                    ctx.font = 'normal 10px Arial';
                    ctx.fillText(part, msgX, messageY);
                    msgX += ctx.measureText(part).width;
                }
            }

            // 🔥 ИНДИКАТОР ВРЕМЕНИ СООБЩЕНИЯ
            const elapsed = Date.now() - this.currentMessage.timestamp;
            const timeLeft = Math.max(0, 8000 - elapsed);
            const timeProgress = timeLeft / 8000;

            ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
            ctx.fillRect(blockX + 8, blockY + blockHeight - 4, totalWidth - 16, 2);

            ctx.fillStyle = timeProgress > 0.5 ? '#4CAF50' :
            timeProgress > 0.2 ? '#FF9800' : '#F44336';
            ctx.fillRect(blockX + 8, blockY + blockHeight - 4,
                         (totalWidth - 16) * timeProgress, 2);
        }

        // 🔥 АВАТАРКА
        if ((this.originalAvatarImage || this.avatarImage) &&
            (this.isViewerTank || this.originalEnemyType === 'VIEWER')) {

            this.drawWreckAvatar(ctx, blockX, blockY, blockHeight);
            }

            ctx.restore();
    }

    drawWreckAvatar(ctx, blockX, blockY, blockHeight) {
        const avatarSize = blockHeight - 4;
        const avatarX = blockX - avatarSize - 5;
        const avatarY = blockY + (blockHeight - avatarSize) / 2;

        ctx.save();

        // 🔥 ПРИМЕНЯЕМ ПРОЗРАЧНОСТЬ АВАТАРКИ
        ctx.globalAlpha = this.avatarAlpha;

        // 🔥 КРУГЛАЯ МАСКА
        const centerX = avatarX + avatarSize/2;
        const centerY = avatarY + avatarSize/2;

        ctx.beginPath();
        ctx.arc(centerX, centerY, avatarSize/2, 0, Math.PI * 2);
        ctx.clip();

        // 🔥 РИСУЕМ АВАТАРКУ
        const img = this.originalAvatarImage || this.avatarImage;
        if (img) {
            const aspectRatio = img.width / img.height;

            let drawWidth, drawHeight, offsetX, offsetY;

            if (aspectRatio > 1) {
                drawWidth = avatarSize;
                drawHeight = avatarSize / aspectRatio;
                offsetX = 0;
                offsetY = (avatarSize - drawHeight) / 2;
            } else {
                drawWidth = avatarSize * aspectRatio;
                drawHeight = avatarSize;
                offsetX = (avatarSize - drawWidth) / 2;
                offsetY = 0;
            }

            ctx.drawImage(img, avatarX + offsetX, avatarY + offsetY, drawWidth, drawHeight);
        } else {
            // 🔥 ЗАГЛУШКА ЕСЛИ НЕТ АВАТАРКИ
            ctx.fillStyle = '#666666';
            ctx.fillRect(avatarX, avatarY, avatarSize, avatarSize);

            ctx.fillStyle = '#FFFFFF';
            ctx.font = 'bold 10px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('👤', centerX, centerY);
        }

        // 🔥 ОЧЕНЬ ПРОЗРАЧНАЯ ОБВОДКА
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(centerX, centerY, avatarSize/2, 0, Math.PI * 2);
        ctx.stroke();

        ctx.restore();

        // 🔥 ЛИНИЯ К ИНФОБЛОКУ
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(avatarX + avatarSize, centerY);
        ctx.lineTo(blockX, centerY);
        ctx.stroke();
    }

    // 🔥 ИСПРАВЛЕННЫЙ МЕТОД БЕЗ АРТЕФАКТОВ
    drawWreckModel(ctx) {
        if (!this.isWreck || !this.isDestroyed) return;

        // 🔥 1. РИСУЕМ ТЕНЬ (СНАЧАЛА!)
        this.drawWreckShadow(ctx);

        // 🔥 2. РИСУЕМ МОДЕЛЬ ТАНКА
        ctx.save();
        ctx.translate(this.position.x, this.position.y);

        ctx.globalAlpha = this.wreckAlpha;

        let angle = 0;
        if (this.direction === DIRECTIONS.RIGHT) angle = Math.PI / 2;
        else if (this.direction === DIRECTIONS.DOWN) angle = Math.PI;
        else if (this.direction === DIRECTIONS.LEFT) angle = -Math.PI / 2;
        ctx.rotate(angle);

        const halfSize = this.size / 2;

        // 🔥 КОРПУС
        ctx.fillStyle = this.wreckBodyColor || '#444444';
        ctx.fillRect(-halfSize * 0.8, -halfSize * 0.6, this.size * 0.8, this.size * 0.6);

        ctx.strokeStyle = '#222222';
        ctx.lineWidth = 1;
        ctx.strokeRect(-halfSize * 0.8, -halfSize * 0.6, this.size * 0.8, this.size * 0.6);

        // 🔥 ГУСЕНИЦЫ
        ctx.fillStyle = this.wreckTrackColor || '#333333';
        const trackWidth = this.size * 0.2;
        const trackHeight = this.size * 0.7;
        const trackY = -trackHeight/2;

        ctx.fillRect(-halfSize * 0.9, trackY, trackWidth, trackHeight);
        ctx.fillRect(halfSize * 0.7, trackY, trackWidth, trackHeight);

        ctx.strokeStyle = '#1A1A1A';
        ctx.lineWidth = 1;
        ctx.strokeRect(-halfSize * 0.9, trackY, trackWidth, trackHeight);
        ctx.strokeRect(halfSize * 0.7, trackY, trackWidth, trackHeight);

        // 🔥 БАШНЯ
        ctx.fillStyle = this.wreckTurretColor || '#555555';
        const turretRadius = this.size / 4;
        ctx.beginPath();
        ctx.arc(0, 0, turretRadius, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = '#333333';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, turretRadius, 0, Math.PI * 2);
        ctx.stroke();

        // 🔥 ДУЛО
        ctx.fillStyle = this.wreckBarrelColor || '#666666';
        const barrelWidth = this.size * 0.12;
        const barrelLength = this.size * 0.5;

        ctx.fillRect(-barrelWidth/2, -barrelLength - 2, barrelWidth, barrelLength);

        ctx.strokeStyle = '#444444';
        ctx.lineWidth = 1;
        ctx.strokeRect(-barrelWidth/2, -barrelLength - 2, barrelWidth, barrelLength);

        ctx.restore();


        // 🔥 3. РИСУЕМ ИСКОРКИ (ПОВЕРХ ТАНКА)
        this.drawSparks(ctx);
    }

    // 🔥 УСИЛЕННЫЕ ИСКОРКИ ПРИ АКТИВНОСТИ (сообщение или наведение)
    createEnhancedSpark() {
        if (this.sparks.length >= this.maxSparks * 2) return;

        const angle = Math.random() * Math.PI * 2;
        const distance = this.size * (0.2 + Math.random() * 0.6);

        const spark = {
            x: Math.cos(angle) * distance,
            y: Math.sin(angle) * distance,
            size: 2 + Math.random() * 4, // БОЛЬШЕ
            speedX: (Math.random() - 0.5) * 2.5, // БЫСТРЕЕ
            speedY: -2 - Math.random() * 3,      // ВЫШЕ
            life: 30 + Math.random() * 60,       // ДОЛЬШЕ
            maxLife: 30 + Math.random() * 60,
            color: this.sparkColors[Math.floor(Math.random() * this.sparkColors.length)],
            flicker: Math.random() * Math.PI * 2,
            isEnhanced: true // Помечаем как усиленную
        };

        this.sparks.push(spark);
    }


    // 🔥 МЕТОД ДЛЯ СОЗДАНИЯ НОВОЙ ИСКОРКИ
    createSpark() {
        if (this.sparks.length >= this.maxSparks) return;

        // Случайная позиция вокруг танка
        const angle = Math.random() * Math.PI * 2;
        const distance = this.size * (0.3 + Math.random() * 0.4);

        const spark = {
            x: Math.cos(angle) * distance,
            y: Math.sin(angle) * distance,
            size: 1 + Math.random() * 3, // Размер
            speedX: (Math.random() - 0.5) * 1.5, // Горизонтальная скорость
            speedY: -1 - Math.random() * 2,      // Вверх (отрицательная)
            life: 20 + Math.random() * 40,       // Время жизни
            maxLife: 20 + Math.random() * 40,
            color: this.sparkColors[Math.floor(Math.random() * this.sparkColors.length)],
            flicker: Math.random() * Math.PI * 2 // Для мерцания
        };

        this.sparks.push(spark);
    }

    updateSparks() {
        if (!this.isWreck || !this.isDestroyed) return;

        // 🔥 СОЗДАЕМ НОВЫЕ ИСКОРКИ ПЕРИОДИЧЕСКИ
        this.sparkTimer++;
        if (this.sparkTimer >= this.sparkInterval) {
            this.sparkTimer = 0;

            // 50% шанс создать искорку
            if (Math.random() < 0.5) {
                this.createSpark();
            }
        }

        // 🔥 ОБНОВЛЯЕМ СУЩЕСТВУЮЩИЕ ИСКОРКИ
        for (let i = this.sparks.length - 1; i >= 0; i--) {
            const spark = this.sparks[i];

            // Движение
            spark.x += spark.speedX;
            spark.y += spark.speedY;

            // Гравитация (легкая)
            spark.speedY += 0.05;

            // Уменьшаем жизнь
            spark.life--;

            // Удаляем если умерла
            if (spark.life <= 0) {
                this.sparks.splice(i, 1);
            }
        }
    }

    // 🔥 МЕТОД ОТРИСОВКИ ИСКОРОК
    drawSparks(ctx) {
        if (!this.isWreck || !this.isDestroyed || this.sparks.length === 0) return;

        ctx.save();
        ctx.translate(this.position.x, this.position.y);

        this.sparks.forEach(spark => {
            // 🔥 ПРОЗРАЧНОСТЬ ПО ЖИЗНИ
            const alpha = spark.life / spark.maxLife;

            // 🔥 МЕРЦАНИЕ
            const flicker = Math.sin(spark.flicker + Date.now() * 0.01) * 0.3 + 0.7;
            ctx.globalAlpha = alpha * flicker;

            // 🔥 ЦВЕТ ИСКОРКИ
            ctx.fillStyle = spark.color;

            // 🔥 РИСУЕМ ИСКОРКУ (крошечный круг)
            ctx.beginPath();
            ctx.arc(spark.x, spark.y, spark.size, 0, Math.PI * 2);
            ctx.fill();

            // 🔥 СВЕЧЕНИЕ ВОКРУГ ИСКОРКИ
            if (alpha > 0.5) {
                const glowRadius = spark.size * 2;
                const gradient = ctx.createRadialGradient(
                    spark.x, spark.y, 0,
                    spark.x, spark.y, glowRadius
                );

                // Конвертируем hex в rgba для использования с альфа-каналом
                const rgbColor = this.hexToRgb(spark.color);
                if (rgbColor) {
                    // Первый цветовой стоп - непрозрачный
                    gradient.addColorStop(0, `rgba(${rgbColor.r}, ${rgbColor.g}, ${rgbColor.b}, ${alpha})`);
                    // Второй - полностью прозрачный
                    gradient.addColorStop(1, `rgba(${rgbColor.r}, ${rgbColor.g}, ${rgbColor.b}, 0)`);
                }

                ctx.globalAlpha = alpha * 0.3;
                ctx.fillStyle = gradient;

                ctx.beginPath();
                ctx.arc(spark.x, spark.y, glowRadius, 0, Math.PI * 2);
                ctx.fill();
            }
        });

        ctx.restore();
    }

    // 🔥 ВСПОМОГАТЕЛЬНЫЙ МЕТОД ДЛЯ КОНВЕРТАЦИИ HEX В RGB
    hexToRgb(hex) {
        // Удаляем # если есть
        hex = hex.replace(/^#/, '');

        // Проверяем длину
        if (hex.length === 3) {
            hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
        }

        const bigint = parseInt(hex, 16);
        if (isNaN(bigint)) return null;

        return {
            r: (bigint >> 16) & 255,
            g: (bigint >> 8) & 255,
            b: bigint & 255
        };
    }

    drawWreckShadow(ctx) {
        if (!this.isWreck || !this.isDestroyed) return;

        ctx.save();

        // Тень под танком
        const shadowSize = this.size * 1.2;
        const shadowY = this.position.y + this.size * 0.3;

        const gradient = ctx.createRadialGradient(
            this.position.x, shadowY, shadowSize * 0.3,
            this.position.x, shadowY, shadowSize * 0.8
        );

        gradient.addColorStop(0, 'rgba(0, 0, 0, 0.4)');
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.ellipse(
            this.position.x, shadowY,
            shadowSize * 0.5, shadowSize * 0.3,
            0, 0, Math.PI * 2
        );
        ctx.fill();

        ctx.restore();
    }

    clearAllEffects() {
        // 🔥 ОЧИЩАЕМ ВСЕ ВИЗУАЛЬНЫЕ ЭФФЕКТЫ КОТОРЫЕ МОГУТ ВЫЗЫВАТЬ АРТЕФАКТЫ

        // Частицы и эффекты
        this.iceCrystals = [];
        this.reverseParticles = [];
        this.freezeParticles = [];
        this.tracks = []; // 🔥 ОЧИЩАЕМ СЛЕДЫ!

        // Анимации
        this.blinkTimer = 0;
        this.blinkAlpha = 1.0;
        this.blinkDirection = -1;

        // Таймеры
        this.beaconRotation = 0;
        this.beaconFlashTimer = 0;

        // Эффекты состояния
        this.stuckTimer = 0;
        this.spawnProtection = 0;

        // 🔥 ОЧЕНЬ ВАЖНО: ОЧИЩАЕМ pathMemory если есть
        if (this.pathMemory) {
            this.pathMemory.clear();
        }

        console.log(`🧹 Очищены все эффекты для огарка ${this.username}`);
    }

    // 🔥 ОТРИСОВКА ОГАРКА (УПРОЩЕННАЯ МОДЕЛЬ)
    drawWreck(ctx) {
        if (!this.isWreck || !this.isDestroyed) return;

        ctx.save();
        ctx.translate(this.position.x, this.position.y);

        // 🔥 ПРИМЕНЯЕМ ПРОЗРАЧНОСТЬ В ЗАВИСИМОСТИ ОТ ТИПА
        ctx.globalAlpha = this.wreckAlpha;

        let angle = 0;
        if (this.direction === DIRECTIONS.RIGHT) angle = Math.PI / 2;
        else if (this.direction === DIRECTIONS.DOWN) angle = Math.PI;
        else if (this.direction === DIRECTIONS.LEFT) angle = -Math.PI / 2;
        ctx.rotate(angle);

        // ОБУГЛЕННЫЙ ВАРИАНТ ТАНКА
        const halfSize = this.size / 2;

        // Корпус (очень темный)
        ctx.fillStyle = this.type === 'player' ? '#1A1A1A' : '#2C2C2C';
        ctx.fillRect(-halfSize * 0.8, -halfSize * 0.6, this.size * 0.8, this.size * 0.6);

        // Гусеницы (еще темнее)
        ctx.fillStyle = '#1A1A1A';
        const trackWidth = this.size * 0.2;
        const trackHeight = this.size * 0.7;
        const trackY = -trackHeight/2;

        ctx.fillRect(-halfSize * 0.9, trackY, trackWidth, trackHeight);
        ctx.fillRect(halfSize * 0.7, trackY, trackWidth, trackHeight);

        // Башня (угольная)
        ctx.fillStyle = '#333';
        const turretRadius = this.size / 4;
        ctx.beginPath();
        ctx.arc(0, 0, turretRadius, 0, Math.PI * 2);
        ctx.fill();

        // 🔥 ДУЛО (сломанное)
        ctx.fillStyle = '#555';
        const barrelWidth = this.size * 0.1;
        const barrelLength = this.size * 0.5; // Короче обычного
        ctx.fillRect(-barrelWidth/2, -barrelLength - 2, barrelWidth, barrelLength);

        // 🔥 ЭФФЕКТ ИСКР ПРИ АКТИВНОСТИ ОТ ЧАТА
        if (this.infoBlockChatActivated) {
            const pulse = (Math.sin(Date.now() * 0.005) + 1) * 0.3;
            ctx.fillStyle = `rgba(255, 150, 0, ${0.2 + pulse * 0.2})`;
            ctx.beginPath();
            ctx.arc(0, 0, turretRadius * 1.5, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.restore();

        // 🔥 ОСОБАЯ ОТРИСОВКА ДЛЯ ТАНКОВ ЗРИТЕЛЕЙ С АВАТАРКОЙ
        if ((this.isViewerTank || this.enemyType === 'VIEWER') && this.avatarImage) {
            this.drawFadedAvatar(ctx);
        }
    }

    drawFadedAvatar(ctx) {
        if (!this.isWreck || !this.avatarImage || this.avatarError) return;

        ctx.save();
        ctx.translate(this.position.x, this.position.y);

        // 🔥 ПРИМЕНЯЕМ МГНОВЕННОЕ ЗАТЕМНЕНИЕ
        ctx.globalAlpha = this.avatarFadeAlpha;

        const avatarSize = this.size;
        const img = this.avatarImage;
        const aspectRatio = img.width / img.height;

        let drawWidth, drawHeight, offsetX, offsetY;

        if (aspectRatio > 1) {
            drawWidth = avatarSize;
            drawHeight = avatarSize / aspectRatio;
            offsetX = 0;
            offsetY = (avatarSize - drawHeight) / 2;
        } else {
            drawWidth = avatarSize * aspectRatio;
            drawHeight = avatarSize;
            offsetX = (avatarSize - drawWidth) / 2;
            offsetY = 0;
        }

        // Создаем круглую маску для аватарки
        ctx.beginPath();
        ctx.arc(0, 0, avatarSize / 2, 0, Math.PI * 2);
        ctx.clip();

        // Отрисовываем бледную аватарку
        ctx.drawImage(img, -drawWidth/2 + offsetX, -drawHeight/2 + offsetY, drawWidth, drawHeight);

        ctx.restore();
    }

    // 🔥 МЕТОД ДЛЯ СБРОСА АВАТАРКИ ПРИ НОВОМ РАУНДЕ
    resetAvatarState() {
        // Сбрасываем состояние загрузки, но сохраняем изображение
        this.avatarLoaded = false;
        this.avatarError = false;
        this.avatarLoading = false;
        this.avatarShowProgress = 0;

        // 🔥 ВАЖНО: НЕ обнуляем this.avatarImage!
        // Он может быть закэширован и использоваться повторно

        // Если был URL - пытаемся перезагрузить
        if (this.avatarUrl && this.avatarUrl !== '') {
            this.loadAvatar();
        }
    }

    // 🔥 УПРОЩЕННЫЙ МЕТОД drawEnemyInfoWithAlpha
    drawEnemyInfoWithAlpha(ctx) {
        if (!this.username || this.infoBlockAlpha <= 0.01) return;

        ctx.save();

        // 🔥 ПРИМЕНЯЕМ ПРОЗРАЧНОСТЬ БЛОКА
        ctx.globalAlpha = this.infoBlockAlpha;

        // 🔥 ВЫЗЫВАЕМ СУЩЕСТВУЮЩИЙ МЕТОД - ОН САМ ОТРИСУЕТ СООБЩЕНИЕ ИЗ currentMessage
        this.drawUnifiedEnemyInfoAtPosition(ctx, this.position.x, this.position.y);

        ctx.restore();
    }

    // 🔥 МЕТОД ДЛЯ ОТРИСОВКИ СООБЩЕНИЙ ОГАРКА
    drawWreckChatMessage(ctx) {
        if (!this.wreckChatMessage || this.wreckMessageAlpha <= 0.01) return;

        // Позиция для сообщения (под основным блоком)
        const messageY = this.position.y - this.size - 60;

        // Текст сообщения
        const messageText = `${this.wreckChatMessage.username}: ${this.wreckChatMessage.message}`;

        // Подготавливаем контекст
        ctx.save();
        ctx.translate(this.position.x, messageY);

        // 🔥 ПРИМЕНЯЕМ ПРОЗРАЧНОСТЬ СООБЩЕНИЯ
        ctx.globalAlpha = this.wreckMessageAlpha;

        // Шрифт
        ctx.font = 'bold 11px Arial';
        const textWidth = ctx.measureText(messageText).width;
        const textHeight = 14;
        const padding = 6;

        // Позиционируем по центру
        const messageX = -textWidth / 2;

        // Фон сообщения
        ctx.fillStyle = `rgba(0, 0, 0, 0.7)`;
        this.roundRect(ctx, messageX - padding, -textHeight,
                       textWidth + padding * 2, textHeight + padding * 2, 5);
        ctx.fill();

        // Обводка цветом танка
        ctx.strokeStyle = this.color + Math.floor(this.wreckMessageAlpha * 255).toString(16).padStart(2, '0');
        ctx.lineWidth = 1;
        this.roundRect(ctx, messageX - padding, -textHeight,
                       textWidth + padding * 2, textHeight + padding * 2, 5);
        ctx.stroke();

        // Текст сообщения
        ctx.fillStyle = `rgba(255, 255, 255, 1)`;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(messageText, messageX, 0);

        // 🔥 ИНДИКАТОР ВРЕМЕНИ (полоска внизу)
        if (this.wreckMessageTimer > 0) {
            const totalTime = 300; // 5 секунд
            const timeProgress = this.wreckMessageTimer / totalTime;

            ctx.fillStyle = this.color;
            ctx.fillRect(messageX - padding, padding - 2,
                         (textWidth + padding * 2) * Math.max(0, timeProgress), 2);
        }

        ctx.restore();
    }

    // === ТВОЙ ОРИГИНАЛЬНЫЙ ДИЗАЙН ТАНКА ИГРОКА ===
    drawOriginalPlayerTank(ctx) {
        const halfSize = this.size / 2;

        // 1. МАССИВНЫЙ КВАДРАТНЫЙ КОРПУС
        ctx.fillStyle = this.color;

        // Основной массивный корпус
        ctx.fillRect(-halfSize * 0.8, -halfSize * 0.7, this.size * 0.8, this.size * 0.7);

        // 2. ШИРОКИЕ ГУСЕНИЦЫ (занимают почти всю высоту)
        const trackWidth = this.size * 0.3;
        const trackHeight = this.size * 0.9;
        const trackY = -trackHeight/2;

        // Левая гусеница с ШИРОКИМИ траками
        this.drawHeavyTrack(ctx, -halfSize * 1.5, trackY, trackWidth, trackHeight);

        // Правая гусеница
        this.drawHeavyTrack(ctx, halfSize * 0.9, trackY, trackWidth, trackHeight);

        // 3. МНОГООПОРНАЯ ПОДВЕСКА (много маленьких катков)
        ctx.fillStyle = '#7F8C8D';
        const smallRollerCount = 8;
        const smallRollerRadius = this.size * 0.04;

        // Левые катки
        for (let i = 0; i < smallRollerCount; i++) {
            const x = -halfSize * 1.05;
            const y = trackY + (i * (trackHeight / (smallRollerCount - 1)));

            // Каток
            ctx.beginPath();
            ctx.arc(x, y, smallRollerRadius, 0, Math.PI * 2);
            ctx.fill();

            // Поддерживающий ролик сверху
            if (i < smallRollerCount - 1) {
                const topY = y + (trackHeight / (smallRollerCount - 1)) / 2;
                ctx.beginPath();
                ctx.arc(x - trackWidth * 0.3, topY, smallRollerRadius * 0.7, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        // Правые катки
        for (let i = 0; i < smallRollerCount; i++) {
            const x = halfSize * 1.1;
            const y = trackY + (i * (trackHeight / (smallRollerCount - 1)));

            ctx.beginPath();
            ctx.arc(x, y, smallRollerRadius, 0, Math.PI * 2);
            ctx.fill();

            if (i < smallRollerCount - 1) {
                const topY = y + (trackHeight / (smallRollerCount - 1)) / 2;
                ctx.beginPath();
                ctx.arc(x + trackWidth * 0.3, topY, smallRollerRadius * 0.7, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        // 4. БАШНЯ (оставляем твою оригинальную)
        this.drawTurret(ctx);

        // 5. ДУЛО (зависит от уровня)
        const barrelWidth = this.size * (0.15 + (this.playerLevel * 0.015));
        const barrelLength = this.size * 0.8;
        ctx.fillStyle = '#333';
        ctx.fillRect(-barrelWidth/2, -barrelLength - 2, barrelWidth, barrelLength);

        // 6. ИНДИКАТОР УРОВНЯ
        if (this.playerLevel > 1) {
            this.drawLevelIndicator(ctx);
        }

        // 7. УСТРОЙСТВО АВТО-ПРИЦЕЛА
        if (this.hasAutoAim) {
            this.drawAutoAimDevice(ctx);
        }
    }

    // === МЕТОД ГУСЕНИЦ (твой оригинальный) ===
    drawHeavyTrack(ctx, x, y, width, height) {
        ctx.save();
        ctx.translate(x, y);

        // Основа гусеницы
        ctx.fillStyle = '#2C3E50';
        ctx.fillRect(0, 0, width, height);

        // ШИРОКИЕ ТРАКИ с развитым грунтозацепом
        ctx.fillStyle = '#34495E';
        const trackCount = 12; // Много траков для тяжёлого танка

        for (let i = 0; i < trackCount; i++) {
            const trackY = i * (height / trackCount);
            const trackHeightSegment = height / trackCount;

            // Основная пластина трака
            ctx.fillRect(width * 0.05, trackY + 1, width * 0.9, trackHeightSegment - 2);

            // Грунтозацепы (шипы)
            ctx.fillStyle = '#1A1A1A';

            // Центральный грунтозацеп
            ctx.fillRect(width * 0.4, trackY + trackHeightSegment * 0.1, width * 0.2, trackHeightSegment * 0.8);

            // Боковые грунтозацепы
            ctx.fillRect(width * 0.1, trackY + trackHeightSegment * 0.3, width * 0.2, trackHeightSegment * 0.4);
            ctx.fillRect(width * 0.7, trackY + trackHeightSegment * 0.3, width * 0.2, trackHeightSegment * 0.4);

            ctx.fillStyle = '#34495E';
        }

        // Боковые направляющие гребни
        ctx.fillStyle = '#1A1A1A';
        ctx.fillRect(0, 0, width * 0.05, height);
        ctx.fillRect(width * 0.95, 0, width * 0.05, height);

        ctx.restore();
    }

    // === МЕТОДЫ ДЛЯ ВРАГОВ (оставляем из предыдущего ответа) ===
    drawEnemyTankByType(ctx) {
        // Если это зритель - рисуем соответствующий тип танка
        if (this.isViewerTank && this.viewerPowerType) {
            switch(this.viewerPowerType) {
                case 'BASIC':
                    this.drawBasicEnemy(ctx);
                    break;
                case 'FAST':
                    this.drawFastEnemy(ctx);
                    break;
                case 'HEAVY':
                    this.drawHeavyEnemy(ctx);
                    break;
                case 'SNIPER':
                    this.drawSniperEnemy(ctx);
                    break;
                default:
                    this.drawBasicEnemy(ctx);
            }
        } else {
            // Обычные враги
            switch(this.enemyType) {
                case 'BASIC':
                    this.drawBasicEnemy(ctx);
                    break;
                case 'FAST':
                    this.drawFastEnemy(ctx);
                    break;
                case 'HEAVY':
                    this.drawHeavyEnemy(ctx);
                    break;
                case 'SNIPER':
                    this.drawSniperEnemy(ctx);
                    break;
                default:
                    this.drawBasicEnemy(ctx);
            }
        }
    }

    // === 1. БАЗОВЫЙ ВРАГ (стандартный) ===
    drawBasicEnemy(ctx) {
        const halfSize = this.size / 2;

        // КОРПУС: квадратный, простой
        ctx.fillStyle = this.color || '#C0392B'; // Красный

        // Основной корпус
        ctx.fillRect(-halfSize * 0.8, -halfSize * 0.6, this.size * 0.8, this.size * 0.6);

        // Гусеницы
        ctx.fillStyle = '#2C3E50';
        const trackWidth = this.size * 0.2;
        const trackHeight = this.size * 0.7;
        const trackY = -trackHeight/2;

        // Левая гусеница
        ctx.fillRect(-halfSize * 0.9, trackY, trackWidth, trackHeight);

        // Правая гусеница
        ctx.fillRect(halfSize * 0.7, trackY, trackWidth, trackHeight);

        // Траки (простые полоски)
        ctx.fillStyle = '#34495E';
        for (let i = 0; i < 6; i++) {
            const y = trackY + i * (trackHeight / 6);
            // Левые траки
            ctx.fillRect(-halfSize * 0.9 + 2, y + 2, trackWidth - 4, 3);
            // Правые траки
            ctx.fillRect(halfSize * 0.7 + 2, y + 2, trackWidth - 4, 3);
        }

        // БАШНЯ: круглая, простая
        ctx.fillStyle = '#E74C3C';
        const turretRadius = this.size / 3.5;
        ctx.beginPath();
        ctx.arc(0, 0, turretRadius, 0, Math.PI * 2);
        ctx.fill();

        // МАЯЧОК БОНУСА (если есть)
        if (this.hasBonus) {
            this.drawBonusBeacon(ctx);
        }

        // ДУЛО: короткое
        const barrelWidth = this.size * 0.15;
        const barrelLength = this.size * 0.6;
        ctx.fillStyle = '#2C3E50';
        ctx.fillRect(-barrelWidth/2, -barrelLength - 2, barrelWidth, barrelLength);

        // ИКОНКА ТИПА
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 12px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('⚫', 0, 0); // Чёрный круг для базового
    }

    // === 2. БЫСТРЫЙ ВРАГ (лёгкий, обтекаемый) ===
    drawFastEnemy(ctx) {
        const halfSize = this.size / 2;

        // КОРПУС: обтекаемый, низкий
        ctx.fillStyle = this.color || '#F39C12'; // Оранжевый

        // Овальный корпус
        ctx.beginPath();
        ctx.ellipse(0, 0, halfSize * 0.7, halfSize * 0.5, 0, 0, Math.PI * 2);
        ctx.fill();

        // ГУСЕНИЦЫ: узкие, для скорости
        ctx.fillStyle = '#2C3E50';
        const trackWidth = this.size * 0.15;
        const trackHeight = this.size * 0.6;
        const trackY = -trackHeight/2;

        // Левая гусеница
        ctx.fillRect(-halfSize * 0.85, trackY, trackWidth, trackHeight);

        // Правая гусеница
        ctx.fillRect(halfSize * 0.7, trackY, trackWidth, trackHeight);

        // БОЛЬШИЕ КАТКИ (для скорости)
        ctx.fillStyle = '#7F8C8D';
        const rollerRadius = this.size * 0.06;

        // Левые катки (3 больших)
        for (let i = 0; i < 3; i++) {
            const y = trackY + i * (trackHeight / 2);
            ctx.beginPath();
            ctx.arc(-halfSize * 0.77, y, rollerRadius, 0, Math.PI * 2);
            ctx.fill();
        }

        // Правые катки
        for (let i = 0; i < 3; i++) {
            const y = trackY + i * (trackHeight / 2);
            ctx.beginPath();
            ctx.arc(halfSize * 0.77, y, rollerRadius, 0, Math.PI * 2);
            ctx.fill();
        }

        // БАШНЯ: маленькая, обтекаемая
        ctx.fillStyle = '#E67E22';
        const turretRadius = this.size / 4;
        ctx.beginPath();
        ctx.arc(0, 0, turretRadius, 0, Math.PI * 2);
        ctx.fill();

        // МАЯЧОК БОНУСА (если есть)
        if (this.hasBonus) {
            this.drawBonusBeacon(ctx);
        }

        // ДУЛО: тонкое, длинное
        const barrelWidth = this.size * 0.1;
        const barrelLength = this.size * 0.7;
        ctx.fillStyle = '#2C3E50';
        ctx.fillRect(-barrelWidth/2, -barrelLength - 2, barrelWidth, barrelLength);

        // ИКОНКА: молния
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 14px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('⚡', 0, 0);
    }

    // === 3. ТЯЖЁЛЫЙ ВРАГ (бронированный) ===
    drawHeavyEnemy(ctx) {
        const halfSize = this.size / 2;

        // КОРПУС: массивный, с дополнительной бронёй
        ctx.fillStyle = this.color || '#7F8C8D'; // Серый

        // Основной корпус
        ctx.fillRect(-halfSize * 0.9, -halfSize * 0.7, this.size * 0.9, this.size * 0.7);

        // ДОПОЛНИТЕЛЬНАЯ БРОНЯ (накладки)
        ctx.fillStyle = '#95A5A6';
        // Верхняя бронеплита
        ctx.fillRect(-halfSize * 0.7, -halfSize * 0.8, this.size * 0.7, this.size * 0.1);
        // Боковые экраны
        ctx.fillRect(-halfSize * 0.95, -halfSize * 0.4, this.size * 0.1, this.size * 0.5);
        ctx.fillRect(halfSize * 0.85, -halfSize * 0.4, this.size * 0.1, this.size * 0.5);

        // ГУСЕНИЦЫ: очень широкие
        ctx.fillStyle = '#2C3E50';
        const trackWidth = this.size * 0.25;
        const trackHeight = this.size * 0.8;
        const trackY = -trackHeight/2;

        // Левая гусеница
        ctx.fillRect(-halfSize * 1.05, trackY, trackWidth, trackHeight);

        // Правая гусеница
        ctx.fillRect(halfSize * 0.8, trackY, trackWidth, trackHeight);

        // МНОГО КАТКОВ (6 с каждой стороны)
        ctx.fillStyle = '#5D6D7E';
        const rollerRadius = this.size * 0.045;

        for (let i = 0; i < 6; i++) {
            const y = trackY + i * (trackHeight / 5);
            // Левые
            ctx.beginPath();
            ctx.arc(-halfSize * 0.92, y, rollerRadius, 0, Math.PI * 2);
            ctx.fill();
            // Правые
            ctx.beginPath();
            ctx.arc(halfSize * 0.92, y, rollerRadius, 0, Math.PI * 2);
            ctx.fill();
        }

        // БАШНЯ: крупная, шестигранная
        ctx.fillStyle = '#95A5A6';
        const turretSize = this.size / 3;
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
            const angle = (i / 6) * Math.PI * 2;
            const x = Math.cos(angle) * turretSize;
            const y = Math.sin(angle) * turretSize;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.fill();

        // МАЯЧОК БОНУСА (если есть)
        if (this.hasBonus) {
            this.drawBonusBeacon(ctx);
        }

        // ДУЛО: очень толстое
        const barrelWidth = this.size * 0.25;
        const barrelLength = this.size * 0.7;
        ctx.fillStyle = '#2C3E50';
        ctx.fillRect(-barrelWidth/2, -barrelLength - 2, barrelWidth, barrelLength);

        // ИКОНКА: щит
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 14px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('🛡️', 0, 0);
    }

    // === 4. СНАЙПЕР (дальнобойный) ===
    drawSniperEnemy(ctx) {
        const halfSize = this.size / 2;

        // КОРПУС: низкий, для маскировки
        ctx.fillStyle = this.color || '#27AE60'; // Зелёный

        // Приплюснутый корпус
        ctx.fillRect(-halfSize * 0.7, -halfSize * 0.4, this.size * 0.7, this.size * 0.4);

        // КАМУФЛЯЖ (пятна)
        ctx.fillStyle = '#2ECC71';
        // Несколько пятен камуфляжа
        ctx.fillRect(-halfSize * 0.5, -halfSize * 0.3, this.size * 0.2, this.size * 0.15);
        ctx.fillRect(halfSize * 0.3, -halfSize * 0.2, this.size * 0.15, this.size * 0.1);
        ctx.fillRect(-halfSize * 0.2, halfSize * 0.1, this.size * 0.25, this.size * 0.08);

        // ГУСЕНИЦЫ: узкие, для малозаметности
        ctx.fillStyle = '#34495E';
        const trackWidth = this.size * 0.12;
        const trackHeight = this.size * 0.5;
        const trackY = -trackHeight/2;

        // Левая гусеница
        ctx.fillRect(-halfSize * 0.82, trackY, trackWidth, trackHeight);

        // Правая гусеница
        ctx.fillRect(halfSize * 0.7, trackY, trackWidth, trackHeight);

        // БАШНЯ: с прицелом
        ctx.fillStyle = '#27AE60';
        const turretRadius = this.size / 4;
        ctx.beginPath();
        ctx.arc(0, 0, turretRadius, 0, Math.PI * 2);
        ctx.fill();

        // МАЯЧОК БОНУСА (если есть)
        if (this.hasBonus) {
            this.drawBonusBeacon(ctx);
        }

        // ПРИЦЕЛ (телескопический)
        ctx.fillStyle = '#1ABC9C';
        ctx.beginPath();
        ctx.arc(0, 0, turretRadius * 0.6, 0, Math.PI * 2);
        ctx.fill();

        // КРЕСТ ПРИЦЕЛА
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(-turretRadius * 0.3, 0);
        ctx.lineTo(turretRadius * 0.3, 0);
        ctx.moveTo(0, -turretRadius * 0.3);
        ctx.lineTo(0, turretRadius * 0.3);
        ctx.stroke();

        // ДУЛО: очень длинное (снайперское)
        const barrelWidth = this.size * 0.08;
        const barrelLength = this.size * 1.0; // Очень длинное!
        ctx.fillStyle = '#2C3E50';
        ctx.fillRect(-barrelWidth/2, -barrelLength - 2, barrelWidth, barrelLength);

        // ГЛУШИТЕЛЬ на конце ствола
        ctx.fillStyle = '#7F8C8D';
        ctx.fillRect(-barrelWidth, -barrelLength - 5, barrelWidth * 2, barrelLength * 0.15);
    }

    drawBonusBeacon(ctx) {
        const currentTime = Date.now();
        const cycleDuration = 1000; // 1 секунда

        // Синусоидальная волна для плавной вспышки
        // sin(0) = 0 → sin(π/2) = 1 → sin(π) = 0 → sin(3π/2) = -1 → sin(2π) = 0
        const wavePosition = (currentTime % cycleDuration) / cycleDuration * Math.PI * 2;

        // Используем только положительную часть синуса (0-1)
        let intensity = Math.sin(wavePosition);
        if (intensity < 0) intensity = 0; // Отрицательные значения = нет свечения

        // Добавляем смягчение - возводим в квадрат для более плавного нарастания
        intensity = Math.pow(intensity, 1.5);

        // Слишком слабые вспышки не показываем
        if (intensity < 0.1) return;

        ctx.save();

        // 1. ОЧЕНЬ МЯГКОЕ ВНЕШНЕЕ СВЕЧЕНИЕ
        const outerRadius = this.size * (0.4 + intensity * 0.3);

        ctx.fillStyle = `rgba(255, 230, 100, ${0.2 * intensity})`;
        ctx.beginPath();
        ctx.arc(0, 0, outerRadius, 0, Math.PI * 2);
        ctx.fill();

        // 2. ОСНОВНОЙ СВЕТЯЩИЙСЯ ШАР
        const coreSize = this.size * 0.07 * (1 + intensity * 0.5);

        // Градиент от ярко-жёлтого к оранжевому
        const gradient = ctx.createRadialGradient(
            0, 0, 0,
            0, 0, coreSize
        );
        gradient.addColorStop(0, `rgba(255, 255, 200, ${0.9 * intensity})`);
        gradient.addColorStop(0.7, `rgba(255, 220, 100, ${0.7 * intensity})`);
        gradient.addColorStop(1, `rgba(255, 180, 50, ${0.4 * intensity})`);

        ctx.fillStyle = gradient;
        ctx.shadowColor = 'rgba(255, 220, 100, 0.8)';
        ctx.shadowBlur = 20 * intensity;

        ctx.beginPath();
        ctx.arc(0, 0, coreSize, 0, Math.PI * 2);
        ctx.fill();

        // 3. ЯРКИЙ ЦЕНТР (с лёгкой пульсацией)
        const pulse = Math.sin(currentTime * 0.015) * 0.2 + 0.8;
        ctx.fillStyle = `rgba(255, 255, 255, ${0.8 * intensity * pulse})`;
        ctx.shadowBlur = 10 * intensity;

        ctx.beginPath();
        ctx.arc(0, 0, coreSize * 0.5, 0, Math.PI * 2);
        ctx.fill();

        // 4. ОЧЕНЬ ЛЁГКАЯ ПОДСВЕТКА ТАНКА
        if (intensity > 0.3) {
            ctx.globalCompositeOperation = 'soft-light';
            ctx.fillStyle = `rgba(255, 220, 100, ${0.1 * intensity})`;
            ctx.beginPath();
            ctx.arc(0, 0, this.size * 0.7, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalCompositeOperation = 'source-over';
        }

        ctx.shadowBlur = 0;
        ctx.restore();
    }

    // === 5. ТАНК ЗРИТЕЛЯ (особый дизайн) ===
    drawViewerTank(ctx) {
        const halfSize = this.size / 2;

        // КОРПУС: стильный, с градиентом
        const gradient = ctx.createLinearGradient(-halfSize, -halfSize, halfSize, halfSize);
        gradient.addColorStop(0, '#9B59B6');
        gradient.addColorStop(1, '#3498DB');

        ctx.fillStyle = gradient;
        ctx.fillRect(-halfSize * 0.8, -halfSize * 0.6, this.size * 0.8, this.size * 0.6);

        // НЕОНОВЫЕ ЭФФЕКТЫ
        ctx.strokeStyle = '#00FFFF';
        ctx.lineWidth = 2;
        ctx.strokeRect(-halfSize * 0.8, -halfSize * 0.6, this.size * 0.8, this.size * 0.6);

        // ГУСЕНИЦЫ: светящиеся
        ctx.fillStyle = '#2C3E50';
        const trackWidth = this.size * 0.2;
        const trackHeight = this.size * 0.7;
        const trackY = -trackHeight/2;

        // Левая гусеница
        ctx.fillRect(-halfSize * 0.9, trackY, trackWidth, trackHeight);

        // Правая гусеница
        ctx.fillRect(halfSize * 0.7, trackY, trackWidth, trackHeight);

        // СВЕТЯЩИЕСЯ ТОЧКИ на гусеницах
        ctx.fillStyle = '#00FFFF';
        for (let i = 0; i < 4; i++) {
            const y = trackY + i * (trackHeight / 3);
            // Левая сторона
            ctx.beginPath();
            ctx.arc(-halfSize * 0.8, y, 3, 0, Math.PI * 2);
            ctx.fill();
            // Правая сторона
            ctx.beginPath();
            ctx.arc(halfSize * 0.8, y, 3, 0, Math.PI * 2);
            ctx.fill();
        }

        // БАШНЯ: с экраном/камерой
        ctx.fillStyle = '#2980B9';
        const turretRadius = this.size / 3.5;
        ctx.beginPath();
        ctx.arc(0, 0, turretRadius, 0, Math.PI * 2);
        ctx.fill();

        // "ЭКРАН" камеры
        ctx.fillStyle = '#1A1A1A';
        ctx.beginPath();
        ctx.arc(0, 0, turretRadius * 0.7, 0, Math.PI * 2);
        ctx.fill();

        // ИКОНКА КАМЕРЫ в центре
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 16px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('📷', 0, 0);

        // ДУЛО: стильное
        const barrelWidth = this.size * 0.12;
        const barrelLength = this.size * 0.7;
        ctx.fillStyle = '#9B59B6';
        ctx.fillRect(-barrelWidth/2, -barrelLength - 2, barrelWidth, barrelLength);

        // СВЕТОДИОДЫ на дуле
        ctx.fillStyle = '#00FF00';
        ctx.fillRect(-barrelWidth/2, -barrelLength * 0.3, barrelWidth, 2);
        ctx.fillStyle = '#FF0000';
        ctx.fillRect(-barrelWidth/2, -barrelLength * 0.6, barrelWidth, 2);
    }

    // Метод отрисовки башни
    drawTurret(ctx) {
        const turretRadius = this.size / 3;

        // Определяем цвета в зависимости от типа
        let mainColor, detailColor;

        if (this.type === 'player') {
            mainColor = '#2C3E50'; // Темно-синий
            detailColor = '#34495E';
        } else {
            // Разные цвета для разных типов врагов
            switch(this.enemyType) {
                case 'BASIC':
                    mainColor = '#7D3C3C'; // Темно-красный
                    detailColor = '#943434';
                    break;
                case 'FAST':
                    mainColor = '#8E44AD'; // Фиолетовый
                    detailColor = '#9B59B6';
                    break;
                case 'HEAVY':
                    mainColor = '#34495E'; // Темно-серый
                    detailColor = '#2C3E50';
                    break;
                case 'SNIPER':
                    mainColor = '#16A085'; // Бирюзовый
                    detailColor = '#1ABC9C';
                    break;
                default:
                    mainColor = '#7D3C3C';
                    detailColor = '#943434';
            }
        }

        // 1. ОСНОВА БАШНИ (броня)
        ctx.fillStyle = mainColor;
        ctx.beginPath();
        ctx.arc(0, 0, turretRadius, 0, Math.PI * 2);
        ctx.fill();

        // 2. ТЕКСТУРА БРОНИ (рисуем заклепки)
        ctx.fillStyle = detailColor;
        for (let i = 0; i < 8; i++) {
            const angle = (i / 8) * Math.PI * 2;
            const x = Math.cos(angle) * turretRadius * 0.6;
            const y = Math.sin(angle) * turretRadius * 0.6;

            ctx.beginPath();
            ctx.arc(x, y, turretRadius * 0.08, 0, Math.PI * 2);
            ctx.fill();
        }

        // 3. Смотровой люк
        ctx.fillStyle = '#1A1A1A';
        ctx.beginPath();
        ctx.arc(0, 0, turretRadius * 0.4, 0, Math.PI * 2);
        ctx.fill();

        // 4. Щель прицела
        ctx.fillStyle = '#7F8C8D';
        ctx.fillRect(-turretRadius * 0.2, -turretRadius * 0.05, turretRadius * 0.4, turretRadius * 0.1);

        // 5. ОБВОДКА
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(0, 0, turretRadius, 0, Math.PI * 2);
        ctx.stroke();
    }

    // Вспомогательный метод для затемнения цвета
    getDarkColor(baseColor, alpha = 0.7) {
        // Простое преобразование цвета с прозрачностью
        // Для простоты используем rgba
        if (baseColor.startsWith('#')) {
            // Конвертируем hex в rgb
            const r = parseInt(baseColor.slice(1, 3), 16);
            const g = parseInt(baseColor.slice(3, 5), 16);
            const b = parseInt(baseColor.slice(5, 7), 16);
            return `rgba(${r}, ${g}, ${b}, ${alpha})`;
        }
        return `rgba(0, 0, 0, ${alpha})`;
    }

    drawTracks(ctx) {
        if ((this.type !== 'player' && this.type !== 'enemy') || this.tracks.length === 0) return;

        ctx.save();

        this.tracks.forEach(track => {
            if (track.alpha < 0.1) return;

            ctx.save();
            ctx.translate(track.x, track.y);

            let angle = 0;
            if (track.direction === DIRECTIONS.RIGHT) angle = Math.PI / 2;
            else if (track.direction === DIRECTIONS.DOWN) angle = Math.PI;
            else if (track.direction === DIRECTIONS.LEFT) angle = -Math.PI / 2;
            ctx.rotate(angle);

            const baseAlpha = track.isPlayer ? 0.5 : 0.6;
            ctx.globalAlpha = track.alpha * baseAlpha;
            ctx.fillStyle = track.isPlayer ? '#4488FF' : '#666666';

            const trackWidth = this.size * 0.5;
            const trackHeight = this.size * 0.06;
            const spacing = this.size * 0.25;

            ctx.fillRect(-trackWidth/2, -spacing/2, trackWidth, trackHeight);
            ctx.fillRect(-trackWidth/2, spacing/2 - trackHeight, trackWidth, trackHeight);

            ctx.restore();
        });

        ctx.restore();
    }

    drawPathMemory(ctx) {
        if (this.type !== 'enemy' || this.aiLevel !== ENEMY_AI_LEVELS.BASIC) return;

        ctx.save();

        this.pathMemory.forEach((memory, key) => {
            const [gridX, gridY] = key.split(',').map(Number);
            const timeSinceVisit = this.memoryTimer - memory.timestamp;

            if (timeSinceVisit < TRACK_SYSTEM.MEMORY_DECAY_TIME) {
                const alpha = 0.3 * (1 - timeSinceVisit / TRACK_SYSTEM.MEMORY_DECAY_TIME);
                const intensity = Math.min(memory.visits / 5, 1);

                ctx.globalAlpha = alpha;
                ctx.fillStyle = `rgba(255, ${255 - intensity * 200}, 0, ${alpha})`;
                ctx.fillRect(
                    gridX * TRACK_SYSTEM.MEMORY_GRID_SIZE - TRACK_SYSTEM.MEMORY_GRID_SIZE/2,
                    gridY * TRACK_SYSTEM.MEMORY_GRID_SIZE - TRACK_SYSTEM.MEMORY_GRID_SIZE/2,
                    TRACK_SYSTEM.MEMORY_GRID_SIZE,
                    TRACK_SYSTEM.MEMORY_GRID_SIZE
                );
            }
        });

        ctx.restore();
    }

    drawLevelIndicator(ctx) {
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 9px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(this.playerLevel.toString(), 0, 0);
    }

    drawAutoAimDevice(ctx) {
        ctx.save();

        const blockWidth = this.size * 0.3;
        const blockHeight = this.size * 0.3;
        const blockX = -this.size/2 - blockHeight + 10;
        const blockY = -blockWidth/2 - 6;

        ctx.rotate(-Math.PI / 2);

        ctx.fillStyle = '#2C3E50';
        ctx.fillRect(blockX, blockY, blockHeight, blockWidth);

        ctx.strokeStyle = '#34495E';
        ctx.lineWidth = 1;
        ctx.strokeRect(blockX, blockY, blockHeight, blockWidth);

        const time = Date.now() * 0.001;
        const ledSize = blockWidth * 0.15;

        // LEDs
        const leds = [
            { color: [0, 150, 255], speed: 8 },
            { color: [0, 255, 100], speed: 5 },
            { color: [255, 50, 50], speed: 3 }
        ];

        leds.forEach((led, index) => {
            const alpha = 0.3 + Math.sin(time * led.speed + index) * 0.3;
            ctx.fillStyle = `rgba(${led.color[0]}, ${led.color[1]}, ${led.color[2]}, ${alpha})`;
            ctx.fillRect(blockX + blockHeight * 0.3, blockY + blockWidth * (0.2 + index * 0.3), ledSize, ledSize);
        });

        ctx.restore();
    }

    drawBeacon(ctx) {
        ctx.save();
        ctx.translate(this.position.x, this.position.y);
        ctx.rotate(this.beaconRotation);

        const flashVisible = Math.floor(this.beaconFlashTimer / 8) % 2 === 0;

        if (flashVisible) {
            ctx.fillStyle = '#FF0000';
            ctx.beginPath();
            ctx.arc(0, 0, 8, 0, Math.PI * 2);
            ctx.fill();

            ctx.shadowColor = '#FF0000';
            ctx.shadowBlur = 15;
            ctx.fill();
            ctx.shadowBlur = 0;

            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(-6, -1, 12, 2);
            ctx.fillRect(-1, -6, 2, 12);
        }

        ctx.restore();
    }

    drawBonusIcon(ctx) {
        const iconAlpha = 0.3 + (this.blinkAlpha * 0.7);
        const textWidth = ctx.measureText(this.bonusType.symbol).width + 8;

        ctx.fillStyle = `rgba(0, 0, 0, ${0.7 * iconAlpha})`;
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

    drawEnemyIcon(ctx, blockX, blockY, blockHeight) {
        const iconSize = blockHeight - 4;
        const iconX = blockX - iconSize - 8;
        const iconY = blockY + (blockHeight - iconSize) / 2; // Центрируем по высоте блока

        ctx.save();

        // Обводка цветом танка
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(iconX + iconSize/2, iconY + iconSize/2, iconSize/2 + 2, 0, Math.PI * 2);
        ctx.fill();

        // Белый фон
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.arc(iconX + iconSize/2, iconY + iconSize/2, iconSize/2, 0, Math.PI * 2);
        ctx.fill();

        // Отрисовка иконки или аватарки
        if (this.shouldDrawAvatar()) {
            this.drawAvatarImage(ctx, iconX, iconY, iconSize);
        } else {
            this.drawIcon(ctx, iconX, iconY, iconSize);
        }

        ctx.restore();

        // Линия от иконки к блоку
        ctx.strokeStyle = this.color + 'AA';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(iconX + iconSize, iconY + iconSize/2);
        ctx.lineTo(blockX, blockY + blockHeight/2);
        ctx.stroke();
    }

    shouldDrawAvatar() {
        return (this.enemyType === 'VIEWER' || this.isViewerTank) &&
        this.avatarImage &&
        this.avatarLoaded &&
        !this.avatarError;
    }

    drawAvatarImage(ctx, x, y, size) {
        if (!this.avatarImage || !this.avatarLoaded) {
            // Показываем индикатор загрузки (тоже центрированный)
            this.drawLoadingIndicator(ctx, x, y, size);
            return;
        }

        try {
            ctx.save();

            // Создаем круглую маску
            ctx.beginPath();
            ctx.arc(x + size/2, y + size/2, size/2, 0, Math.PI * 2);
            ctx.clip();

            // Плавное появление
            if (!this.avatarShowProgress) this.avatarShowProgress = 0;
            this.avatarShowProgress = Math.min(this.avatarShowProgress + 0.1, 1);
            ctx.globalAlpha = this.avatarShowProgress;

            const img = this.avatarImage;
            const aspectRatio = img.width / img.height;

            let drawWidth, drawHeight, offsetX, offsetY;

            if (aspectRatio > 1) {
                // Широкая картинка - подгоняем по ширине
                drawWidth = size;
                drawHeight = size / aspectRatio;
                offsetX = 0;
                offsetY = (size - drawHeight) / 2; // Центрируем по вертикали
            } else {
                // Высокая картинка - подгоняем по высоте
                drawWidth = size * aspectRatio;
                drawHeight = size;
                offsetX = (size - drawWidth) / 2; // Центрируем по горизонтали
                offsetY = 0;
            }

            // Отрисовываем аватарку по центру круга
            ctx.drawImage(img, x + offsetX, y + offsetY, drawWidth, drawHeight);
            ctx.restore();

        } catch (e) {
            console.log('Ошибка отрисовки аватарки:', e);
            this.drawLoadingIndicator(ctx, x, y, size);
        }
    }

    // Новый метод для индикатора загрузки
    drawLoadingIndicator(ctx, x, y, size) {
        ctx.save();

        const centerX = x + size/2;
        const centerY = y + size/2;

        // Анимированное кольцо загрузки
        const time = Date.now() * 0.01;
        const progress = (time % 100) / 100;

        ctx.translate(centerX, centerY);
        ctx.rotate(progress * Math.PI * 2);

        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, size/4, 0, Math.PI * 1.5); // Уменьшили радиус для центрирования
        ctx.stroke();

        ctx.restore();

        // Текст "Загрузка..." по центру
        if (!this.avatarError) {
            ctx.fillStyle = '#FFFFFF';
            ctx.font = 'bold 8px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('...', centerX, centerY);
        }
    }

    drawEnemyInfo(ctx) {
        if (this.type !== 'enemy' || this.isDestroyed || !this.username) return;

        ctx.save();

        // 🔥 ВАЖНОЕ ИСПРАВЛЕНИЕ: Используем абсолютные координаты, не трансформируем
        this.drawUnifiedEnemyInfoAtPosition(ctx, this.position.x, this.position.y);

        ctx.restore();
    }

    drawUnifiedEnemyInfoAtPosition(ctx, tankX, tankY) {
        if (!this.username) return; // 🔥 ДОБАВИЛИ ПРОВЕРКУ

        const username = this.username.toUpperCase();

        // 🔥 ОБЪЯВЛЯЕМ ИКОНКИ БОНУСОВ
        const BONUS_ICONS = {
            'EXTRA_LIFE': '❤️',
            'SPEED_BOOST': '⚡',
            'RAPID_FIRE': '🔥',
            'POWER_SHOT': '💥',
            'SHIELD': '🛡️',
            'AUTO_AIM': '🎯'
        };

        let bonusText = '';
        let bonusWidth = 0;
        let bonusIcon = '⭐';

        // 🔥 ИСПРАВЛЕНИЕ: Проверяем ТОЛЬКО если танк не огарок
        if (!this.isWreck && !this.isDestroyed) {
            if (this.isViewerTank && this.hasViewerBonus) {
                bonusIcon = BONUS_ICONS[this.viewerBonusType] || '⭐';
                bonusText = `[${bonusIcon}]`;
            }
        }

        // 🔥 ПОДСЧИТАЕМ РЕАЛЬНЫЕ ШИРИНЫ
        ctx.save();

        // Ширина бонуса (если есть)
        if (bonusText) {
            ctx.font = '11px "Segoe UI Emoji", "Apple Color Emoji", sans-serif';
            bonusWidth = ctx.measureText(bonusText).width + 2;
        }

        // Ширина имени
        ctx.font = 'bold 12px Arial';
        const nameWidth = ctx.measureText(username).width;

        // Ширина сердечек
        const heartChar = '♥';
        ctx.font = 'bold 12px Arial';
        const heartWidth = ctx.measureText(heartChar).width;
        const heartsWidth = this.health * heartWidth;

        // Общая ширина содержимого
        let totalWidth = bonusWidth + nameWidth + heartsWidth + 8;
        const textHeight = 14;

        // 🔥 ПРОВЕРИМ СООБЩЕНИЕ
        let blockHeight = textHeight + 16;
        let messageText = '';
        let messageWidth = 0;

        if (this.currentMessage && this.messageAlpha > 0.05) {
            messageText = this.currentMessage.message;

            if (this.getTextLengthWithEmojis(messageText) > 35) {
                messageText = this.truncateTextWithEmojis(messageText, 35);
            }

            messageWidth = this.measureTextWithEmojis(ctx, messageText);
            blockHeight += 20;
        }

        ctx.restore();

        // 🔥 РАССЧИТАЕМ РАЗМЕРЫ БЛОКА
        const padding = 8;
        const blockWidth = Math.max(totalWidth, messageWidth) + padding * 2;

        // 🔥 НАЙДЕМ ПОЗИЦИЮ БЛОКА
        const {blockX, blockY, preferredSide} = this.findBestInfoPosition(
            tankX, tankY, blockWidth, blockHeight
        );

        // 🔥 ОТРИСУЕМ БЛОК
        this.drawEnemyIconAtPosition(ctx, blockX, blockY, blockWidth, blockHeight, preferredSide);

        // 🔥 ФОН БЛОКА (УСИЛЕННЫЙ ДЛЯ ЛУЧШЕЙ ВИДИМОСТИ)
        ctx.fillStyle = 'rgba(0, 0, 0, 0.95)';
        ctx.fillRect(blockX, blockY, blockWidth, blockHeight);

        // 🔥 ОБВОДКА
        ctx.strokeStyle = this.color + 'FF'; // Полная непрозрачность
        ctx.lineWidth = 2;
        ctx.strokeRect(blockX, blockY, blockWidth, blockHeight);

        // 🔥 ВНУТРЕННЯЯ БЕЛАЯ ОБВОДКА ДЛЯ КОНТРАСТА
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.lineWidth = 1;
        ctx.strokeRect(blockX + 1, blockY + 1, blockWidth - 2, blockHeight - 2);

        // 🔥 ОТРИСУЕМ СОДЕРЖИМОЕ
        let currentX = blockX + 8;
        const textY = blockY + 14;

        // 1. ИКОНКА БОНУСА (если есть)
        if (bonusText) {
            ctx.font = '11px "Segoe UI Emoji", "Apple Color Emoji", sans-serif';
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';

            // Рисуем скобки серым
            ctx.fillStyle = 'rgba(200, 200, 200, 0.8)';
            ctx.fillText('[', currentX, textY);
            currentX += ctx.measureText('[').width;

            // Иконка
            ctx.fillStyle = '#FFFFFF';
            ctx.fillText(bonusIcon, currentX, textY);
            currentX += ctx.measureText(bonusIcon).width;

            // Правая скобка
            ctx.fillStyle = 'rgba(200, 200, 200, 0.8)';
            ctx.fillText(']', currentX, textY);
            currentX += ctx.measureText(']').width + 2;
        }

        // 2. ИМЯ
        ctx.font = 'bold 12px Arial';
        ctx.fillStyle = '#FFFFFF';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(username, currentX, textY);
        currentX += nameWidth + 4;

        // 3. СЕРДЕЧКИ ЗДОРОВЬЯ
        ctx.font = '12px "Segoe UI Emoji", "Apple Color Emoji", sans-serif';
        ctx.fillStyle = '#FF4444';
        for (let i = 0; i < this.health; i++) {
            ctx.fillText('❤️', currentX, textY);
            currentX += 20; // Фиксированная ширина для эмодзи
        }

        // 🔥 СООБЩЕНИЕ (если есть)
        if (this.currentMessage && this.messageAlpha > 0.05 && messageText) {
            // Разделительная линия
            ctx.strokeStyle = this.color + 'AA';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(blockX + 4, blockY + 24);
            ctx.lineTo(blockX + blockWidth - 4, blockY + 24);
            ctx.stroke();

            // Цвет текста
            let textColor = `rgba(255, 255, 255, ${this.messageAlpha})`;
            if (messageText.toLowerCase().includes('!танк') || messageText.toLowerCase().includes('!tank')) {
                textColor = `rgba(0, 255, 0, ${this.messageAlpha})`;
            } else if (messageText.includes('!') || messageText.includes('!!')) {
                textColor = `rgba(255, 200, 0, ${this.messageAlpha})`;
            } else if (messageText.includes('?')) {
                textColor = `rgba(100, 200, 255, ${this.messageAlpha})`;
            }

            ctx.fillStyle = textColor;

            // Разделяем текст на части для правильной отрисовки
            const messageParts = this.splitTextWithEmojis(messageText);
            let msgX = blockX + 8;
            const msgY = blockY + 34;

            for (const part of messageParts) {
                if (this.isEmoji(part)) {
                    ctx.font = '16px "Segoe UI Emoji", "Apple Color Emoji", sans-serif';
                    ctx.fillText(part, msgX, msgY);
                    msgX += 20;
                } else {
                    ctx.font = 'normal 10px Arial';
                    ctx.fillText(part, msgX, msgY);
                    msgX += ctx.measureText(part).width;
                }
            }

            // Индикатор времени
            if (this.currentMessage) {
                const elapsed = Date.now() - this.currentMessage.timestamp;
                const timeProgress = 1 - Math.min(elapsed / 8000, 1); // 8 секунд

                ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
                ctx.fillRect(blockX + 8, blockY + blockHeight - 6, blockWidth - 16, 3);

                ctx.fillStyle = this.color;
                const barWidth = (blockWidth - 16) * timeProgress;
                ctx.fillRect(blockX + 8, blockY + blockHeight - 6, barWidth, 3);
            }
        }

        // 🔥 ЛИНИЯ К ТАНКУ
        this.drawEnemyConnectionLineToTank(ctx, blockX, blockY, blockWidth, blockHeight, tankX, tankY, preferredSide);
    }



    measureEmojiTextWidth(ctx, text) {
        if (!text) return 0;

        // Простое измерение: каждый эмодзи ~14px
        return text.length * 14;
    }

    // 🔥 НОВЫЙ МЕТОД: Расчет ширины текста с учетом эмодзи
    measureTextWithEmojis(ctx, text) {
        const parts = this.splitTextWithEmojis(text);
        let totalWidth = 0;

        for (const part of parts) {
            if (this.isEmoji(part)) {
                totalWidth += 20; // Фиксированная ширина для эмодзи
            } else {
                ctx.font = 'normal 10px Arial';
                totalWidth += ctx.measureText(part).width;
            }
        }

        return totalWidth;
    }

    // 🔥 НОВЫЙ МЕТОД: Подсчет длины текста с учетом эмодзи
    getTextLengthWithEmojis(text) {
        let length = 0;

        for (let i = 0; i < text.length; i++) {
            const char = text[i];

            // Эмодзи из суррогатной пары считаем как 1 символ
            if (char >= '\uD800' && char <= '\uDFFF') {
                i++; // Пропускаем второй символ пары
            }

            length++;
        }

        return length;
    }


    // 🔥 ПРОВЕРКА ЯВЛЯЕТСЯ ЛИ СИМВОЛ ЭМОДЗИ
    isEmoji(character) {
        // Простая проверка по диапазону кодов эмодзи
        const code = character.codePointAt(0);

        // Основные диапазоны эмодзи в Unicode
        return (
            (code >= 0x1F600 && code <= 0x1F64F) || // Emoticons
            (code >= 0x1F300 && code <= 0x1F5FF) || // Misc Symbols and Pictographs
            (code >= 0x1F680 && code <= 0x1F6FF) || // Transport and Map Symbols
            (code >= 0x2600 && code <= 0x26FF)   || // Misc symbols
            (code >= 0x2700 && code <= 0x27BF)   || // Dingbats
            (code >= 0xFE00 && code <= 0xFE0F)   || // Variation Selectors
            (code >= 0x1F900 && code <= 0x1F9FF) || // Supplemental Symbols and Pictographs
            (code >= 0x1F1E6 && code <= 0x1F1FF)    // Regional indicator symbols
        );
    }

    // 🔥 РАЗДЕЛЕНИЕ ТЕКСТА НА ОБЫЧНЫЕ СИМВОЛЫ И ЭМОДЗИ
    splitTextWithEmojis(text) {
        const parts = [];
        let currentPart = '';

        for (let i = 0; i < text.length; i++) {
            const char = text[i];

            // Пропускаем суррогатные пары (эмодзи из 2 символов)
            if (char >= '\uD800' && char <= '\uDFFF') {
                if (currentPart) {
                    parts.push(currentPart);
                    currentPart = '';
                }

                // Собираем полный эмодзи (может быть 2 символа)
                const emoji = i + 1 < text.length ? char + text[i + 1] : char;
                parts.push(emoji);
                i++; // Пропускаем второй символ суррогатной пары
                continue;
            }

            // Проверяем обычные эмодзи (один символ)
            if (this.isEmoji(char)) {
                if (currentPart) {
                    parts.push(currentPart);
                    currentPart = '';
                }
                parts.push(char);
            } else {
                currentPart += char;
            }
        }

        // Добавляем остаток текста
        if (currentPart) {
            parts.push(currentPart);
        }

        return parts;
    }

    // 🔥 ОБНОВЛЕННЫЙ МЕТОД ОБРЕЗКИ ТЕКСТА С УЧЕТОМ ЭМОДЗИ
    truncateTextWithEmojis(text, maxLength = 35) { // 🔥 УВЕЛИЧИЛИ С 25 ДО 35
        if (this.getTextLengthWithEmojis(text) <= maxLength) return text;

        let result = '';
        let length = 0;
        let i = 0;

        while (i < text.length && length < maxLength - 3) { // -3 для "..."
            const char = text[i];

            // Обрабатываем суррогатные пары (эмодзи из 2 символов)
            if (char >= '\uD800' && char <= '\uDFFF') {
                if (i + 1 < text.length) {
                    result += char + text[i + 1];
                    i += 2;
                } else {
                    result += char;
                    i++;
                }
            } else if (this.isEmoji(char)) {
                result += char;
                i++;
            } else {
                result += char;
                i++;
            }

            length++;
        }

        return result + '...';
    }

    drawChatMessageAtPosition(ctx, tankX, tankY, blockX, blockY, blockHeight, side) {
        if (!this.currentMessage || this.messageAlpha <= 0.01) return;

        ctx.save();

        // Определяем позицию сообщения в зависимости от стороны блока
        let messageX, messageY;
        const messageText = `${this.currentMessage.username}: ${this.currentMessage.message}`;
        ctx.font = 'bold 11px Arial';
        const textWidth = ctx.measureText(messageText).width;
        const textHeight = 12;
        const padding = 5;

        switch(side) {
            case 'top':
                messageX = blockX;
                messageY = blockY - textHeight - padding * 2 - 5;
                break;
            case 'right':
                messageX = blockX + blockHeight + 10;
                messageY = blockY;
                break;
            case 'left':
                messageX = blockX - textWidth - padding * 2 - 10;
                messageY = blockY;
                break;
            case 'bottom':
            default:
                messageX = blockX;
                messageY = blockY + blockHeight + 5;
                break;
        }

        // Фон сообщения
        ctx.fillStyle = `rgba(0, 0, 0, ${0.8 * this.messageAlpha})`;
        this.roundRect(ctx, messageX, messageY,
                       textWidth + padding * 2, textHeight + padding * 2, 4);
        ctx.fill();

        // Обводка цветом танка
        ctx.strokeStyle = this.color + Math.floor(this.messageAlpha * 255).toString(16).padStart(2, '0');
        ctx.lineWidth = 1;
        this.roundRect(ctx, messageX, messageY,
                       textWidth + padding * 2, textHeight + padding * 2, 4);
        ctx.stroke();

        // Текст сообщения (обрезаем если слишком длинный)
        let displayText = messageText;
        const maxWidth = 150;
        if (textWidth > maxWidth) {
            displayText = messageText.substring(0, 20) + '...';
        }

        ctx.fillStyle = `rgba(255, 255, 255, ${this.messageAlpha})`;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(displayText, messageX + padding, messageY + (textHeight + padding * 2) / 2);

        // Индикатор времени (полоска внизу)
        if (this.currentMessage) {
            const elapsed = Date.now() - this.messageStartTime;
            const timeProgress = 1 - (elapsed / this.currentMessage.displayTime);

            ctx.fillStyle = this.color;
            const barWidth = (textWidth + padding * 2) * Math.max(0, timeProgress);
            ctx.fillRect(messageX, messageY + textHeight + padding * 2 - 2, barWidth, 2);
        }

        // Соединительная линия к информационному блоку
        ctx.strokeStyle = this.color + '55';
        ctx.lineWidth = 1;
        ctx.beginPath();

        switch(side) {
            case 'top':
                ctx.moveTo(messageX + (textWidth + padding * 2) / 2, messageY + textHeight + padding * 2);
                ctx.lineTo(blockX + blockHeight / 2, blockY);
                break;
            case 'bottom':
                ctx.moveTo(messageX + (textWidth + padding * 2) / 2, messageY);
                ctx.lineTo(blockX + blockHeight / 2, blockY + blockHeight);
                break;
            case 'left':
                ctx.moveTo(messageX + textWidth + padding * 2, messageY + (textHeight + padding * 2) / 2);
                ctx.lineTo(blockX, blockY + blockHeight / 2);
                break;
            case 'right':
                ctx.moveTo(messageX, messageY + (textHeight + padding * 2) / 2);
                ctx.lineTo(blockX + blockHeight, blockY + blockHeight / 2);
                break;
        }
        ctx.stroke();

        ctx.restore();
    }

    // 🔥 НОВЫЙ МЕТОД: Находим лучшую позицию с учетом предпочтительной стороны
    findBestInfoPosition(tankX, tankY, blockWidth, blockHeight) {
        const positions = [
            {
                side: 'top',
                x: tankX - blockWidth/2,
                y: tankY - this.size - blockHeight - 5,
                priority: 1
            },
            {
                side: 'right',
                x: tankX + this.size/2 + 10,
                y: tankY - blockHeight/2,
                priority: 2
            },
            {
                side: 'left',
                x: tankX - blockWidth - this.size/2 - 10,
                y: tankY - blockHeight/2,
                priority: 3
            },
            {
                side: 'bottom',
                x: tankX - blockWidth/2,
                y: tankY + this.size + 5,
                priority: 4
            }
        ];

        // Сначала ищем полностью безопасную позицию
        for (let pos of positions) {
            if (this.isPositionSafeForInfo(pos.x, pos.y, blockWidth, blockHeight)) {
                return {
                    blockX: pos.x,
                    blockY: pos.y,
                    preferredSide: pos.side
                };
            }
        }

        // Если не нашли безопасную позицию, прижимаем лучшую к краю
        const bestPosition = positions[0];
        const clampedPos = this.clampPositionToScreen(
            bestPosition,
            blockWidth,
            blockHeight
        );

        return {
            blockX: clampedPos.x,
            blockY: clampedPos.y,
            preferredSide: bestPosition.side
        };
    }

    drawEnemyConnectionLineToTank(ctx, blockX, blockY, blockWidth, blockHeight, tankX, tankY, side) {
        // Координаты точки соединения на блоке (в зависимости от стороны)
        let blockConnectionX, blockConnectionY;

        switch(side) {
            case 'top':
                blockConnectionX = blockX + blockWidth/2;
                blockConnectionY = blockY + blockHeight; // Нижняя грань (т.к. блок сверху от танка)
                break;
            case 'right':
                blockConnectionX = blockX; // Левая грань (т.к. блок справа от танка)
                blockConnectionY = blockY + blockHeight/2;
                break;
            case 'left':
                blockConnectionX = blockX + blockWidth; // Правая грань (т.к. блок слева от танка)
                blockConnectionY = blockY + blockHeight/2;
                break;
            case 'bottom':
            default:
                blockConnectionX = blockX + blockWidth/2;
                blockConnectionY = blockY; // Верхняя грань (т.к. блок снизу от танка)
                break;
        }

        // Координаты точки соединения на танке (ближайшая точка)
        let tankConnectionX, tankConnectionY;

        // Вектор от центра танка к точке на блоке
        const dx = blockConnectionX - tankX;
        const dy = blockConnectionY - tankY;

        // Находим точку на границе танка в направлении блока
        const angle = Math.atan2(dy, dx);
        tankConnectionX = tankX + Math.cos(angle) * this.size/2;
        tankConnectionY = tankY + Math.sin(angle) * this.size/2;

        // Линия от блока к танку
        ctx.strokeStyle = this.color + 'AA';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(blockConnectionX, blockConnectionY);

        // Прямая линия (выглядит лучше для коротких расстояний)
        ctx.lineTo(tankConnectionX, tankConnectionY);
        ctx.stroke();

        // Маленькие кружки в точках соединения
        ctx.fillStyle = this.color;

        // На блоке
        ctx.beginPath();
        ctx.arc(blockConnectionX, blockConnectionY, 3, 0, Math.PI * 2);
        ctx.fill();

        // На танке
        ctx.beginPath();
        ctx.arc(tankConnectionX, tankConnectionY, 3, 0, Math.PI * 2);
        ctx.fill();
    }

    drawEnemyInfoBlockAtPosition(ctx, blockX, blockY, blockWidth, blockHeight, infoText) {
        // Фон блока
        const gradient = ctx.createLinearGradient(blockX, blockY, blockX + blockWidth, blockY + blockHeight);
        gradient.addColorStop(0, 'rgba(0, 0, 0, 0.9)');
        gradient.addColorStop(1, 'rgba(50, 50, 50, 0.9)');

        ctx.fillStyle = gradient;
        ctx.fillRect(blockX, blockY, blockWidth, blockHeight);

        // Обводка блока цветом танка
        ctx.strokeStyle = this.color + 'CC';
        ctx.lineWidth = 2;
        ctx.strokeRect(blockX, blockY, blockWidth, blockHeight);

        // Текст
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 12px Arial';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(infoText, blockX + 8, blockY + blockHeight/2);
    }

    // 🔥 НОВЫЙ МЕТОД: Проверка безопасности позиции
    isPositionSafeForInfo(x, y, width, height) {
        const margin = 5; // Небольшой отступ от края

        return x >= margin &&
        x + width <= CANVAS_WIDTH - margin &&
        y >= margin &&
        y + height <= CANVAS_HEIGHT - margin;
    }

    // 🔥 НОВЫЙ МЕТОД: Прижимание позиции к краю экрана
    clampPositionToScreen(position, width, height) {
        let x = position.x;
        let y = position.y;
        const margin = 5;

        // Горизонтальные границы
        if (x < margin) x = margin;
        if (x + width > CANVAS_WIDTH - margin) x = CANVAS_WIDTH - margin - width;

        // Вертикальные границы
        if (y < margin) y = margin;
        if (y + height > CANVAS_HEIGHT - margin) y = CANVAS_HEIGHT - margin - height;

        return { x, y };
    }

    // 🔥 ОБНОВЛЯЕМ МЕТОД ОТРИСОВКИ ИКОНКИ ДЛЯ УЧЕТА СТОРОНЫ
    drawEnemyIconAtPosition(ctx, blockX, blockY, blockWidth, blockHeight, side) {
        const iconSize = blockHeight - 4;

        // Размещаем иконку в зависимости от стороны блока
        let iconX, iconY;

        switch(side) {
            case 'top':
                iconX = blockX + blockWidth/2 - iconSize/2;
                iconY = blockY - iconSize - 5;
                break;
            case 'right':
                iconX = blockX + blockWidth + 5;
                iconY = blockY + blockHeight/2 - iconSize/2;
                break;
            case 'left':
                iconX = blockX - iconSize - 5;
                iconY = blockY + blockHeight/2 - iconSize/2;
                break;
            case 'bottom':
            default:
                iconX = blockX + blockWidth/2 - iconSize/2;
                iconY = blockY + blockHeight + 5;
                break;
        }

        ctx.save();

        // 🔥 ВАЖНОЕ ИСПРАВЛЕНИЕ: Проверяем состояние аватарки ПОЛНОСТЬЮ
        const hasAvatar = (this.isViewerTank || this.enemyType === 'VIEWER') &&
        this.avatarUrl &&
        this.avatarUrl !== '' &&
        !this.avatarError;

        if (hasAvatar) {
            // 🔥 ПРИОРИТЕТ 1: Попытаться нарисовать аватарку
            if (this.avatarImage && this.avatarLoaded) {
                // Аватарка загружена - рисуем ее
                this.drawAvatarImageAtPosition(ctx, iconX, iconY, iconSize);
            } else if (this.avatarLoading) {
                // Аватарка загружается - рисуем индикатор
                this.drawLoadingIndicatorAtPosition(ctx, iconX, iconY, iconSize);
            } else {
                // Аватарка не загружена и не загружается - попробуем загрузить
                console.log(`🔄 Для ${this.username} аватарка не загружена, запускаем загрузку...`);
                this.loadAvatar();
                // Пока загружается - рисуем индикатор
                this.drawLoadingIndicatorAtPosition(ctx, iconX, iconY, iconSize);
            }
        } else {
            // 🔥 ПРИОРИТЕТ 2: Рисуем стандартную иконку
            this.drawIcon(ctx, iconX, iconY, iconSize);
        }

        ctx.restore();
    }

    drawAvatarImageAtPosition(ctx, x, y, size) {
        if (!this.avatarImage || this.avatarError) {
            this.drawLoadingIndicatorAtPosition(ctx, x, y, size);
            return;
        }

        try {
            ctx.save();

            const centerX = x + size/2;
            const centerY = y + size/2;

            // 🔥 Создаем круглую маску
            ctx.beginPath();
            ctx.arc(centerX, centerY, size/2, 0, Math.PI * 2);
            ctx.clip();

            // 🔥 Плавное появление
            if (this.avatarShowProgress === undefined) this.avatarShowProgress = 0;
            this.avatarShowProgress = Math.min(this.avatarShowProgress + 0.1, 1);
            ctx.globalAlpha = this.avatarShowProgress;

            const img = this.avatarImage;
            const aspectRatio = img.width / img.height;

            let drawWidth, drawHeight, offsetX, offsetY;

            if (aspectRatio > 1) {
                // Широкая картинка
                drawWidth = size;
                drawHeight = size / aspectRatio;
                offsetX = 0;
                offsetY = (size - drawHeight) / 2;
            } else {
                // Высокая картинка
                drawWidth = size * aspectRatio;
                drawHeight = size;
                offsetX = (size - drawWidth) / 2;
                offsetY = 0;
            }

            // Отрисовываем аватарку
            ctx.drawImage(img, x + offsetX, y + offsetY, drawWidth, drawHeight);

            // 🔥 Белая обводка вокруг аватарки
            ctx.globalAlpha = 1.0;
            ctx.strokeStyle = '#FFFFFF';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(centerX, centerY, size/2, 0, Math.PI * 2);
            ctx.stroke();

            ctx.restore();

        } catch (e) {
            console.log('❌ Ошибка отрисовки аватарки:', e);
            this.drawLoadingIndicatorAtPosition(ctx, x, y, size);
        }
    }

    // 🔥 УЛУЧШЕННЫЙ ИНДИКАТОР ЗАГРУЗКИ
    drawLoadingIndicatorAtPosition(ctx, x, y, size) {
        ctx.save();

        const centerX = x + size/2;
        const centerY = y + size/2;

        // Серый фон круга
        ctx.fillStyle = '#CCCCCC';
        ctx.beginPath();
        ctx.arc(centerX, centerY, size/2, 0, Math.PI * 2);
        ctx.fill();

        // Анимированное кольцо загрузки
        const time = Date.now() * 0.01;
        const progress = (time % 100) / 100;

        ctx.translate(centerX, centerY);
        ctx.rotate(progress * Math.PI * 2);

        let color = '#FFFFFF';
        if (this.avatarError) {
            color = '#FF4444';
        } else if (this.avatarLoading) {
            color = '#00BFFF';
        }

        ctx.strokeStyle = color;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(0, 0, size/4, 0, Math.PI * 1.5);
        ctx.stroke();

        ctx.restore();

        // Текст состояния
        ctx.fillStyle = color;
        ctx.font = 'bold 10px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        let statusText = '...';
        if (this.avatarError) {
            statusText = '❌';
        } else if (this.avatarLoading) {
            statusText = '↻';
        }

        ctx.fillText(statusText, centerX, centerY);
    }

    drawIcon(ctx, x, y, size) {
        ctx.save();

        const centerX = x + size/2;
        const centerY = y + size/2;

        // Серый фон круга
        ctx.fillStyle = '#CCCCCC';
        ctx.beginPath();
        ctx.arc(centerX, centerY, size/2, 0, Math.PI * 2);
        ctx.fill();

        // Определяем иконку по типу танка
        let icon = '⚫';

        if (this.isViewerTank || this.enemyType === 'VIEWER') {
            icon = '👤';
        } else {
            switch(this.enemyType) {
                case 'BASIC': icon = '🔴'; break;
                case 'FAST': icon = '🟡'; break;
                case 'HEAVY': icon = '🟣'; break;
                case 'SNIPER': icon = '🟢'; break;
            }
        }

        // Цветная обводка
        ctx.strokeStyle = this.color || '#C0392B';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(centerX, centerY, size/2, 0, Math.PI * 2);
        ctx.stroke();

        // Рисуем иконку
        ctx.font = `bold ${size * 0.5}px "Segoe UI Emoji", "Apple Color Emoji", sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(icon, centerX, centerY);

        ctx.restore();
    }

    clearWreckState() {
        if (this.isWreck) {
            // 🔥 ОЧИЩАЕМ СООБЩЕНИЯ
            this.chatMessages = [];
            this.currentMessage = null;
            this.wreckChatMessage = null;

            // 🔥 СБРАСЫВАЕМ СОСТОЯНИЕ ИНФО-БЛОКА
            this.infoBlockAlpha = this.infoBlockMaxAlpha;
            this.infoBlockChatActivated = false;
            this.infoBlockChatTimer = 0;
            this.infoBlockHovered = false;
        }
    }

    drawEnemyConnectionLine(ctx, blockX, blockY, blockWidth, blockHeight) {
        // Линия от блока к танку
        ctx.strokeStyle = this.color + 'AA';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(blockX + blockWidth, blockY + blockHeight/2);
        ctx.lineTo(-this.size/2, 0);
        ctx.stroke();
    }

    // 🔥 ОБНОВЛЕННЫЙ МЕТОД ЗАГРУЗКИ АВАТАРКИ
    loadAvatar() {
        console.log(`=== ЗАГРУЗКА АВАТАРКИ ДЛЯ ${this.username} ===`);
        console.log(`📁 avatarUrl: ${this.avatarUrl}`);
        console.log(`✅ isViewerTank: ${this.isViewerTank}`);
        console.log(`✅ enemyType: ${this.enemyType}`);
        console.log(`📊 Состояние: loaded=${this.avatarLoaded}, loading=${this.avatarLoading}, error=${this.avatarError}`);

        if (!this.avatarUrl || this.avatarUrl === '' || this.avatarUrl === 'undefined') {
            console.log(`❌ Нет URL аватарки для ${this.username}`);
            this.avatarError = true;
            return;
        }

        // 🔥 ПРОВЕРЯЕМ ФОРМАТ URL
        if (!this.avatarUrl.startsWith('http')) {
            console.log(`❌ Неверный формат URL: ${this.avatarUrl}`);
            this.avatarError = true;
            return;
        }

        if (this.avatarLoading) {
            console.log(`ℹ️ Аватарка уже загружается`);
            return;
        }

        if (this.avatarLoaded && this.avatarImage) {
            console.log(`ℹ️ Аватарка уже загружена`);
            return;
        }

        console.log(`🔄 Начинаем загрузку аватарки: ${this.avatarUrl}`);

        this.avatarLoading = true;
        this.avatarError = false;

        const img = new Image();
        img.crossOrigin = "anonymous";

        img.onload = () => {
            console.log(`✅ Аватарка ЗАГРУЖЕНА для ${this.username}`);
            console.log(`📐 Размеры: ${img.width}x${img.height}`);
            this.avatarImage = img;
            this.avatarLoaded = true;
            this.avatarLoading = false;
            this.avatarError = false;
            this.avatarShowProgress = 0;

            // 🔥 ОБНОВЛЯЕМ КЭШ
            if (game && game.viewerSystem) {
                game.viewerSystem.avatarCache.set(this.userId, {
                    image: img,
                    userId: this.userId,
                    timestamp: Date.now(),
                                                  url: this.avatarUrl
                });
                console.log(`💾 Аватарка сохранена в кэш`);
            }
        };

        img.onerror = (e) => {
            console.error(`❌ ОШИБКА загрузки аватарки для ${this.username}:`, e);
            console.error(`❌ URL: ${this.avatarUrl}`);
            this.avatarLoaded = false;
            this.avatarLoading = false;
            this.avatarError = true;
            this.avatarImage = null;
        };

        try {
            // 🔥 Используем URL с timestamp для предотвращения кэширования
            const timestamp = Date.now();
            const urlWithCacheBuster = this.avatarUrl.includes('?')
            ? `${this.avatarUrl}&t=${timestamp}`
            : `${this.avatarUrl}?t=${timestamp}`;

            console.log(`🔗 Используем URL: ${urlWithCacheBuster}`);
            img.src = urlWithCacheBuster;

        } catch (error) {
            console.error(`❌ КРИТИЧЕСКАЯ ошибка:`, error);
            this.avatarError = true;
        }
    }

    drawInvincibilityEffect(ctx) {
        ctx.save();
        ctx.translate(this.position.x, this.position.y);

        const time = Date.now() * 0.01;
        const pulse = Math.sin(time) * 0.3 + 0.7;

        const gradient = ctx.createRadialGradient(0, 0, this.size * 0.5, 0, 0, this.size * 1.5);
        gradient.addColorStop(0, 'rgba(100, 200, 255, 0.8)');
        gradient.addColorStop(1, 'rgba(100, 200, 255, 0)');

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(0, 0, this.size * 1.5 * pulse, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }

    drawFreezeEffect(ctx) {
        ctx.save();
        ctx.translate(this.position.x, this.position.y);

        const glowIntensity = this.freezeProgress * 0.3;
        const gradient = ctx.createRadialGradient(0, 0, this.size * 0.5, 0, 0, this.size * 1.2);
        gradient.addColorStop(0, `rgba(100, 200, 255, ${glowIntensity})`);
        gradient.addColorStop(1, 'rgba(100, 200, 255, 0)');

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(0, 0, this.size * 1.2, 0, Math.PI * 2);
        ctx.fill();

        this.iceCrystals.forEach(crystal => {
            if (crystal.growth > 0) {
                ctx.save();
                ctx.translate(crystal.x, crystal.y);
                ctx.rotate(crystal.rotation);

                const pulse = Math.sin(crystal.pulse) * 0.2 + 0.8;
                const alpha = crystal.alpha * crystal.growth * pulse;

                ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
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

                ctx.restore();
            }
        });

        ctx.restore();
    }

    drawPatrolEffects(ctx) {
        if (this.type !== 'enemy' || this.aiLevel !== ENEMY_AI_LEVELS.BASIC) return;

        ctx.save();
        ctx.translate(this.position.x, this.position.y);

        switch (this.patrolState) {
            case 'LOOKING_AROUND':
                const pulse = (Math.sin(Date.now() * 0.01) + 1) * 0.5;
                ctx.strokeStyle = `rgba(255, 255, 0, ${0.3 + pulse * 0.2})`;
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.arc(0, 0, this.size * 0.7, 0, Math.PI * 2);
                ctx.stroke();
                break;
            case 'MOVING':
                ctx.strokeStyle = 'rgba(0, 255, 0, 0.2)';
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.arc(0, 0, this.size * 0.5, 0, Math.PI * 2);
                ctx.stroke();
                break;
        }

        ctx.restore();
    }

    getDarkColor(baseColor) {
        return baseColor.replace(')', ', 0.7)').replace('rgb', 'rgba');
    }
}
