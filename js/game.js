// === ОПТИМИЗИРОВАННЫЙ КЛАСС ИГРЫ ===
class Game {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');

        // Инициализация менеджеров
        this.enemyManager = new EnemyManager(this);
        this.bonusManager = new BonusManager(this);
        this.effectManager = new EffectManager(this);

        // Инициализируем дебаг-флаги ДО создания меню
        this.debugShowVision = false;
        this.debugAILog = false;
        this.debugGodMode = false;

        // Инициализируем level ДО создания меню
        this.level = 1;

        // НОВОЕ: Создаем дебаг-меню ДО инициализации игры
        this.createDebugMenu();

        this.initGameState();
        this.setupEventListeners();
        this.gameLoop(0);
    }

    initGameState() {
        this.level = 1;
        this.score = 0;
        this.lives = 3;
        this.gameOver = false;
        this.levelComplete = false;
        this.showGameOverScreen = false;
        this.showLevelCompleteScreen = false;
        this.baseDestroyed = false;

        this.keys = {};
        this.debugInfo = document.getElementById('debugInfo');
        this.lastTime = 0;
        this.deltaTime = 0;
        this.directionPriority = null;

        // Оптимизация: счетчик кадров для редких обновлений
        this.frameCount = 0;
        this.lastAICheck = 0;
        this.lastVisionCheck = 0;

        this.enemiesDestroyed = 0;
        this.totalEnemies = TOTAL_ENEMIES_PER_LEVEL;
        this.enemiesToSpawn = TOTAL_ENEMIES_PER_LEVEL;

        this.bullets = [];
        this.screenShake = 0;

        this.soundManager = new SoundManager();
        this.isPlayerMoving = false;
        this.lastPlayerPosition = new Vector2(0, 0);
        this.leaderboard = this.loadLeaderboard();
        this.showFullLeaderboard = false;
        this.updateLeaderboardUI();

        // Свойства для укрепления базы
        this.baseFortified = false;
        this.baseFortifyTime = 0;
        this.baseFortifyDuration = 0;
        this.originalBaseWalls = [];

        // НОВОЕ: Загружаем прогресс ДО создания игрока
        this.playerProgress = this.loadPlayerProgress();
        this.playerLevel = this.playerProgress.level;
        this.playerExperience = this.playerProgress.experience;
        this.nextLevelExp = EXP_REQUIREMENTS[this.playerLevel + 1] || 999;

        // НОВОЕ: Система проходов между уровнями
        this.currentExit = null; // Текущий открытый проход
        this.nextLevelExit = null; // Проход для следующего уровня
        this.exitAnimationProgress = 0;
        this.waitingForExit = false;
        this.playerEnteredLevel = false;

        // НОВОЕ: Статистика уровня
        this.levelLeader = null;
        this.showLevelCompleteStats = false;
        this.levelCompleteTimer = 0;

        // Добавьте свойства для телепортов
        this.exitTeleport = null;
        this.entryTeleport = null;
        this.playerEnteredLevel = true; // Для первого уровня сразу true

        // НОВОЕ: Система статистики игрока
        this.playerStats = this.loadPlayerStats();

        this.initLevel();
    }

    // НОВЫЙ МЕТОД: Оптимизированные редкие обновления
    updateInfrequentSystems() {
        const now = Date.now();

        // Проверка зрения врагов реже (каждые 500мс)
        if (now - this.lastVisionCheck > 500) {
            this.lastVisionCheck = now;
            this.updateEnemyVisionChecks();
        }

        // Обновление ИИ реже (каждые 300мс)
        if (now - this.lastAICheck > 300) {
            this.lastAICheck = now;
            this.updateEnemyAI();
        }

        // Дебаг информация реже (каждые 1000мс)
        if (this.frameCount % 60 === 0) {
            this.updateDebugPerformance();
        }
    }

    // Оптимизированная проверка зрения врагов
    updateEnemyVisionChecks() {
        if (!this.player || this.player.isDestroyed) return;

        // Ограничиваем количество проверок за кадр
        const enemies = this.enemyManager.enemies;
        const maxChecksPerFrame = Math.min(enemies.length, 3);

        for (let i = 0; i < maxChecksPerFrame; i++) {
            const enemy = enemies[i];
            if (enemy && !enemy.isDestroyed && enemy.ai) {
                // Упрощенная проверка расстояния перед полной проверкой LOS
                const distance = Math.sqrt(
                    Math.pow(enemy.position.x - this.player.position.x, 2) +
                    Math.pow(enemy.position.y - this.player.position.y, 2)
                );

                const visionRange = VISION_RANGES[enemy.enemyType] || 200;
                if (distance <= visionRange) {
                    // Только если близко - делаем полную проверку LOS
                    enemy.canSeePlayer(this.player, this.map);
                }
            }
        }
    }

    // Оптимизированное обновление ИИ
    updateEnemyAI() {
        const enemies = this.enemyManager.enemies;
        if (enemies.length === 0) return;

        // Ограничиваем количество полных обновлений ИИ за кадр
        const maxAIUpdates = Math.min(enemies.length, 2);
        const allTanks = [this.player, ...enemies];
        const allFragments = this.getAllFragments();

        for (let i = 0; i < maxAIUpdates; i++) {
            const enemy = enemies[i];
            if (enemy && !enemy.isDestroyed && enemy.ai) {
                enemy.updateEnemyAI(this.map, allTanks, allFragments, this.player);
            }
        }
    }

    // Обновление производительности для дебага
    updateDebugPerformance() {
        const fps = this.deltaTime > 0 ? Math.round(1000 / this.deltaTime) : 0;
        const enemies = this.enemyManager.enemies.length;
        const bullets = this.bullets.length;
        const effects = this.effectManager.explosions.length + this.effectManager.bulletExplosions.length;

        //console.log(`🎮 FPS: ${fps} | Враги: ${enemies} | Пули: ${bullets} | Эффекты: ${effects}`);
    }

    // НОВЫЙ МЕТОД: Загрузка статистики игрока
    loadPlayerStats() {
        try {
            const savedStats = localStorage.getItem('tankGame_playerStats');
            if (savedStats) {
                const stats = JSON.parse(savedStats);
                console.log('📊 Статистика игрока загружена:', stats);
                return stats;
            }
        } catch (error) {
            console.error('Ошибка загрузки статистики:', error);
        }

        // Статистика по умолчанию
        return {
            level: 1,
            enemiesKilled: 0,
            deaths: 0,
            blocksDestroyed: 0,
            playTime: 0, // в секундах
            levelsCompleted: 0,
            startTime: Date.now()
        };
    }

    // НОВЫЙ МЕТОД: Сохранение статистики
    savePlayerStats() {
        try {
            // Обновляем время игры
            if (this.playerStats.startTime) {
                this.playerStats.playTime = Math.floor((Date.now() - this.playerStats.startTime) / 1000);
            }

            localStorage.setItem('tankGame_playerStats', JSON.stringify(this.playerStats));
        } catch (error) {
            console.error('Ошибка сохранения статистики:', error);
        }
    }

    // НОВЫЙ МЕТОД: Сброс статистики
    resetPlayerStats() {
        this.playerStats = {
            level: 1,
            enemiesKilled: 0,
            deaths: 0,
            blocksDestroyed: 0,
            playTime: 0,
            levelsCompleted: 0,
            startTime: Date.now()
        };
        this.savePlayerStats();
        console.log('🔄 Статистика игрока сброшена');
    }

    // НОВЫЕ МЕТОДЫ: Обновление статистики
    recordEnemyKill() {
        this.playerStats.enemiesKilled++;
        this.savePlayerStats();
    }

    recordPlayerDeath() {
        this.playerStats.deaths++;
        this.savePlayerStats();
    }

    recordBlockDestroyed(count = 1) {
        this.playerStats.blocksDestroyed += count;
        this.savePlayerStats();
    }

    recordLevelCompleted() {
        this.playerStats.levelsCompleted++;
        this.savePlayerStats();
    }

    updatePlayerLevel(newLevel) {
        this.playerStats.level = newLevel;
        this.savePlayerStats();
    }

    // ОБНОВЛЯЕМ метод создания телепорта выхода с использованием безопасных зон
    createExitTeleport() {
        // Безопасные зоны у границ (координаты в пикселях)
        const safeZones = [
            // Верхняя граница
            { x: CANVAS_WIDTH / 2, y: 80, width: CANVAS_WIDTH - 160, height: 60 },
            // Нижняя граница
            { x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT - 80, width: CANVAS_WIDTH - 160, height: 60 },
            // Левая граница
            { x: 80, y: CANVAS_HEIGHT / 2, width: 60, height: CANVAS_HEIGHT - 160 },
            // Правая граница
            { x: CANVAS_WIDTH - 80, y: CANVAS_HEIGHT / 2, width: 60, height: CANVAS_HEIGHT - 160 }
        ];

        // Выбираем случайную безопасную зону
        const randomZone = safeZones[Math.floor(Math.random() * safeZones.length)];

        // Генерируем случайные координаты внутри выбранной зоны
        const x = randomZone.x - randomZone.width / 2 + Math.random() * randomZone.width;
        const y = randomZone.y - randomZone.height / 2 + Math.random() * randomZone.height;

        // Проверяем, что позиция свободна от стен
        const tileX = Math.floor(x / TILE_SIZE);
        const tileY = Math.floor(y / TILE_SIZE);
        const isWall = tileX >= 0 && tileX < this.map.width &&
        tileY >= 0 && tileY < this.map.height &&
        (this.map.grid[tileY][tileX] === TILE_TYPES.BRICK ||
        this.map.grid[tileY][tileX] === TILE_TYPES.CONCRETE);

        if (isWall) {
            // Если попали в стену, используем центр зоны
            this.exitTeleport = new Teleport(randomZone.x, randomZone.y, 'exit');
            console.log(`🌀 Создан телепорт выхода в центре безопасной зоны (${Math.round(randomZone.x)}, ${Math.round(randomZone.y)})`);
        } else {
            this.exitTeleport = new Teleport(x, y, 'exit');
            console.log(`🌀 Создан телепорт выхода в безопасной зоне (${Math.round(x)}, ${Math.round(y)})`);
        }

        console.log(`📍 Зона: ${this.getZoneName(randomZone)}`);
    }

    // Вспомогательный метод для получения названия зоны
    getZoneName(zone) {
        if (zone.y === 80) return "ВЕРХ";
        if (zone.y === CANVAS_HEIGHT - 80) return "НИЗ";
        if (zone.x === 80) return "ЛЕВО";
        if (zone.x === CANVAS_WIDTH - 80) return "ПРАВО";
        return "НЕИЗВЕСТНО";
    }

    // ОБНОВЛЯЕМ метод создания телепорта входа
    createEntryTeleport(x, y) {
        // Проверяем, что координаты находятся в безопасной зоне или корректируем их
        const safePosition = this.ensureSafePosition(x, y);

        this.entryTeleport = new Teleport(safePosition.x, safePosition.y, 'entry');
        console.log(`🌀 Создан телепорт входа в (${Math.round(safePosition.x)}, ${Math.round(safePosition.y)})`);

        // Запускаем таймер для схлопывания через 2 секунды
        setTimeout(() => {
            if (this.entryTeleport) {
                this.entryTeleport.startClosing();
                console.log("🌀 Запущено схлопывание телепорта входа");
            }
        }, 2000);
    }

    // НОВЫЙ МЕТОД: Обеспечение безопасной позиции
    ensureSafePosition(x, y) {
        // Проверяем, находится ли позиция в стене
        const tileX = Math.floor(x / TILE_SIZE);
        const tileY = Math.floor(y / TILE_SIZE);
        const isWall = tileX >= 0 && tileX < this.map.width &&
        tileY >= 0 && tileY < this.map.height &&
        (this.map.grid[tileY][tileX] === TILE_TYPES.BRICK ||
        this.map.grid[tileY][tileX] === TILE_TYPES.CONCRETE);

        if (!isWall) {
            return { x: x, y: y }; // Позиция безопасна
        }

        // Если позиция в стене, ищем ближайшую безопасную зону
        console.log("⚠️  Позиция в стене, ищем безопасную альтернативу...");

        const safeZones = [
            { x: CANVAS_WIDTH / 2, y: 80 },      // Верх
            { x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT - 80 }, // Низ
            { x: 80, y: CANVAS_HEIGHT / 2 },     // Лево
            { x: CANVAS_WIDTH - 80, y: CANVAS_HEIGHT / 2 }  // Право
        ];

        // Находим ближайшую безопасную зону
        let closestZone = safeZones[0];
        let minDistance = Infinity;

        safeZones.forEach(zone => {
            const distance = Math.sqrt(Math.pow(zone.x - x, 2) + Math.pow(zone.y - y, 2));
            if (distance < minDistance) {
                minDistance = distance;
                closestZone = zone;
            }
        });

        console.log(`✅ Перемещено в безопасную зону: ${this.getZoneName(closestZone)}`);
        return closestZone;
    }

    // НОВЫЙ МЕТОД: Создание дебаг-меню
    createDebugMenu() {
        // Удаляем существующее меню если есть
        const existingMenu = document.getElementById('debugMenu');
        if (existingMenu) {
            existingMenu.remove();
        }

        // Создаем контейнер для дебаг-меню
        const debugMenu = document.createElement('div');
        debugMenu.id = 'debugMenu';
        debugMenu.style.cssText = `
        position: fixed;
        top: 10px;
        left: 10px;
        background: rgba(0, 0, 0, 0.9);
        color: white;
        padding: 15px;
        border-radius: 10px;
        border: 2px solid #4CAF50;
        font-family: 'Courier New', monospace;
        font-size: 12px;
        z-index: 1000;
        min-width: 250px;
        max-height: 80vh;
        overflow-y: auto;
        `;

        debugMenu.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
        <h3 style="margin: 0; color: #4CAF50;">🎮 Дебаг Меню</h3>
        <button id="debugToggleMenu" style="background: #ff4444; color: white; border: none; border-radius: 3px; padding: 2px 6px; cursor: pointer;">✕</button>
        </div>

        <div style="margin-bottom: 10px;">
        <label style="display: block; margin-bottom: 5px; font-weight: bold;">Уровень игры:</label>
        <select id="debugLevelSelect" style="width: 100%; padding: 5px; background: #333; color: white; border: 1px solid #4CAF50;">
        <option value="1">1 - Базовый ИИ</option>
        <option value="2">2 - Базовый ИИ</option>
        <option value="3">3 - Базовый ИИ</option>
        <option value="4">4 - Базовый ИИ</option>
        <option value="5">5 - Продвинутый ИИ</option>
        <option value="6">6 - Продвинутый ИИ</option>
        <option value="7">7 - Продвинутый ИИ</option>
        <option value="8">8 - Продвинутый ИИ</option>
        <option value="9">9 - Продвинутый ИИ</option>
        <option value="10">10 - Продвинутый ИИ</option>
        </select>
        </div>

        <div style="margin-bottom: 10px;">
        <button id="debugApplyLevel" style="width: 100%; padding: 8px; background: #4CAF50; color: white; border: none; border-radius: 5px; cursor: pointer; margin-bottom: 5px;">
        Применить уровень
        </button>
        <button id="debugSpawnEnemy" style="width: 100%; padding: 8px; background: #2196F3; color: white; border: none; border-radius: 5px; cursor: pointer;">
        Заспавнить врага
        </button>
        </div>

        <div style="margin-bottom: 10px; border-top: 1px solid #444; padding-top: 10px;">
        <h4 style="margin: 0 0 8px 0; color: #FF9800;">Бонусы:</h4>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 5px;">
        <button class="debugBonusBtn" data-bonus="SHIELD" style="padding: 5px; background: #2196F3; color: white; border: none; border-radius: 3px; cursor: pointer;">🛡️ Щит</button>
        <button class="debugBonusBtn" data-bonus="INVINCIBILITY" style="padding: 5px; background: #9C27B0; color: white; border: none; border-radius: 3px; cursor: pointer;">✨ Неуязвимость</button>
        <button class="debugBonusBtn" data-bonus="AUTO_AIM" style="padding: 5px; background: #4CAF50; color: white; border: none; border-radius: 3px; cursor: pointer;">🎯 Автоприцел</button>
        <button class="debugBonusBtn" data-bonus="FORTIFY" style="padding: 5px; background: #FF9800; color: white; border: none; border-radius: 3px; cursor: pointer;">🏰 Укрепить базу</button>
        <button class="debugBonusBtn" data-bonus="TIME_STOP" style="padding: 5px; background: #607D8B; color: white; border: none; border-radius: 3px; cursor: pointer;">⏰ Стоп-время</button>
        <button id="debugAddLife" style="padding: 5px; background: #F44336; color: white; border: none; border-radius: 3px; cursor: pointer;">❤️ +1 жизнь</button>
        </div>
        </div>

        <div style="margin-bottom: 10px; border-top: 1px solid #444; padding-top: 10px;">
        <h4 style="margin: 0 0 8px 0; color: #FF9800;">Настройки отладки:</h4>
        <div style="margin-bottom: 5px;">
        <label style="display: flex; align-items: center; cursor: pointer;">
        <input type="checkbox" id="debugShowVision" style="margin-right: 5px;">
        Показывать зону видимости
        </label>
        </div>
        <div style="margin-bottom: 5px;">
        <label style="display: flex; align-items: center; cursor: pointer;">
        <input type="checkbox" id="debugShowAILog" style="margin-right: 5px;">
        Лог ИИ в консоль
        </label>
        </div>
        <div style="margin-bottom: 5px;">
        <label style="display: flex; align-items: center; cursor: pointer;">
        <input type="checkbox" id="debugGodMode" style="margin-right: 5px;">
        Режим бога
        </label>
        </div>
        </div>

        <div style="margin-bottom: 5px;">
        <label style="display: flex; align-items: center; cursor: pointer;">
        <input type="checkbox" id="debugShowZoneBorders" style="margin-right: 5px;">
        Границы зон
        </label>
        </div>
        <div style="margin-bottom: 5px;">
        <label style="display: flex; align-items: center; cursor: pointer;">
        <input type="checkbox" id="debugShowZoneNumbers" style="margin-right: 5px;">
        Номера зон
        </label>
        </div>
        <div style="margin-bottom: 5px;">
        <label style="display: flex; align-items: center; cursor: pointer;">
        <input type="checkbox" id="debugShowZoneInfo" style="margin-right: 5px;">
        Инфо о зонах
        </label>
        </div>
        <div style="margin-bottom: 5px;">
        <label style="display: flex; align-items: center; cursor: pointer;">
        <input type="checkbox" id="debugShowBaseZones" style="margin-right: 5px;">
        Зоны базы игрока (для ИИ)
        </label>
        </div>

        <div style="margin-bottom: 10px; border-top: 1px solid #444; padding-top: 10px;">
        <h4 style="margin: 0 0 8px 0; color: #FF9800;">Статистика:</h4>
        <button id="debugResetStats" style="width: 100%; padding: 8px; background: #FF5722; color: white; border: none; border-radius: 5px; cursor: pointer; margin-bottom: 5px;">
        🗑️ Сбросить статистику
        </button>
        <div style="font-size: 10px; color: #888; text-align: center;">
        Убийств: <span id="debugKills">0</span> |
        Смертей: <span id="debugDeaths">0</span> |
        Уровней: <span id="debugLevels">0</span>
        </div>
        </div>

        <div style="margin-bottom: 5px;">
        <label style="display: flex; align-items: center; cursor: pointer;">
        <input type="checkbox" id="debugShowMemory" style="margin-right: 5px;">
        Показывать память пути ИИ
        </label>
        </div>

        <div style="border-top: 1px solid #444; padding-top: 10px;">
        <div style="font-size: 10px; color: #888;">
        <div>Текущий ИИ: <span id="debugCurrentAI">Базовый</span></div>
        <div>Уровень игрока: <span id="debugPlayerLevel">1</span></div>
        <div>Опыт: <span id="debugPlayerExp">0</span></div>
        <div>Уровень игры: <span id="debugGameLevel">1</span></div>
        </div>
        </div>
        `;

        document.body.appendChild(debugMenu);

        // Настраиваем обработчики событий
        this.setupDebugEventListeners();
    }

    // НОВЫЙ МЕТОД: Настройка обработчиков дебаг-меню
    setupDebugEventListeners() {
        const levelSelect = document.getElementById('debugLevelSelect');
        const applyButton = document.getElementById('debugApplyLevel');
        const spawnButton = document.getElementById('debugSpawnEnemy');
        const showVision = document.getElementById('debugShowVision');
        const showAILog = document.getElementById('debugShowAILog');
        const godMode = document.getElementById('debugGodMode');
        const addLifeButton = document.getElementById('debugAddLife');
        const toggleMenuButton = document.getElementById('debugToggleMenu');
        // Обработчики для сетки зон
        const showZoneBorders = document.getElementById('debugShowZoneBorders');
        const showZoneNumbers = document.getElementById('debugShowZoneNumbers');
        const showZoneInfo = document.getElementById('debugShowZoneInfo');
        // Обработчик для зон базы
        const showBaseZones = document.getElementById('debugShowBaseZones');
        showBaseZones.addEventListener('change', (e) => {
            console.log("🎯 Зоны защиты базы:", e.target.checked);
            window.BASE_ZONE_SYSTEM.SHOW_BASE_ZONES = e.target.checked;
        });

        showZoneBorders.addEventListener('change', (e) => {
            ZONE_SYSTEM.SHOW_ZONE_BORDERS = e.target.checked;
        });

        showZoneNumbers.addEventListener('change', (e) => {
            ZONE_SYSTEM.SHOW_ZONE_NUMBERS = e.target.checked;
        });

        showZoneInfo.addEventListener('change', (e) => {
            this.debugShowZoneInfo = e.target.checked;
        });

        // Применение уровня
        applyButton.addEventListener('click', () => {
            const selectedLevel = parseInt(levelSelect.value);
            this.setGameLevel(selectedLevel);
        });

        // Спавн врага
        spawnButton.addEventListener('click', () => {
            this.debugSpawnTestEnemy();
        });

        // Показ зоны видимости
        showVision.addEventListener('change', (e) => {
            this.debugShowVision = e.target.checked;
        });

        // Лог ИИ
        showAILog.addEventListener('change', (e) => {
            this.debugAILog = e.target.checked;
        });

        // Режим бога
        godMode.addEventListener('change', (e) => {
            this.debugGodMode = e.target.checked;
            if (this.debugGodMode && this.player) {
                this.player.activateShield(999999);
                console.log('🦸 Режим бога активирован');
            }
        });

        // Добавление жизни
        addLifeButton.addEventListener('click', () => {
            this.debugAddLife();
        });

        // Кнопки бонусов
        document.querySelectorAll('.debugBonusBtn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const bonusType = e.target.dataset.bonus;
                this.debugAddBonus(bonusType);
            });
        });

        // Сброс статистики
        document.getElementById('debugResetStats').addEventListener('click', () => {
            if (confirm('Точно сбросить всю статистику? Это действие нельзя отменить.')) {
                this.resetPlayerStats();
                console.log('🗑️ Статистика сброшена');
            }
        });

        // Сворачивание/разворачивание меню
        toggleMenuButton.addEventListener('click', () => {
            const menu = document.getElementById('debugMenu');
            if (menu.style.display === 'none') {
                menu.style.display = 'block';
            } else {
                menu.style.display = 'none';
            }
        });

        // Обновляем информацию при загрузке
        this.updateDebugInfo();
    }

    // НОВЫЙ МЕТОД: Установка уровня игры
    setGameLevel(targetLevel) {
        console.log(`🎮 Устанавливаем уровень игры: ${targetLevel}`);

        this.level = targetLevel;

        // Перезапускаем уровень с новыми настройками
        this.initLevel();

        // Обновляем информацию о текущем ИИ
        this.updateDebugInfo();
    }

    // НОВЫЙ МЕТОД: Спавн тестового врага
    debugSpawnTestEnemy() {
        const spawnPoint = this.enemyManager.getNextSpawnPoint();
        this.enemyManager.spawnAnimations.push(new SpawnAnimation(spawnPoint.x, spawnPoint.y));

        setTimeout(() => {
            const enemyTypes = ['BASIC', 'FAST', 'HEAVY', 'SNIPER'];
            const enemyType = enemyTypes[Math.floor(Math.random() * enemyTypes.length)];
            const uniqueName = this.enemyManager.generateUniqueEnemyName(enemyType);

            const enemy = new Tank(spawnPoint.x, spawnPoint.y, 'enemy', this.level, enemyType);
            enemy.direction = DIRECTIONS.DOWN;
            enemy.username = uniqueName;

            // Устанавливаем ИИ соответствующий уровню
            if (enemy.setAILevel) {
                enemy.setAILevel(this.level);
            }

            this.enemyManager.enemies.push(enemy);
            console.log(`🎯 Заспавнен ${enemyType} танк на уровне ${this.level}`);
        }, 1000);
    }

    // НОВОЕ: Обновление дебаг информации
    updateDebugInfo() {
        // ДОБАВЛЯЕМ ПРОВЕРКУ НА СУЩЕСТВОВАНИЕ this.level
        if (typeof this.level === 'undefined') {
            console.warn('⚠️ this.level не определен, устанавливаем значение по умолчанию 1');
            this.level = 1;
        }

        const currentAIElement = document.getElementById('debugCurrentAI');
        if (currentAIElement) {
            // ТОЛЬКО ДВА ТИПА ИИ: базовый (1-4) и продвинутый (5-10)
            let aiName = this.level <= 4 ? 'Базовый' : 'Продвинутый';
            currentAIElement.textContent = aiName;
        }

        // Обновляем выбранный уровень в селекте
        const levelSelect = document.getElementById('debugLevelSelect');
        if (levelSelect) {
            levelSelect.value = this.level.toString();
        }

        // Обновляем информацию об игроке
        const playerLevelElement = document.getElementById('debugPlayerLevel');
        const playerExpElement = document.getElementById('debugPlayerExp');
        const gameLevelElement = document.getElementById('debugGameLevel');

        // Обновляем статистику в дебаг-меню
        const killsElement = document.getElementById('debugKills');
        const deathsElement = document.getElementById('debugDeaths');
        const levelsElement = document.getElementById('debugLevels');

        if (killsElement && this.playerStats) {
            killsElement.textContent = this.playerStats.enemiesKilled;
            deathsElement.textContent = this.playerStats.deaths;
            levelsElement.textContent = this.playerStats.levelsCompleted;
        }

        if (playerLevelElement) {
            playerLevelElement.textContent = this.playerLevel || 1;
        }
        if (playerExpElement) {
            playerExpElement.textContent = this.playerExperience || 0;
        }
        if (gameLevelElement) {
            gameLevelElement.textContent = this.level || 1;
        }
    }

    // НОВЫЕ МЕТОДЫ ДЛЯ ТЕСТИРОВАНИЯ
    debugTogglePanel() {
        const panel = document.getElementById('debugPanel');
        if (panel.style.display === 'none') {
            panel.style.display = 'block';
        } else {
            panel.style.display = 'none';
        }
    }

    // В методе debugAddBonus в Game.js ДОБАВЛЯЕМ проверки:
    debugAddBonus(bonusType) {
        if (this.player.isDestroyed) return;

        console.log(`🎁 Выдаем бонус: ${bonusType}`);

        switch(bonusType) {
            case 'SHIELD':
                this.player.activateShield(5000);
                break;
            case 'INVINCIBILITY':
                this.player.activateShield(10000);
                break;
            case 'AUTO_AIM':
                // ИСПРАВЛЕНИЕ: явно передаём время
                this.player.activateAutoAim(15000);
                break;
            case 'FORTIFY':
                this.fortifyBase(30000);
                break;
            case 'TIME_STOP':
                this.activateTimeStop(8000);
                break;
        }

        this.updateStatusIndicators();
    }

    debugAddLife() {
        this.lives++;
        this.updateUI();
        console.log(`❤️ Добавлена жизнь. Всего: ${this.lives}`);
    }

    debugSpawnEnemyWithBonus(enemyType) {
        const spawnPoint = this.enemyManager.getNextSpawnPoint();
        this.enemyManager.spawnAnimations.push(new SpawnAnimation(spawnPoint.x, spawnPoint.y));

        setTimeout(() => {
            const uniqueName = this.enemyManager.generateUniqueEnemyName(enemyType);
            const enemy = new Tank(spawnPoint.x, spawnPoint.y, 'enemy', this.level, enemyType);
            enemy.direction = DIRECTIONS.DOWN;
            enemy.username = uniqueName;

            const bonusTypes = ['SHIELD', 'INVINCIBILITY', 'AUTO_AIM', 'FORTIFY'];
            const randomBonus = bonusTypes[Math.floor(Math.random() * bonusTypes.length)];
            enemy.hasBonus = true;
            enemy.bonusType = BONUS_TYPES[randomBonus];

            this.enemyManager.enemies.push(enemy);
            console.log(`🎁 Создан ${enemyType} танк с бонусом: ${randomBonus}`);
        }, 1000);
    }

    // НОВЫЙ МЕТОД: Загрузка прогресса игрока (возвращает объект)
    loadPlayerProgress() {
        try {
            const savedProgress = localStorage.getItem('tankGame_playerProgress');
            if (savedProgress) {
                const progress = JSON.parse(savedProgress);
                console.log('✅ Прогресс игрока загружен:', progress);
                return {
                    level: progress.level || 1,
                    experience: progress.experience || 0
                };
            }
        } catch (error) {
            console.error('Ошибка загрузки прогресса:', error);
        }

        // Возвращаем значения по умолчанию
        return {
            level: 1,
            experience: 0
        };
    }

    // НОВЫЙ МЕТОД: Сохранение прогресса игрока
    savePlayerProgress() {
        try {
            const progress = {
                level: this.playerLevel,
                experience: this.playerExperience,
                timestamp: Date.now()
            };
            localStorage.setItem('tankGame_playerProgress', JSON.stringify(progress));
            console.log('💾 Прогресс сохранен:', progress);
        } catch (error) {
            console.error('Ошибка сохранения прогресса:', error);
        }
    }

    // НОВЫЙ МЕТОД: Сброс прогресса игрока
    resetPlayerProgress() {
        this.playerLevel = 1;
        this.playerExperience = 0;
        this.nextLevelExp = EXP_REQUIREMENTS[2];

        // Обновляем игрока если он существует
        if (this.player) {
            this.player.playerLevel = 1;
            this.player.experience = 0;
            this.player.upgradeToLevel(1);
        }

        localStorage.removeItem('tankGame_playerProgress');
        this.updatePlayerStats();
        console.log('🔄 Прогресс игрока сброшен');
    }

    // ОБНОВЛЯЕМ метод initLevel для правильного применения прогресса
    initLevel() {
        this.map = new GameMap(this.level);

        // СОЗДАЕМ игрока сначала без прогресса
        this.player = new Tank(224, 750);

        // ПРИМЕНЯЕМ сохраненный уровень К ИГРОКУ
        if (this.playerLevel > 1) {
            console.log(`🚀 Применяем сохраненный уровень ${this.playerLevel} к игроку`);
            // Сразу устанавливаем максимальный уровень
            this.player.playerLevel = this.playerLevel;
            this.player.experience = this.playerExperience;
            this.player.upgrade = PLAYER_UPGRADES[`LEVEL_${this.playerLevel}`];

            // Применяем характеристики
            this.player.speed = this.player.upgrade.speed;
            this.player.color = this.player.upgrade.color;
            this.player.bulletSpeed = this.player.upgrade.bulletSpeed;
            this.player.reloadTime = this.player.upgrade.reloadTime;
            this.player.bulletPower = this.player.upgrade.bulletPower;
            this.player.canDestroyConcrete = this.player.upgrade.canDestroyConcrete;

            // Устанавливаем здоровье
            this.player.health = this.player.upgrade.health;
        }

        // Очищаем телепорты
        this.exitTeleport = null;
        this.entryTeleport = null;

        // НОВОЕ: Обновляем дебаг информацию
        this.updateDebugInfo();

        // НОВОЕ: Очищаем статистику врагов
        if (this.enemyManager) {
            this.enemyManager.clearStats();
        }

        // Очищаем менеджеры
        this.enemyManager.clear();
        this.bonusManager.clear();
        this.effectManager.clear();

        this.bullets = [];
        this.screenShake = 0;

        // Сбрасываем укрепление базы
        this.baseFortified = false;
        this.baseFortifyTime = 0;
        this.baseFortifyDuration = 0;
        this.originalBaseWalls = [];

        this.enemiesDestroyed = 0;
        this.enemiesToSpawn = TOTAL_ENEMIES_PER_LEVEL;
        this.levelComplete = false;
        this.gameOver = false;
        this.showGameOverScreen = false;
        this.showLevelCompleteScreen = false;
        this.baseDestroyed = false;

        // Добавляем свойства для эффекта времени
        this.timeStopActive = false;
        this.timeStopStartTime = 0;
        this.timeStopDuration = 12000;
        this.timeResumePlayed = false;

        this.updateUI();
        this.updateStatusIndicators();
        this.soundManager.updateEngineSound(false, true);

        // Обновляем статистику игрока
        this.updatePlayerStats();

        document.getElementById('levelComplete').style.display = 'none';
        document.getElementById('gameOver').style.display = 'none';

        console.log(`🎮 Игрок создан: уровень ${this.player.playerLevel}, опыт ${this.player.experience}`);
    }

    // Добавляем метод активации остановки времени
    activateTimeStop() {
        if (this.timeStopActive) {
            console.log('⏰ Остановка времени уже активна, продлеваем эффект');

            // Сбрасываем флаг звука разморозки при продлении
            this.timeResumePlayed = false;

            // Продлеваем время заморозки для всех врагов
            const newEndTime = Date.now() + this.timeStopDuration;
            this.enemyManager.enemies.forEach(enemy => {
                if (enemy.isFrozen) {
                    enemy.freezeDuration = this.timeStopDuration;
                    enemy.freezeStartTime = Date.now();
                }
            });

            this.timeStopStartTime = Date.now();
            return;
        }

        this.timeStopActive = true;
        this.timeStopStartTime = Date.now();
        this.timeResumePlayed = false; // Сбрасываем флаг

        // Замораживаем всех текущих врагов
        this.enemyManager.enemies.forEach(enemy => {
            enemy.freeze(this.timeStopDuration);
        });

        // Запускаем звук
        if (this.soundManager) {
            this.soundManager.playTimeStop();
        }

        console.log(`⏰ Активирована остановка времени на 12 секунд`);
    }

    // ОПТИМИЗИРОВАННЫЙ метод обновления
    update() {
        // === ОПТИМИЗАЦИЯ: Редкие обновления для тяжелых систем ===
        this.frameCount = this.frameCount || 0;

        if (this.frameCount % 2 === 0) {
            this.updateInfrequentSystems();
        }
        this.frameCount++;
        // === КОНЕЦ ОПТИМИЗАЦИИ ===

        this.handleInput();

        // Проверяем вход в телепорт
        if (this.exitTeleport && this.exitTeleport.active) {
            this.checkTeleportEntry();
        }

        // Обновляем телепорты
        if (this.exitTeleport) {
            this.exitTeleport.update();
        }
        if (this.entryTeleport) {
            this.entryTeleport.update();

            // Удаляем неактивный телепорт входа
            if (!this.entryTeleport.active) {
                this.entryTeleport = null;
            }
        }

        // НОВОЕ: Проверяем вход/выход игрока
        if (!this.playerEnteredLevel) {
            this.checkPlayerEntry();
        } else if (this.waitingForExit) {
            this.checkPlayerExit();
        }

        // ИСПРАВЛЕНИЕ: Дополнительная проверка звуков при завершении уровня
        if (this.levelComplete && this.soundManager && !this.isPlayerMoving) {
            // Если уровень завершён и игрок не двигается - останавливаем звук движения
            this.soundManager.stopLoop('engineMoving');
        }

        const allTanks = [this.player, ...this.enemyManager.enemies];

        // ИСПРАВЛЕНИЕ: Правильное использование deltaTime
        const fixedDelta = 16; // Фиксированный шаг для 60 FPS

        if (!this.player.isDestroyed) {
            this.player.update();
        }

        // Обновляем врагов с фиксированным временем
        if ((this.playerEnteredLevel || this.level === 1) && !this.levelComplete) {
            if (typeof EnemyAI !== 'undefined') {
                this.enemyManager.update();
            }
            this.enemyManager.updateRespawns();
        }

        // Обновляем врагов только если ИИ загружен
        if (typeof EnemyAI !== 'undefined') {
            this.enemyManager.update();
        }

        this.updateBullets();
        this.effectManager.update();
        this.updateScreenShake();
        this.updateStatusIndicators();

        // ОБНОВЛЯЕМ: Обновляем карту только если игрок вошел
        if (this.playerEnteredLevel) {
            this.updateBaseFortification();
            this.bonusManager.update();
            this.map.update(allTanks);
            this.checkLevelCompletion();
        }

        // Обновление специальных систем
        this.updateBaseFortification();
        this.bonusManager.update();
        this.map.update(allTanks);

        // Проверка завершения уровня
        this.checkLevelCompletion();

        // Проверяем остановку времени
        if (this.timeStopActive) {
            const elapsed = Date.now() - this.timeStopStartTime;
            const remaining = this.timeStopDuration - elapsed;

            // Проигрываем звук разморозки за 1 секунду до конца
            if (remaining <= 1000 && !this.timeResumePlayed && this.soundManager) {
                this.soundManager.play('timeResume');
                this.timeResumePlayed = true;
                console.log('⏰ Звук разморозки воспроизведен');
            }

            // Завершаем эффект
            if (remaining <= 0) {
                this.timeStopActive = false;
                if (this.soundManager) {
                    this.soundManager.stopTimeStop();
                }
                console.log('⏰ Остановка времени завершена');
            }
        }
    }

    updateTimeStopEffect() {
        if (this.timeStopActive) {
            const elapsed = Date.now() - this.timeStopStartTime;
            const progress = elapsed / this.timeStopDuration;

            if (progress >= 1) {
                // Эффект закончился
                this.timeStopActive = false;
            }
            // УДАЛЯЕМ логику изменения цвета
        }
    }

    // ОПТИМИЗИРОВАННЫЙ метод обновления пуль
    updateBullets() {
        // Оптимизация: проверяем столкновения пуль только если их много
        if (this.bullets.length > 10) {
            this.checkBulletCollisions();
        }

        // Обновление пуль и проверка столкновений
        for (let i = this.bullets.length - 1; i >= 0; i--) {
            const bullet = this.bullets[i];
            bullet.deltaTime = this.deltaTime;
            bullet.update();

            if (!this.processBulletCollisions(bullet, i)) {
                continue;
            }
        }
    }

    // Оптимизированная проверка столкновений пуль
    checkBulletCollisions() {
        // Проверка столкновений между пулями (только при большом количестве)
        for (let i = this.bullets.length - 1; i >= 0; i--) {
            for (let j = this.bullets.length - 1; j > i; j--) {
                if (this.bullets[i].owner !== this.bullets[j].owner &&
                    this.bullets[i].getBounds().intersects(this.bullets[j].getBounds())) {

                    this.effectManager.addBulletExplosion(this.bullets[i].position.x, this.bullets[i].position.y);
                this.bullets.splice(i, 1);
                this.bullets.splice(j, 1);
                this.soundManager.play('bulletCollision');
                break;
                    }
            }
        }
    }

    // Вынесена логика обработки столкновений пуль
    processBulletCollisions(bullet, index) {
        const destructionResult = this.map.checkBulletCollision(bullet);
        if (destructionResult) {
            return this.handleBulletMapCollision(bullet, index, destructionResult);
        }

        const bulletBounds = bullet.getBounds();

        if (bullet.owner === 'player') {
            return this.handlePlayerBulletCollision(bullet, index, bulletBounds);
        } else {
            return this.handleEnemyBulletCollision(bullet, index, bulletBounds);
        }

        return true;
    }

    handleBulletMapCollision(bullet, index, destructionResult) {
        switch(destructionResult) {
            case 'base':
                this.effectManager.addExplosion(bullet.position.x, bullet.position.y, 'base');
                this.screenShake = 50;
                this.soundManager.play('baseExplosion');
                if (!this.gameOver) {
                    this.gameOver = true;
                    this.baseDestroyed = true;
                    this.showGameOverScreen = true;
                    this.showGameOver();
                }
                this.bullets.splice(index, 1);
                return false;
            case 'concrete':
                this.effectManager.addBulletExplosion(bullet.position.x, bullet.position.y);
                this.soundManager.play('bulletHit');
                this.bullets.splice(index, 1);
                return false;
            case 'brick':
                this.effectManager.addBulletExplosion(bullet.position.x, bullet.position.y);
                this.soundManager.play('brickHit');
                this.bullets.splice(index, 1);
                return false;
        }
        return true;
    }

    // В методе handlePlayerBulletCollision ДОБАВЛЯЕМ:
    handlePlayerBulletCollision(bullet, index, bulletBounds) {
        for (let j = this.enemyManager.enemies.length - 1; j >= 0; j--) {
            const enemy = this.enemyManager.enemies[j];
            if (bulletBounds.intersects(enemy.getBounds())) {

                const healthBefore = enemy.health;
                const isHeavyTank = enemy.enemyType === 'HEAVY';

                const hadBonus = enemy.hasBonus;
                const bonusType = enemy.bonusType;

                const destructionResult = enemy.takeDamage();

                if (destructionResult === true || destructionResult === 'bonus') {
                    this.effectManager.addExplosion(enemy.position.x, enemy.position.y, 'tank');
                    if (enemy.enemyType === 'HEAVY') {
                        this.screenShake = 25;
                    } else {
                        this.screenShake = 20;
                    }
                    this.soundManager.play('tankExplosion');

                    // НОВОЕ: Учет убийства врага
                    this.recordEnemyKill();

                    this.player.addExperience(enemy.enemyType);
                    this.playerExperience = this.player.experience;
                    this.playerLevel = this.player.playerLevel;
                    this.savePlayerProgress();

                    if (hadBonus && bonusType) {
                        this.bonusManager.spawnBonusFromTank(enemy);
                    }

                    this.enemyManager.enemies.splice(j, 1);
                    this.enemiesDestroyed++;
                    this.score += 100;
                    this.updateUI();
                } else {
                    if (isHeavyTank && enemy.health > 0) {
                        this.soundManager.play('heavyTankHit');
                    }
                }

                this.bullets.splice(index, 1);
                return false;
            }
        }
        return true;
    }

    // ОБНОВЛЯЕМ метод обновления статистики
    updatePlayerStats() {
        const expElement = document.getElementById('playerExp');
        const levelElement = document.getElementById('playerLevel');

        if (expElement) {
            const nextLevel = this.playerLevel + 1;
            const nextExp = EXP_REQUIREMENTS[nextLevel] || 999;
            expElement.textContent = `${this.playerExperience}/${nextExp}`;
        }
        if (levelElement) {
            levelElement.textContent = this.playerLevel;
        }

        // ОТЛАДОЧНАЯ ИНФОРМАЦИЯ
        const debugPlayerLevel = document.getElementById('debugPlayerLevel');
        const debugPlayerExp = document.getElementById('debugPlayerExp');
        const debugGameLevel = document.getElementById('debugGameLevel');
        const debugGameExp = document.getElementById('debugGameExp');

        if (debugPlayerLevel && this.player) {
            debugPlayerLevel.textContent = this.player.playerLevel;
            debugPlayerExp.textContent = this.player.experience;
        }
        if (debugGameLevel) {
            debugGameLevel.textContent = this.playerLevel;
            debugGameExp.textContent = this.playerExperience;
        }
    }

    // НОВЫЙ МЕТОД: Показ уведомления об апгрейде
    showUpgradeNotification(message) {
        // Создаем временное уведомление
        const notification = document.createElement('div');
        notification.style.cssText = `
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: rgba(0, 0, 0, 0.8);
        color: #4CAF50;
        padding: 10px 20px;
        border: 2px solid #4CAF50;
        border-radius: 5px;
        font-family: 'Courier New', monospace;
        font-size: 18px;
        font-weight: bold;
        z-index: 1000;
        `;
        notification.textContent = message;

        document.body.appendChild(notification);

        // Удаляем через 3 секунды
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 3000);
    }

    // В методе handleEnemyBulletCollision ДОБАВЛЯЕМ:
    handleEnemyBulletCollision(bullet, index, bulletBounds) {
        if (!this.player.isDestroyed && bulletBounds.intersects(this.player.getBounds())) {
            if (this.player.takeDamage()) {
                this.effectManager.addExplosion(this.player.position.x, this.player.position.y, 'tank');
                this.screenShake = 35;
                this.soundManager.play('tankExplosion');

                // НОВОЕ: Учет смерти игрока
                this.recordPlayerDeath();

                if (bullet.shooter && bullet.owner === 'enemy') {
                    console.log(`💀 ${bullet.shooter.username} УБИЛ ИГРОКА!`);
                    bullet.shooter.recordPlayerKill();
                    this.addToLeaderboard(bullet.shooter);
                    this.saveEnemyStatsToStorage(bullet.shooter);
                }

                this.lives--;
                this.updateUI();
                if (this.lives <= 0) {
                    this.gameOver = true;
                    this.showGameOverScreen = true;
                    this.showGameOver();
                } else {
                    this.player = new Tank(224, 750);
                    this.player.activateShield(5000);
                }
            }
            this.bullets.splice(index, 1);
            return false;
        }
        return true;
    }

    setupEventListeners() {
        document.addEventListener('keydown', (e) => {
            this.keys[e.code] = true;

            if (e.code === 'ArrowUp' || e.code === 'KeyW') {
                this.directionPriority = DIRECTIONS.UP;
            } else if (e.code === 'ArrowDown' || e.code === 'KeyS') {
                this.directionPriority = DIRECTIONS.DOWN;
            } else if (e.code === 'ArrowLeft' || e.code === 'KeyA') {
                this.directionPriority = DIRECTIONS.LEFT;
            } else if (e.code === 'ArrowRight' || e.code === 'KeyD') {
                this.directionPriority = DIRECTIONS.RIGHT;
            }

            if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code)) {
                e.preventDefault();
            }
        });

        document.addEventListener('keyup', (e) => {
            this.keys[e.code] = false;

            if ((e.code === 'ArrowUp' || e.code === 'KeyW') && this.directionPriority === DIRECTIONS.UP) {
                this.directionPriority = null;
            } else if ((e.code === 'ArrowDown' || e.code === 'KeyS') && this.directionPriority === DIRECTIONS.DOWN) {
                this.directionPriority = null;
            } else if ((e.code === 'ArrowLeft' || e.code === 'KeyA') && this.directionPriority === DIRECTIONS.LEFT) {
                this.directionPriority = null;
            } else if ((e.code === 'ArrowRight' || e.code === 'KeyD') && this.directionPriority === DIRECTIONS.RIGHT) {
                this.directionPriority = null;
            }
        });

        this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    }

    resetLeaderboard() {
        this.leaderboard = [];
        this.saveLeaderboard();
        this.updateLeaderboardUI();
    }

    getCurrentDirection() {
        if (this.directionPriority) {
            return this.directionPriority;
        }

        if (this.keys['ArrowUp'] || this.keys['KeyW']) return DIRECTIONS.UP;
        if (this.keys['ArrowDown'] || this.keys['KeyS']) return DIRECTIONS.DOWN;
        if (this.keys['ArrowLeft'] || this.keys['KeyA']) return DIRECTIONS.LEFT;
        if (this.keys['ArrowRight'] || this.keys['KeyD']) return DIRECTIONS.RIGHT;

        return null;
    }

    handleInput() {
        const allTanks = [this.player, ...this.enemyManager.enemies];
        const allFragments = this.getAllFragments();
        const currentDirection = this.getCurrentDirection();

        const wasMoving = this.isPlayerMoving;
        this.isPlayerMoving = false;

        if (currentDirection && !this.player.isDestroyed && !this.baseDestroyed) {
            if (this.player.move(currentDirection, this.map, allTanks, allFragments)) {
                this.isPlayerMoving = true;
            }
        }

        // ИСПРАВЛЕНИЕ: Правильное управление звуками при завершении уровня
        if (wasMoving !== this.isPlayerMoving && this.soundManager) {
            if (this.gameOver || this.player.isDestroyed) {
                // При gameOver или уничтожении игрока - останавливаем все звуки
                this.soundManager.stopLoop('engineIdle');
                this.soundManager.stopLoop('engineMoving');
            } else if (this.levelComplete) {
                // При завершении уровня - останавливаем только холостой ход
                if (this.isPlayerMoving) {
                    // Если игрок двигается - оставляем звук движения
                    this.soundManager.stopLoop('engineIdle');
                    this.soundManager.playLoop('engineMoving');
                } else {
                    // Если игрок стоит - останавливаем оба звука
                    this.soundManager.stopLoop('engineIdle');
                    this.soundManager.stopLoop('engineMoving');
                }
            } else {
                // Обычный режим - стандартное управление звуками
                if (this.isPlayerMoving) {
                    this.soundManager.stopLoop('engineIdle');
                    this.soundManager.playLoop('engineMoving');
                } else {
                    this.soundManager.stopLoop('engineMoving');
                    this.soundManager.playLoop('engineIdle');
                }
            }
        }

        if ((this.keys['Space'] || this.keys['Enter']) && this.player.canShoot && !this.player.isDestroyed && !this.baseDestroyed) {
            let nearestEnemy = null;
            if (this.player.hasAutoAim) {
                nearestEnemy = this.player.findNearestTarget(this.enemyManager.enemies, this.map);
            }

            const bullet = this.player.shoot(nearestEnemy);
            if (bullet) {
                this.bullets.push(bullet);
                this.soundManager.play('playerShot');
            }
        }

        // Обновляем дебаг информацию
        const bonusTanksCount = this.enemyManager.enemies.filter(enemy => enemy.hasBonus).length;
        this.debugInfo.textContent =
        `Уровень: ${this.level} | Уничтожено: ${this.enemiesDestroyed}/${TOTAL_ENEMIES_PER_LEVEL} | ` +
        `Осталось заспавнить: ${this.enemiesToSpawn} | Бонусы: ${this.bonusManager.bonuses.length} | ` +
        `Танки с бонусами: ${bonusTanksCount} | FPS: ${Math.round(1000 / this.deltaTime)}` +
        (this.gameOver ? ' | ИГРА ОКОНЧЕНА' : '') +
        (this.levelComplete ? ' | УРОВЕНЬ ПРОЙДЕН' : '') +
        (this.baseDestroyed ? ' | БАЗА УНИЧТОЖЕНА' : '');
    }

    loadLeaderboard() {
        try {
            const saved = localStorage.getItem('tankGame_leaderboard');
            if (saved) {
                const parsed = JSON.parse(saved);
                return parsed;
            }
        } catch (error) {
            console.error('Ошибка загрузки:', error);
        }
        return [];
    }

    saveLeaderboard() {
        try {
            localStorage.setItem('tankGame_leaderboard', JSON.stringify(this.leaderboard));
        } catch (error) {
            console.error('Ошибка сохранения:', error);
        }
    }

    addToLeaderboard(enemy) {
        if (!enemy || !enemy.username) return;

        const existingIndex = this.leaderboard.findIndex(entry =>
        entry.name === enemy.username && entry.type === enemy.enemyType
        );

        if (existingIndex !== -1) {
            this.leaderboard[existingIndex].score += 100;
            this.leaderboard[existingIndex].level = this.level;
        } else {
            const newEntry = {
                name: enemy.username,
                type: enemy.enemyType,
                score: 100,
                level: this.level
            };
            this.leaderboard.push(newEntry);
        }

        this.leaderboard.sort((a, b) => b.score - a.score);
        this.saveLeaderboard();
        this.updateLeaderboardUI();
    }

    updateLeaderboardUI() {
        const container = document.getElementById('leaderboardEntries');
        if (!container) return;

        container.innerHTML = '';

        const icons = {
            'BASIC': '🔴',
            'FAST': '🟡',
            'HEAVY': '🟣',
            'SNIPER': '🟢'
        };

        const displayEntries = this.showFullLeaderboard ? this.leaderboard : this.leaderboard.slice(0, 3);

        if (displayEntries.length === 0) {
            container.innerHTML = '<div style="text-align: center; color: #888; font-size: 12px;">Победителей пока нет</div>';
            return;
        }

        displayEntries.forEach((entry, index) => {
            const entryEl = document.createElement('div');
            entryEl.className = 'leaderboard-entry';

            const rank = this.showFullLeaderboard ? index + 1 : (this.leaderboard.findIndex(e => e.name === entry.name && e.type === entry.type) + 1);

            entryEl.innerHTML = `
            <span class="rank">${rank}</span>
            <span class="tank-icon">${icons[entry.type] || '⚫'}</span>
            <span class="name">${entry.name}</span>
            <span class="score">${entry.score}</span>
            <span class="level">ур.${entry.level}</span>
            `;
            container.appendChild(entryEl);
        });

        const leaderboard = document.getElementById('leaderboard');
        if (leaderboard) {
            const title = leaderboard.querySelector('h3');
            if (title) {
                const total = this.leaderboard.length;
                const shown = this.showFullLeaderboard ? total : Math.min(3, total);
                title.textContent = `🏆 Лидеры (${shown}/${total})`;
            }
            leaderboard.style.display = 'block';
        }
    }

    getAllFragments() {
        const allFragments = [];
        this.map.brickTiles.forEach(brick => {
            allFragments.push(...brick.fragments.filter(f => f.active && f.collisionEnabled));
        });
        return allFragments;
    }

    updateStatusIndicators() {
        this.updateShieldIndicator();
        this.updateInvincibilityIndicator();
        this.updateFortifyIndicator();
        this.updateAutoAimIndicator();
    }

    // В Game.js ОБНОВЛЯЕМ метод updateStatusIndicator:
    updateStatusIndicator(indicatorId, timeElementId, isActive, remainingTime) {
        const indicator = document.getElementById(indicatorId);
        const timeElement = document.getElementById(timeElementId);

        // ИСПРАВЛЕНИЕ: Более строгая проверка активности
        const shouldShow = isActive && remainingTime > 0 && !this.player.isDestroyed && !this.baseDestroyed;

        if (shouldShow) {
            timeElement.textContent = remainingTime.toFixed(1);
            indicator.style.display = 'block';
        } else {
            // ИСПРАВЛЕНИЕ: Гарантированно скрываем при неактивности
            indicator.style.display = 'none';
            timeElement.textContent = '0.0';
        }
    }

    updateShieldIndicator() {
        const remainingTime = this.player.hasShield() ? this.player.shield.getRemainingTime() : 0;
        this.updateStatusIndicator('shieldIndicator', 'shieldTime', this.player.hasShield(), remainingTime);
    }

    updateInvincibilityIndicator() {
        const remainingTime = this.player.isInvincible ?
        (this.player.invincibilityDuration - this.player.invincibilityTimer) / 1000 : 0;
        this.updateStatusIndicator('invincibilityIndicator', 'invincibilityTime', this.player.isInvincible, remainingTime);
    }

    // В Game.js ИСПРАВЛЯЕМ метод updateAutoAimIndicator:
    updateAutoAimIndicator() {
        // ИСПРАВЛЕНИЕ: Правильная проверка наличия бонуса
        const hasAutoAim = this.player.hasAutoAim &&
        this.player.autoAimDuration > 0 &&
        this.player.autoAimTimer < this.player.autoAimDuration;

        if (!hasAutoAim) {
            // Сбрасываем таймер и скрываем индикатор
            this.player.autoAimTimer = 0;
            this.player.autoAimDuration = 0;
            const indicator = document.getElementById('autoaimIndicator');
            const timeElement = document.getElementById('autoaimTime');
            if (indicator) indicator.style.display = 'none';
            if (timeElement) timeElement.textContent = '0.0';
            return;
        }

        const remainingTime = (this.player.autoAimDuration - this.player.autoAimTimer) / 1000;
        this.updateStatusIndicator('autoaimIndicator', 'autoaimTime', true, Math.max(0, remainingTime));
    }

    // ОБНОВЛЯЕМ метод updateFortifyIndicator:
    updateFortifyIndicator() {
        if (!this.baseFortified || !this.baseFortifyStartTime) {
            const indicator = document.getElementById('fortifyIndicator');
            const timeElement = document.getElementById('fortifyTime');
            if (indicator) indicator.style.display = 'none';
            if (timeElement) timeElement.textContent = '0.0';
            return;
        }

        const currentTime = Date.now();
        const elapsedTime = currentTime - this.baseFortifyStartTime;
        const remainingTime = (this.baseFortifyDuration - elapsedTime) / 1000;

        this.updateStatusIndicator('fortifyIndicator', 'fortifyTime', this.baseFortified, Math.max(0, remainingTime));
    }

    // ВРЕМЕННЫЙ МЕТОД для тестирования
    testLevelLeader() {
        console.log("🧪 Тестируем систему лидеров...");

        // Создаем тестового врага с статистикой
        if (this.enemyManager.enemies.length > 0) {
            const testEnemy = this.enemyManager.enemies[0];
            if (testEnemy.levelStats) {
                testEnemy.levelStats.shots = 10;
                testEnemy.levelStats.wallsDestroyed = 5;
                testEnemy.levelStats.playerKills = 1;
                testEnemy.levelStats.baseDestroyed = false;
                testEnemy.calculateTotalScore();

                console.log(`🧪 Тестовые данные: ${testEnemy.username}`, testEnemy.levelStats);
            }
        }
    }

    // ОБНОВЛЯЕМ метод checkLevelCompletion - враги появляются только после входа
    checkLevelCompletion() {
        // Убедитесь, что игрок вошел на уровень
        if (!this.playerEnteredLevel && this.level !== 1) return;

        //console.log(`🔍 Проверка завершения: врагов уничтожено ${this.enemiesDestroyed}/${TOTAL_ENEMIES_PER_LEVEL}, осталось врагов: ${this.enemyManager.enemies.length}, спавн анимаций: ${this.enemyManager.spawnAnimations.length}`);

        if (this.enemiesDestroyed >= TOTAL_ENEMIES_PER_LEVEL &&
            this.enemyManager.enemies.length === 0 &&
            this.enemyManager.spawnAnimations.length === 0 &&
            !this.levelComplete) {

            console.log("✅ Условия завершения уровня выполнены!");
        this.levelComplete = true;
        this.levelCompleteTimer = 0;

        // Сразу показываем завершение уровня
        setTimeout(() => {
            console.log("🎯 Запускаем расчет лидера и показ статистики");
            this.calculateLevelLeader();
            this.showLevelCompleteStats = true;
            this.showLevelComplete();
        }, 1000); // Уменьшил задержку для тестирования
            }
    }

    // НОВЫЙ МЕТОД: Сохранение статистики врага в localStorage
    saveEnemyStatsToStorage(enemy) {
        if (!enemy || !enemy.username) return;

        try {
            const storageKey = `tankGame_level_${this.level}_stats`;
            let levelStats = JSON.parse(localStorage.getItem(storageKey)) || {};

            // Сохраняем/обновляем статистику врага
            levelStats[enemy.username] = {
                enemyType: enemy.enemyType,
                stats: enemy.levelStats,
                timestamp: Date.now()
            };

            localStorage.setItem(storageKey, JSON.stringify(levelStats));
            //console.log(`💾 Сохранена статистика ${enemy.username} для уровня ${this.level}`);
        } catch (error) {
            console.error('Ошибка сохранения статистики:', error);
        }
    }

    // НОВЫЙ МЕТОД: Загрузка статистики уровня из localStorage
    loadLevelStatsFromStorage() {
        try {
            const storageKey = `tankGame_level_${this.level}_stats`;
            return JSON.parse(localStorage.getItem(storageKey)) || {};
        } catch (error) {
            console.error('Ошибка загрузки статистики:', error);
            return {};
        }
    }

    // НОВЫЙ МЕТОД: Очистка статистики уровня (при переходе на следующий уровень)
    clearLevelStatsFromStorage() {
        try {
            const storageKey = `tankGame_level_${this.level}_stats`;
            localStorage.removeItem(storageKey);
            console.log(`🗑️ Очищена статистика уровня ${this.level}`);
        } catch (error) {
            console.error('Ошибка очистки статистики:', error);
        }
    }

    // ОБНОВЛЯЕМ метод calculateLevelLeader - используем localStorage
    calculateLevelLeader() {
        console.log("🔍 Начинаем расчет лидера уровня из localStorage...");

        let bestEnemy = null;
        let bestScore = -1;

        // Загружаем статистику из localStorage
        const levelStats = this.loadLevelStatsFromStorage();
        console.log(`📊 Загружено записей из localStorage: ${Object.keys(levelStats).length}`);

        // Ищем врага с максимальным счетом
        Object.entries(levelStats).forEach(([enemyName, data]) => {
            const stats = data.stats;
            console.log(`📈 ${enemyName}: ${stats.totalScore} очков (выстрелы: ${stats.shots}, стены: ${stats.wallsDestroyed}, убийства: ${stats.playerKills}, база: ${stats.baseDestroyed})`);

            if (stats.totalScore > bestScore) {
                bestScore = stats.totalScore;
                bestEnemy = {
                    enemy: {
                        username: enemyName,
                        enemyType: data.enemyType
                    },
                    stats: stats
                };
                console.log(`🎯 Новый лидер: ${enemyName}`);
            }
        });

        this.levelLeader = bestEnemy;

        if (this.levelLeader) {
            console.log(`🏆 Лидер уровня: ${this.levelLeader.enemy.username} с ${this.levelLeader.stats.totalScore} очками`);
        } else {
            console.log("❌ Лидер не найден в localStorage");
        }
    }

    // НОВЫЙ МЕТОД: Сохранение в таблицу лидеров уровня
    saveLevelLeaderboard() {
        if (!this.levelLeader) return;

        const levelKey = `level_${this.level}_leader`;
        const leaderData = {
            level: this.level,
            enemyName: this.levelLeader.enemy.username,
            enemyType: this.levelLeader.enemy.enemyType,
            stats: this.levelLeader.stats,
            timestamp: Date.now()
        };

        try {
            localStorage.setItem(levelKey, JSON.stringify(leaderData));
        } catch (error) {
            console.error('Ошибка сохранения лидера уровня:', error);
        }
    }

    // НОВЫЙ МЕТОД: Загрузка лидера уровня
    loadLevelLeader(level) {
        const levelKey = `level_${level}_leader`;
        try {
            const saved = localStorage.getItem(levelKey);
            return saved ? JSON.parse(saved) : null;
        } catch (error) {
            console.error('Ошибка загрузки лидера уровня:', error);
            return null;
        }
    }

    // В методе showLevelComplete ДОБАВЛЯЕМ управление звуками:
    showLevelComplete() {
        console.log("🖥️ Показываем экран завершения уровня");
        this.showLevelCompleteScreen = true;
        const levelCompleteScreen = document.getElementById('levelComplete');

        if (!levelCompleteScreen) {
            console.error("❌ Элемент levelComplete не найден!");
            return;
        }

        // Обычная информация
        document.getElementById('destroyedTanks').textContent = this.enemiesDestroyed;
        document.getElementById('levelScore').textContent = this.score;

        // Показываем статистику лидера
        this.showLevelLeaderStats();

        levelCompleteScreen.style.display = 'block';

        // ИСПРАВЛЕНИЕ: Останавливаем только звук холостого хода
        if (this.soundManager) {
            this.soundManager.stopLoop('engineIdle');
            // Звук движения остаётся, если игрок двигается
        }

        console.log("✅ Экран завершения уровня показан");
    }

    // ОБНОВЛЯЕМ метод showLevelLeaderStats - упрощенная версия
    showLevelLeaderStats() {
        const leaderContent = document.getElementById('leaderContent');
        const levelLeaderStats = document.getElementById('levelLeaderStats');

        if (this.levelLeader && leaderContent) {
            leaderContent.innerHTML = this.generateLeaderStatsHTML(this.levelLeader);
            levelLeaderStats.style.display = 'block';
            console.log(`✅ Показан лидер: ${this.levelLeader.enemy.username}`);
        } else {
            // Простое сообщение если лидера нет
            leaderContent.innerHTML = `
            <div style="text-align: center; color: #888; padding: 20px;">
            <p>Ни один противник не проявил активности</p>
            <p>🥱 Все враги были пассивны</p>
            </div>
            `;
            levelLeaderStats.style.display = 'block';
            console.log("ℹ️ Показано сообщение об отсутствии активности");
        }
    }

    // НОВЫЙ МЕТОД: Создание UI для статистики лидера
    createLevelLeaderStatsUI() {
        const levelCompleteScreen = document.getElementById('levelComplete');

        const statsHTML = `
        <div class="level-leader-stats" id="levelLeaderStats" style="display: none;">
        <div class="leader-header">
        <h3>🥇 Лидер уровня</h3>
        <button class="close-stats-btn" onclick="game.closeLevelStats()" style="
        background: none;
        border: none;
        color: white;
        font-size: 20px;
        cursor: pointer;
        position: absolute;
        top: 10px;
        right: 10px;
        ">×</button>
        </div>
        <div class="leader-content" id="leaderContent">
        <!-- Сюда будет вставлена статистика -->
        </div>
        </div>
        `;

        levelCompleteScreen.insertAdjacentHTML('beforeend', statsHTML);
        this.showLevelLeaderStats(); // Показываем статистику если есть
    }

    // ОБНОВЛЯЕМ метод generateLeaderStatsHTML для работы с данными из localStorage
    generateLeaderStatsHTML(leader) {
        const enemyTypeIcons = {
            'BASIC': '🔴',
            'FAST': '🟡',
            'HEAVY': '🟣',
            'SNIPER': '🟢'
        };

        const icon = enemyTypeIcons[leader.enemy.enemyType] || '⚫';

        return `
        <div class="leader-tank-info">
        <div class="tank-icon-large">${icon}</div>
        <div class="tank-name">${leader.enemy.username}</div>
        <div class="total-score">Общий счет: ${leader.stats.totalScore}</div>
        </div>
        <div class="leader-stats-details">
        <div class="stat-row">
        <span class="stat-label">Выстрелов:</span>
        <span class="stat-value">${leader.stats.shots}</span>
        </div>
        <div class="stat-row">
        <span class="stat-label">Разрушенных стен:</span>
        <span class="stat-value">${leader.stats.wallsDestroyed}</span>
        </div>
        <div class="stat-row">
        <span class="stat-label">Убийств игрока:</span>
        <span class="stat-value">${leader.stats.playerKills}</span>
        </div>
        <div class="stat-row">
        <span class="stat-label">Разрушений базы:</span>
        <span class="stat-value">${leader.stats.baseDestroyed ? '1' : '0'}</span>
        </div>
        </div>
        `;
    }


    // В методе closeLevelStats ОБНОВЛЯЕМ управление звуками:
    closeLevelStats() {
        console.log("🚪 Закрываем статистику и создаем телепорт");

        // Останавливаем обратный отсчёт если он идет
        if (this.countdownInterval) {
            clearInterval(this.countdownInterval);
            this.countdownInterval = null;
        }

        this.showLevelCompleteStats = false;
        this.showLevelCompleteScreen = false;

        const levelCompleteScreen = document.getElementById('levelComplete');
        if (levelCompleteScreen) {
            levelCompleteScreen.style.display = 'none';
        }

        // Создаем телепорт выхода
        this.createExitTeleport();
    }

    // НОВЫЙ МЕТОД: Проверка входа в телепорт
    checkTeleportEntry() {
        if (!this.exitTeleport || !this.exitTeleport.active) return false;

        if (this.exitTeleport.isPlayerInside(this.player)) {
            console.log("🎯 Игрок вошел в телепорт выхода!");

            // Сохраняем ТОЧНЫЕ координаты телепорта
            const exitX = this.exitTeleport.position.x;
            const exitY = this.exitTeleport.position.y;

            // Активируем эффект телепортации
            this.exitTeleport.activate();

            // Деактивируем телепорт
            this.exitTeleport.active = false;

            // Переходим на следующий уровень с сохранением координат
            setTimeout(() => {
                this.nextLevel(exitX, exitY);
            }, 500);

            return true;
        }

        return false;
    }

    // НОВЫЙ МЕТОД: Открытие случайного прохода
    openRandomExit() {
        const exitTypes = [EXIT_TYPES.TOP, EXIT_TYPES.BOTTOM, EXIT_TYPES.LEFT, EXIT_TYPES.RIGHT];
        this.currentExit = exitTypes[Math.floor(Math.random() * exitTypes.length)];
        this.waitingForExit = true;
        this.exitAnimationProgress = 0;

        console.log(`🚪 Открыт проход: ${this.currentExit}`);

        // Запускаем анимацию открытия
        this.animateExitOpening();
    }

    // НОВЫЙ МЕТОД: Анимация открытия прохода
    animateExitOpening() {
        const animationDuration = EXIT_ANIMATION_DURATION;
        const startTime = Date.now();

        const animate = () => {
            const elapsed = Date.now() - startTime;
            this.exitAnimationProgress = Math.min(elapsed / animationDuration, 1);

            if (this.exitAnimationProgress < 1) {
                requestAnimationFrame(animate);
            } else {
                console.log(`✅ Проход полностью открыт: ${this.currentExit}`);
            }
        };

        animate();
    }

    // НОВЫЙ МЕТОД: Определение прохода для следующего уровня
    calculateNextLevelExit() {
        if (!this.currentExit) return EXIT_TYPES.TOP; // По умолчанию сверху

        // Противоположная сторона
        const oppositeExits = {
            [EXIT_TYPES.TOP]: EXIT_TYPES.BOTTOM,
            [EXIT_TYPES.BOTTOM]: EXIT_TYPES.TOP,
            [EXIT_TYPES.LEFT]: EXIT_TYPES.RIGHT,
            [EXIT_TYPES.RIGHT]: EXIT_TYPES.LEFT
        };

        return oppositeExits[this.currentExit];
    }

    // НОВЫЙ МЕТОД: Проверка выхода игрока через проход
    checkPlayerExit() {
        if (!this.waitingForExit || !this.currentExit || this.player.isDestroyed) return false;

        const playerBounds = this.player.getBounds();
        let exited = false;

        switch (this.currentExit) {
            case EXIT_TYPES.TOP:
                exited = playerBounds.y + playerBounds.height < -10; // Небольшой зазор
                break;
            case EXIT_TYPES.BOTTOM:
                exited = playerBounds.y > CANVAS_HEIGHT + 10; // Небольшой зазор
                break;
            case EXIT_TYPES.LEFT:
                exited = playerBounds.x + playerBounds.width < -10; // Небольшой зазор
                break;
            case EXIT_TYPES.RIGHT:
                exited = playerBounds.x > CANVAS_WIDTH + 10; // Небольшой зазор
                break;
        }

        if (exited) {
            console.log(`🎯 Игрок вышел через проход: ${this.currentExit}`);
            this.nextLevelExit = this.calculateNextLevelExit();
            this.nextLevel();
            return true;
        }

        return false;
    }

    // НОВЫЙ МЕТОД: Проверка входа игрока на уровень
    checkPlayerEntry() {
        if (this.playerEnteredLevel || !this.nextLevelExit || this.player.isDestroyed) return false;

        const playerBounds = this.player.getBounds();
        let entered = false;

        switch (this.nextLevelExit) {
            case EXIT_TYPES.TOP:
                entered = playerBounds.y > TILE_SIZE;
                break;
            case EXIT_TYPES.BOTTOM:
                entered = playerBounds.y + playerBounds.height < CANVAS_HEIGHT - TILE_SIZE;
                break;
            case EXIT_TYPES.LEFT:
                entered = playerBounds.x > TILE_SIZE;
                break;
            case EXIT_TYPES.RIGHT:
                entered = playerBounds.x + playerBounds.width < CANVAS_WIDTH - TILE_SIZE;
                break;
        }

        if (entered) {
            console.log(`🎯 Игрок вошел на уровень через: ${this.nextLevelExit}`);
            this.playerEnteredLevel = true;
            this.nextLevelExit = null;

            // Закрываем проход
            this.closeExit();
        }

        return entered;
    }

    // НОВЫЙ МЕТОД: Закрытие прохода
    closeExit() {
        this.currentExit = null;
        this.waitingForExit = false;
        this.exitAnimationProgress = 0;
        console.log("🚪 Проход закрыт");
    }

    showGameOver() {
        this.showGameOverScreen = true;
        const gameOverScreen = document.getElementById('gameOver');
        document.getElementById('finalScore').textContent = this.score;
        document.getElementById('finalLevel').textContent = this.level;
        gameOverScreen.style.display = 'block';
        this.soundManager.stopLoop('engineIdle');
        this.soundManager.stopLoop('engineMoving');
    }

    // ОБНОВЛЯЕМ метод nextLevel
    nextLevel(exitX = null, exitY = null) {
        // НОВОЕ: Учет пройденного уровня
        this.recordLevelCompleted();

        // Очищаем статистику ТЕКУЩЕГО уровня перед переходом
        this.clearLevelStatsFromStorage();

        this.playerLevel = this.player.playerLevel;
        this.playerExperience = this.player.experience;
        this.savePlayerProgress();

        console.log(`➡️ Переход на уровень ${this.level + 1}`);

        // Сохраняем координаты выхода для отладки
        if (exitX !== null && exitY !== null) {
            console.log(`📍 Координаты выхода: (${exitX}, ${exitY})`);
        }

        this.level++;

        // Инициализируем уровень
        this.initLevel();

        // Создаем телепорт входа на ТОЧНОЙ позиции выхода с предыдущего уровня
        if (exitX !== null && exitY !== null) {
            this.createEntryTeleport(exitX, exitY);

            // Размещаем игрока на ТОЧНОЙ позиции телепорта
            this.placePlayerAtTeleport(exitX, exitY);
        }
    }

    // НОВЫЙ МЕТОД: Размещение игрока на позиции телепорта
    placePlayerAtTeleport(teleportX, teleportY) {
        // Просто ставим игрока на те же координаты
        this.player.position.x = teleportX;
        this.player.position.y = teleportY;

        // Даем щит на входе
        this.player.activateShield(3000);

        console.log(`🎮 Игрок размещен на позиции телепорта в (${Math.round(teleportX)}, ${Math.round(teleportY)})`);
    }

    // НОВЫЙ МЕТОД: Размещение игрока рядом с телепортом входа
    placePlayerNearEntry(entryPosition) {
        // Размещаем игрока на небольшом расстоянии от телепорта (в направлении от центра)
        const offset = 80; // Увеличим расстояние для лучшей видимости

        // Вычисляем направление от центра карты к телепорту
        const centerX = CANVAS_WIDTH / 2;
        const centerY = CANVAS_HEIGHT / 2;
        const directionX = entryPosition.x - centerX;
        const directionY = entryPosition.y - centerY;

        // Нормализуем направление
        const length = Math.sqrt(directionX * directionX + directionY * directionY);
        const normalizedX = directionX / length;
        const normalizedY = directionY / length;

        // Размещаем игрока в направлении от центра
        this.player.position.x = entryPosition.x + normalizedX * offset;
        this.player.position.y = entryPosition.y + normalizedY * offset;

        // Направляем игрока к центру карты
        this.player.direction = this.calculateDirectionToCenter(this.player.position);

        // Даем щит на входе
        this.player.activateShield(3000);

        console.log(`🎮 Игрок размещен рядом с телепортом входа в (${Math.round(this.player.position.x)}, ${Math.round(this.player.position.y)})`);
    }

    // НОВЫЙ МЕТОД: Расчет направления к центру карты
    calculateDirectionToCenter(position) {
        const centerX = CANVAS_WIDTH / 2;
        const centerY = CANVAS_HEIGHT / 2;

        const dx = centerX - position.x;
        const dy = centerY - position.y;

        // Определяем основное направление по большей компоненте
        if (Math.abs(dx) > Math.abs(dy)) {
            return dx > 0 ? DIRECTIONS.RIGHT : DIRECTIONS.LEFT;
        } else {
            return dy > 0 ? DIRECTIONS.DOWN : DIRECTIONS.UP;
        }
    }

    // НОВЫЙ МЕТОД: Размещение игрока у входа на уровень
    placePlayerAtEntry(entryExit) {
        this.playerEnteredLevel = false;

        switch (entryExit) {
            case EXIT_TYPES.TOP:
                this.player.position.x = CANVAS_WIDTH / 2;
                this.player.position.y = -this.player.size;
                this.player.direction = DIRECTIONS.DOWN;
                break;
            case EXIT_TYPES.BOTTOM:
                this.player.position.x = CANVAS_WIDTH / 2;
                this.player.position.y = CANVAS_HEIGHT + this.player.size;
                this.player.direction = DIRECTIONS.UP;
                break;
            case EXIT_TYPES.LEFT:
                this.player.position.x = -this.player.size;
                this.player.position.y = CANVAS_HEIGHT / 2;
                this.player.direction = DIRECTIONS.RIGHT;
                break;
            case EXIT_TYPES.RIGHT:
                this.player.position.x = CANVAS_WIDTH + this.player.size;
                this.player.position.y = CANVAS_HEIGHT / 2;
                this.player.direction = DIRECTIONS.LEFT;
                break;
        }

        // Даем щит на входе
        this.player.activateShield(3000);
    }

    // ОБНОВЛЯЕМ метод restartGame
    restartGame() {
        if (confirm('Начать новую игру? Весь прогресс будет сброшен.')) {
            this.resetPlayerProgress();
            this.level = 1;
            this.score = 0;
            this.lives = 3;

            // ИСПРАВЛЕНИЕ: Останавливаем только нужные звуки
            if (this.soundManager) {
                this.soundManager.stopLoop('engineIdle');
                this.soundManager.stopLoop('engineMoving');
                // Другие звуки (выстрелы, взрывы) остаются
            }

            this.initLevel();
        }
    }

    updateUI() {
        document.getElementById('score').textContent = this.score;
        document.getElementById('lives').textContent = this.lives;
        document.getElementById('level').textContent = this.level;
        document.getElementById('tanksLeft').textContent = TOTAL_ENEMIES_PER_LEVEL - this.enemiesDestroyed;
    }

    updateScreenShake() {
        if (this.screenShake > 0) {
            const intensity = this.screenShake;

            let offsetX, offsetY, rotation = 0;

            if (intensity > 30) {
                offsetX = (Math.random() - 0.5) * intensity * 2.5;
                offsetY = (Math.random() - 0.5) * intensity * 2.5;
                rotation = (Math.random() - 0.5) * intensity * 0.08;
            } else {
                offsetX = (Math.random() - 0.5) * intensity * 2.0;
                offsetY = (Math.random() - 0.5) * intensity * 2.0;
            }

            this.canvas.style.transform = `translate(${offsetX}px, ${offsetY}px) rotate(${rotation}deg)`;
            this.screenShake--;
        } else {
            this.canvas.style.transform = 'translate(0, 0) rotate(0deg)';
        }
    }

    saveOriginalBaseWalls() {
        this.originalBaseWalls = [];
        const baseX = Math.floor(this.map.width / 2);
        const baseY = this.map.height - 2;

        const wallPositions = [
            [baseX - 1, baseY - 1], [baseX - 1, baseY], [baseX - 1, baseY + 1],
            [baseX + 1, baseY - 1], [baseX + 1, baseY], [baseX + 1, baseY + 1],
            [baseX, baseY - 1], [baseX, baseY + 1]
        ];

        wallPositions.forEach(([x, y]) => {
            if (x >= 0 && x < this.map.width && y >= 0 && y < this.map.height) {
                const key = `${x},${y}`;
                const originalTile = this.map.grid[y][x];

                if (originalTile === TILE_TYPES.BRICK && this.map.brickTiles.has(key)) {
                    this.originalBaseWalls.push({
                        x: x,
                        y: y,
                        type: originalTile,
                        brickTile: this.map.brickTiles.get(key)
                    });
                } else {
                    this.originalBaseWalls.push({
                        x: x,
                        y: y,
                        type: originalTile,
                        brickTile: null
                    });
                }
            }
        });
    }

    // В Game.js ПОЛНОСТЬЮ ПЕРЕПИСЫВАЕМ систему укрепления базы:
    updateBaseFortification() {
        if (this.baseFortified) {
            // ИСПРАВЛЕНИЕ: Используем реальное время, а не игровое
            const currentTime = Date.now();

            // Если это первый вызов, устанавливаем время начала
            if (!this.baseFortifyStartTime) {
                this.baseFortifyStartTime = currentTime;
            }

            // Вычисляем прошедшее время
            const elapsedTime = currentTime - this.baseFortifyStartTime;
            const remainingTime = this.baseFortifyDuration - elapsedTime;

            // Мигание в последние 5 секунд
            if (remainingTime < 5000) {
                const blink = Math.floor(elapsedTime / 200) % 2 === 0;
                if (blink) {
                    this.temporarilyRestoreWalls();
                } else {
                    this.temporarilyUpgradeWalls();
                }
            } else {
                this.temporarilyUpgradeWalls();
            }

            // Проверяем окончание времени
            if (remainingTime <= 0) {
                this.baseFortified = false;
                this.baseFortifyStartTime = null;
                this.permanentlyRestoreWalls();
                console.log('🏰 Укрепление базы закончилось');
            }

            // Обновляем UI
            this.updateStatusIndicators();
        }
    }

    // ОБНОВЛЯЕМ метод fortifyBase:
    fortifyBase(duration) {
        if (this.baseFortified) {
            console.log('🏰 База уже укреплена, продлеваем время');
            // ИСПРАВЛЕНИЕ: Правильное продление времени
            const elapsed = Date.now() - this.baseFortifyStartTime;
            this.baseFortifyDuration = Math.max(this.baseFortifyDuration - elapsed, duration);
            this.baseFortifyStartTime = Date.now();
            return;
        }

        console.log(`🏰 Укрепляем базу на ${duration/1000}сек`);
        this.baseFortified = true;
        this.baseFortifyDuration = duration;
        this.baseFortifyStartTime = Date.now(); // Запоминаем время начала
        this.saveOriginalBaseWalls();
    }


    temporarilyRestoreWalls() {
        this.originalBaseWalls.forEach(wall => {
            if (wall.x >= 0 && wall.x < this.map.width && wall.y >= 0 && wall.y < this.map.height) {
                this.map.grid[wall.y][wall.x] = wall.type;
                if (wall.type === TILE_TYPES.BRICK && wall.brickTile) {
                    const key = `${wall.x},${wall.y}`;
                    this.map.brickTiles.set(key, wall.brickTile);
                }
            }
        });
    }

    temporarilyUpgradeWalls() {
        this.originalBaseWalls.forEach(wall => {
            if (wall.x >= 0 && wall.x < this.map.width && wall.y >= 0 && wall.y < this.map.height) {
                this.map.grid[wall.y][wall.x] = TILE_TYPES.CONCRETE;
                if (wall.type === TILE_TYPES.BRICK) {
                    const key = `${wall.x},${wall.y}`;
                    this.map.brickTiles.delete(key);
                }
            }
        });
    }

    permanentlyRestoreWalls() {
        console.log('🔧 Восстанавливаем оригинальные стены базы...');

        this.originalBaseWalls.forEach(wall => {
            if (wall.x >= 0 && wall.x < this.map.width && wall.y >= 0 && wall.y < this.map.height) {
                this.map.grid[wall.y][wall.x] = wall.type;
                if (wall.type === TILE_TYPES.BRICK && wall.brickTile) {
                    const key = `${wall.x},${wall.y}`;
                    this.map.brickTiles.set(key, wall.brickTile);
                } else if (wall.type === TILE_TYPES.BRICK && !wall.brickTile) {
                    const key = `${wall.x},${wall.y}`;
                    this.map.brickTiles.set(key, new BrickTile(wall.x, wall.y));
                }
            }
        });

        this.originalBaseWalls = [];
        console.log('🔧 Восстановление стен завершено');
    }

    // В gameLoop ИСПРАВЛЯЕМ:
    gameLoop(currentTime) {
        if (!this.lastTime) this.lastTime = currentTime;
        this.deltaTime = currentTime - this.lastTime;
        this.lastTime = currentTime;

        // Фиксированный шаг времени для стабильности
        const fixedTimeStep = 16; // 60 FPS
        let accumulatedTime = this.accumulatedTime || 0;
        accumulatedTime += this.deltaTime;

        while (accumulatedTime >= fixedTimeStep) {
            this.update();
            accumulatedTime -= fixedTimeStep;
        }
        this.accumulatedTime = accumulatedTime;

        this.render();
        requestAnimationFrame((time) => this.gameLoop(time));
    }

    render() {
        // Очистка canvas
        if (this.screenShake > 0) {
            const intensity = this.screenShake / 50;
            this.ctx.fillStyle = `rgba(255, 100, 0, ${intensity * 0.3})`;
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        } else {
            this.ctx.fillStyle = '#000';
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        }

        // СНАЧАЛА карта
        this.map.draw(this.ctx);

        // ПОТОМ защитные зоны базы (под сеткой)
        this.drawBaseProtectedZones(this.ctx);

        // ПОТОМ сетка зон ПОВЕРХ карты
        this.drawZoneGrid(this.ctx);

        // ПОТОМ подсветка зон врагов
        if (this.debugShowZoneInfo) {
            this.drawEnemyZones(this.ctx);
        }

        // ПОТОМ подсветка зоны игрока
        if (this.debugShowZoneInfo) {
            this.drawPlayerZoneHighlight(this.ctx);
        }
        this.bonusManager.bonuses.forEach(bonus => bonus.draw(this.ctx));
        this.enemyManager.spawnAnimations.forEach(animation => animation.draw(this.ctx));

        // ПОТОМ рисуем игрока и его статистику
        if (!this.player.isDestroyed) {
            this.player.draw(this.ctx);
            this.drawPlayerStats(this.ctx); // ← ДОБАВИТЬ ЭТУ СТРОКУ
        }

        this.enemyManager.enemies.forEach(enemy => enemy.draw(this.ctx));
        this.bullets.forEach(bullet => bullet.draw(this.ctx));
        this.effectManager.explosions.forEach(explosion => explosion.draw(this.ctx));
        this.effectManager.bulletExplosions.forEach(explosion => explosion.draw(this.ctx));

        // Рисуем траву
        this.map.drawGrassOverlay(this.ctx);

        // ПОТОМ рисуем телепорты ПОВЕРХ всего
        if (this.exitTeleport && this.exitTeleport.active) {
            this.exitTeleport.draw(this.ctx);
        }
        if (this.entryTeleport) {
            this.entryTeleport.draw(this.ctx);
        }

        // Остальные overlay'и
        this.renderUIOverlays();

        // Отрисовываем статистику игрока
        this.drawPlayerStats(this.ctx);

        // Дебаг информация
        if (this.debugShowVision) {
            this.drawDebugVision(this.ctx);
        }
    }

    // НОВЫЙ МЕТОД: Отрисовка открытых проходов в границах
    drawExitOpenings(ctx) {
        if (!this.waitingForExit && !this.nextLevelExit) return;

        ctx.save();

        // Проход для выхода (если есть)
        if (this.waitingForExit && this.currentExit) {
            this.drawExitOpening(ctx, this.currentExit, true);
        }

        // Проход для входа (если есть)
        if (this.nextLevelExit && !this.playerEnteredLevel) {
            this.drawExitOpening(ctx, this.nextLevelExit, false);
        }

        ctx.restore();
    }

    // НОВЫЙ МЕТОД: Отрисовка прохода в стене
    drawExitOpening(ctx, exitType, isExit) {
        const progress = isExit ? this.exitAnimationProgress : 1;
        const color = isExit ? 'rgba(76, 175, 80, 0.7)' : 'rgba(33, 150, 243, 0.7)';

        ctx.fillStyle = color;

        switch (exitType) {
            case EXIT_TYPES.TOP:
                ctx.fillRect(
                    CANVAS_WIDTH / 2 - (EXIT_WIDTH * progress) / 2,
                             0,
                             EXIT_WIDTH * progress,
                             TILE_SIZE
                );
                break;
            case EXIT_TYPES.BOTTOM:
                ctx.fillRect(
                    CANVAS_WIDTH / 2 - (EXIT_WIDTH * progress) / 2,
                             CANVAS_HEIGHT - TILE_SIZE,
                             EXIT_WIDTH * progress,
                             TILE_SIZE
                );
                break;
            case EXIT_TYPES.LEFT:
                ctx.fillRect(
                    0,
                    CANVAS_HEIGHT / 2 - (EXIT_WIDTH * progress) / 2,
                             TILE_SIZE,
                             EXIT_WIDTH * progress
                );
                break;
            case EXIT_TYPES.RIGHT:
                ctx.fillRect(
                    CANVAS_WIDTH - TILE_SIZE,
                    CANVAS_HEIGHT / 2 - (EXIT_WIDTH * progress) / 2,
                             TILE_SIZE,
                             EXIT_WIDTH * progress
                );
                break;
        }
    }

    // НОВЫЙ МЕТОД: Отрисовка прохода в стене
    drawExitOpening(ctx, exitType, isExit) {
        const progress = isExit ? this.exitAnimationProgress : 1;
        const color = isExit ? 'rgba(76, 175, 80, 0.7)' : 'rgba(33, 150, 243, 0.7)';

        ctx.fillStyle = color;

        switch (exitType) {
            case EXIT_TYPES.TOP:
                // Убираем стену сверху
                this.removeWallAtPosition(CANVAS_WIDTH / 2, 0, EXIT_WIDTH * progress, TILE_SIZE);
                ctx.fillRect(
                    CANVAS_WIDTH / 2 - (EXIT_WIDTH * progress) / 2,
                             0,
                             EXIT_WIDTH * progress,
                             TILE_SIZE
                );
                break;
            case EXIT_TYPES.BOTTOM:
                // Убираем стену снизу
                this.removeWallAtPosition(CANVAS_WIDTH / 2, CANVAS_HEIGHT - TILE_SIZE, EXIT_WIDTH * progress, TILE_SIZE);
                ctx.fillRect(
                    CANVAS_WIDTH / 2 - (EXIT_WIDTH * progress) / 2,
                             CANVAS_HEIGHT - TILE_SIZE,
                             EXIT_WIDTH * progress,
                             TILE_SIZE
                );
                break;
            case EXIT_TYPES.LEFT:
                // Убираем стену слева
                this.removeWallAtPosition(0, CANVAS_HEIGHT / 2, TILE_SIZE, EXIT_WIDTH * progress);
                ctx.fillRect(
                    0,
                    CANVAS_HEIGHT / 2 - (EXIT_WIDTH * progress) / 2,
                             TILE_SIZE,
                             EXIT_WIDTH * progress
                );
                break;
            case EXIT_TYPES.RIGHT:
                // Убираем стену справа
                this.removeWallAtPosition(CANVAS_WIDTH - TILE_SIZE, CANVAS_HEIGHT / 2, TILE_SIZE, EXIT_WIDTH * progress);
                ctx.fillRect(
                    CANVAS_WIDTH - TILE_SIZE,
                    CANVAS_HEIGHT / 2 - (EXIT_WIDTH * progress) / 2,
                             TILE_SIZE,
                             EXIT_WIDTH * progress
                );
                break;
        }
    }

    // НОВЫЙ МЕТОД: Удаление стен в области прохода
    removeWallAtPosition(x, y, width, height) {
        const startTileX = Math.floor(x / TILE_SIZE);
        const startTileY = Math.floor(y / TILE_SIZE);
        const endTileX = Math.floor((x + width) / TILE_SIZE);
        const endTileY = Math.floor((y + height) / TILE_SIZE);

        for (let tileY = startTileY; tileY <= endTileY; tileY++) {
            for (let tileX = startTileX; tileX <= endTileX; tileX++) {
                if (tileX >= 0 && tileX < this.map.width && tileY >= 0 && tileY < this.map.height) {
                    // Заменяем кирпичные и бетонные стены на пустоту в области прохода
                    if (this.map.grid[tileY][tileX] === TILE_TYPES.BRICK ||
                        this.map.grid[tileY][tileX] === TILE_TYPES.CONCRETE) {
                        this.map.grid[tileY][tileX] = TILE_TYPES.EMPTY;

                    // Удаляем из brickTiles если есть
                    const key = `${tileX},${tileY}`;
                    if (this.map.brickTiles.has(key)) {
                        this.map.brickTiles.delete(key);
                    }
                        }
                }
            }
        }
    }

    // В методе drawDebugVision УПРОЩАЕМ:
    drawDebugVision(ctx) {
        this.enemyManager.enemies.forEach(enemy => {
            if (!enemy.isDestroyed) {
                const visionRange = VISION_RANGES[enemy.enemyType] || VISION_RANGES.BASIC;

                // Рисуем зону видимости
                const gradient = ctx.createRadialGradient(
                    enemy.position.x, enemy.position.y, 0,
                    enemy.position.x, enemy.position.y, visionRange
                );
                gradient.addColorStop(0, 'rgba(255, 255, 0, 0.1)');
                gradient.addColorStop(1, 'rgba(255, 255, 0, 0.05)');

                ctx.fillStyle = gradient;
                ctx.beginPath();
                ctx.arc(enemy.position.x, enemy.position.y, visionRange, 0, Math.PI * 2);
                ctx.fill();

                // Обводка зоны
                ctx.strokeStyle = 'rgba(255, 255, 0, 0.3)';
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.arc(enemy.position.x, enemy.position.y, visionRange, 0, Math.PI * 2);
                ctx.stroke();

                // Рисуем линию к игроку если видит
                if (this.player && !this.player.isDestroyed && enemy.canSeePlayer(this.player, this.map)) {
                    // Градиентная линия
                    const lineGradient = ctx.createLinearGradient(
                        enemy.position.x, enemy.position.y,
                        this.player.position.x, this.player.position.y
                    );
                    lineGradient.addColorStop(0, 'rgba(255, 0, 0, 0.8)');
                    lineGradient.addColorStop(1, 'rgba(255, 100, 100, 0.4)');

                    ctx.strokeStyle = lineGradient;
                    ctx.lineWidth = 2;
                    ctx.beginPath();
                    ctx.moveTo(enemy.position.x, enemy.position.y);
                    ctx.lineTo(this.player.position.x, this.player.position.y);
                    ctx.stroke();
                }
            }
        });
    }

    // ЗАМЕНЯЕМ метод drawPlayerStats на новый вариант:
    drawPlayerStats(ctx) {
        if (this.player.isDestroyed || !this.playerStats) return;

        ctx.save();
        ctx.translate(this.player.position.x, this.player.position.y);

        // Собираем информацию
        const statsLines = [];

        // Всегда отображаем
        statsLines.push(`🧠 Уровень: ${this.player.playerLevel}`);
        statsLines.push(`🤖 Убито противников: ${this.playerStats.enemiesKilled}`);
        statsLines.push(`💀 Смертей: ${this.playerStats.deaths}`);

        // Только в дебаг-режиме
        if (this.debugShowVision) {
            statsLines.push(`🧱 Сломано блоков: ${this.playerStats.blocksDestroyed}`);

            // Форматируем время
            const minutes = Math.floor(this.playerStats.playTime / 60);
            const hours = Math.floor(minutes / 60);
            const displayMinutes = minutes % 60;
            const timeText = hours > 0 ? `${hours}ч ${displayMinutes}м` : `${minutes}м`;
            statsLines.push(`⏰ Сыграно времени: ${timeText}`);

            statsLines.push(`🚧 Пройдено уровней: ${this.playerStats.levelsCompleted}`);
        }

        // Вычисляем размеры блока
        const lineHeight = 14;
        const padding = 6;
        const totalHeight = statsLines.length * lineHeight + padding * 2;
        const maxWidth = this.getPlayerStatsTextWidth(ctx, statsLines) + padding * 2;

        // Позиционируем блок СЛЕВА от игрока (как у противников)
        const blockX = -this.player.size - maxWidth - 15; // Слева от игрока
        const blockY = -this.player.size - totalHeight - 10; // Выше игрока

        // Градиентный фон (синий для игрока)
        const gradient = ctx.createLinearGradient(blockX, blockY, blockX + maxWidth, blockY + totalHeight);
        gradient.addColorStop(0, 'rgba(0, 0, 0, 0.85)');
        gradient.addColorStop(1, 'rgba(70, 130, 180, 0.85)'); // Синий градиент

        ctx.fillStyle = gradient;
        ctx.fillRect(blockX, blockY, maxWidth, totalHeight);

        // Обводка
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.lineWidth = 1;
        ctx.strokeRect(blockX, blockY, maxWidth, totalHeight);

        // Отображаем строки информации с выравниванием по левому краю
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 11px Arial';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';

        statsLines.forEach((line, index) => {
            const yPos = blockY + padding + (index * lineHeight) + lineHeight/2;
            const xPos = blockX + padding;

            // Тень для лучшей читаемости
            ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
            ctx.fillText(line, xPos + 1, yPos + 1);

            // Основной текст
            ctx.fillStyle = '#FFFFFF';
            ctx.fillText(line, xPos, yPos);
        });

        // Стрелка-указатель к игроку (как у противников)
        ctx.strokeStyle = 'rgba(100, 200, 255, 0.6)'; // Голубая линия для игрока
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(blockX + maxWidth, blockY + totalHeight/2); // От правого края блока
        ctx.lineTo(-this.player.size/2, 0); // К центру игрока
        ctx.stroke();

        ctx.restore();
    }

    // Метод для получения номера зоны по координатам (только игровая область)
    getZoneId(x, y) {
        const gameArea = ZONE_SYSTEM.GAME_AREA;

        // Проверяем что координаты в игровой области
        if (x < gameArea.startX || x > gameArea.startX + gameArea.width ||
            y < gameArea.startY || y > gameArea.startY + gameArea.height) {
            return { x: -1, y: -1, id: 'out_of_bounds' };
            }

            // Вычисляем зону относительно игровой области
            const zoneX = Math.floor((x - gameArea.startX) / ZONE_SYSTEM.ZONE_SIZE);
        const zoneY = Math.floor((y - gameArea.startY) / ZONE_SYSTEM.ZONE_SIZE);

        return { x: zoneX, y: zoneY, id: `${zoneX},${zoneY}` };
    }

    // Метод для получения координат зоны (только игровая область)
    getZoneCoordinates(zoneX, zoneY) {
        const gameArea = ZONE_SYSTEM.GAME_AREA;

        return {
            x: gameArea.startX + zoneX * ZONE_SYSTEM.ZONE_SIZE,
            y: gameArea.startY + zoneY * ZONE_SYSTEM.ZONE_SIZE,
            width: ZONE_SYSTEM.ZONE_SIZE,
            height: ZONE_SYSTEM.ZONE_SIZE
        };
    }

    // Обнови метод отрисовки сетки
    drawZoneGrid(ctx) {
        if (!window.ZONE_SYSTEM.SHOW_ZONE_BORDERS && !window.ZONE_SYSTEM.SHOW_ZONE_NUMBERS) return;

        ctx.save();

        const gameArea = ZONE_SYSTEM.GAME_AREA;

        // Вычисляем количество зон в игровой области
        const zonesX = Math.ceil(gameArea.width / ZONE_SYSTEM.ZONE_SIZE);
        const zonesY = Math.ceil(gameArea.height / ZONE_SYSTEM.ZONE_SIZE);

        //console.log(`🎯 Игровая область: ${gameArea.width}x${gameArea.height}, Зоны: ${zonesX}x${zonesY}`);

        // Рисуем границы зон
        if (window.ZONE_SYSTEM.SHOW_ZONE_BORDERS) {
            ctx.strokeStyle = window.ZONE_SYSTEM.ZONE_COLOR;
            ctx.lineWidth = 2;
            ctx.setLineDash([5, 5]);

            // Вертикальные линии
            for (let x = 0; x <= zonesX; x++) {
                const lineX = gameArea.startX + x * ZONE_SYSTEM.ZONE_SIZE;
                ctx.beginPath();
                ctx.moveTo(lineX, gameArea.startY);
                ctx.lineTo(lineX, gameArea.startY + gameArea.height);
                ctx.stroke();
            }

            // Горизонтальные линии
            for (let y = 0; y <= zonesY; y++) {
                const lineY = gameArea.startY + y * ZONE_SYSTEM.ZONE_SIZE;
                ctx.beginPath();
                ctx.moveTo(gameArea.startX, lineY);
                ctx.lineTo(gameArea.startX + gameArea.width, lineY);
                ctx.stroke();
            }

            ctx.setLineDash([]);
        }

        // Рисуем номера зон
        if (window.ZONE_SYSTEM.SHOW_ZONE_NUMBERS) {
            ctx.fillStyle = window.ZONE_SYSTEM.TEXT_COLOR;
            ctx.font = 'bold 12px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';

            for (let x = 0; x < zonesX; x++) {
                for (let y = 0; y < zonesY; y++) {
                    const zoneRect = this.getZoneCoordinates(x, y);
                    const centerX = zoneRect.x + zoneRect.width / 2;
                    const centerY = zoneRect.y + zoneRect.height / 2;

                    ctx.fillText(`${x},${y}`, centerX, centerY);
                }
            }
        }

        ctx.restore();
    }

    // Метод для отображения дополнительной информации о зоне
    drawZoneInfo(ctx, zoneX, zoneY, screenX, screenY) {
        // Собираем статистику по зоне
        let enemyCount = 0;
        let playerInZone = false;

        // Проверяем врагов в зоне
        this.enemyManager.enemies.forEach(enemy => {
            if (!enemy.isDestroyed) {
                const enemyZone = this.getZoneId(enemy.position.x, enemy.position.y);
                if (enemyZone.x === zoneX && enemyZone.y === zoneY) {
                    enemyCount++;
                }
            }
        });

        // Проверяем игрока в зоне
        if (!this.player.isDestroyed) {
            const playerZone = this.getZoneId(this.player.position.x, this.player.position.y);
            playerInZone = (playerZone.x === zoneX && playerZone.y === zoneY);
        }

        // Отображаем информацию маленьким шрифтом
        ctx.font = '8px Arial';
        ctx.fillStyle = playerInZone ? '#FF4444' : '#FFFFFF';

        let infoText = '';
        if (playerInZone) infoText += 'P';
        if (enemyCount > 0) infoText += `E:${enemyCount}`;

        if (infoText) {
            ctx.fillText(infoText, screenX, screenY + 15);
        }
    }

    // Метод для подсветки текущей зоны игрока
    drawPlayerZoneHighlight(ctx) {
        const playerZone = this.getZoneId(this.player.position.x, this.player.position.y);
        const zoneRect = this.getZoneCoordinates(playerZone.x, playerZone.y);

        ctx.save();

        // Подсветка зоны игрока
        ctx.fillStyle = 'rgba(255, 0, 0, 0.3)'; // Увеличим прозрачность
        ctx.fillRect(zoneRect.x, zoneRect.y, zoneRect.width, zoneRect.height);

        // Обводка зоны игрока
        ctx.strokeStyle = 'rgba(255, 0, 0, 0.8)';
        ctx.lineWidth = 3;
        ctx.strokeRect(zoneRect.x, zoneRect.y, zoneRect.width, zoneRect.height);

        // Текст "Игрок" в зоне
        ctx.fillStyle = '#FF4444';
        ctx.font = 'bold 16px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('🎮 ИГРОК',
                     zoneRect.x + zoneRect.width / 2,
                     zoneRect.y + zoneRect.height / 2
        );

        ctx.restore();
    }

    // Метод для отображения зон с врагами
    drawEnemyZones(ctx) {
        const enemies = this.enemyManager.enemies.filter(enemy => !enemy.isDestroyed);

        enemies.forEach(enemy => {
            const enemyZone = this.getZoneId(enemy.position.x, enemy.position.y);
            const zoneRect = this.getZoneCoordinates(enemyZone.x, enemyZone.y);

            ctx.save();

            // Подсветка зоны врага
            ctx.fillStyle = 'rgba(255, 255, 0, 0.2)';
            ctx.fillRect(zoneRect.x, zoneRect.y, zoneRect.width, zoneRect.height);

            // Точка в позиции врага
            ctx.fillStyle = '#FFFF00';
            ctx.beginPath();
            ctx.arc(enemy.position.x, enemy.position.y, 5, 0, Math.PI * 2);
            ctx.fill();

            // Линия от центра зоны к врагу
            ctx.strokeStyle = 'rgba(255, 255, 0, 0.5)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(zoneRect.x + zoneRect.width / 2, zoneRect.y + zoneRect.height / 2);
            ctx.lineTo(enemy.position.x, enemy.position.y);
            ctx.stroke();

            ctx.restore();
        });
    }

    // Вспомогательный метод для вычисления ширины текста (оставляем без изменений)
    getPlayerStatsTextWidth(ctx, lines) {
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

    renderUIOverlays() {
        if (this.showGameOverScreen || this.showLevelCompleteScreen) {
            this.ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        }

        if (this.baseDestroyed) {
            this.ctx.fillStyle = 'rgba(255, 0, 0, 0.3)';
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

            this.ctx.fillStyle = '#FF4444';
            this.ctx.font = '24px Courier New';
            this.ctx.textAlign = 'center';
            this.ctx.fillText('БАЗА УНИЧТОЖЕНА!', this.canvas.width / 2, this.canvas.height / 2 - 20);
            this.ctx.font = '16px Courier New';
            this.ctx.fillText('Миссия провалена', this.canvas.width / 2, this.canvas.height / 2 + 10);
        }
    }

    // Метод для получения позиции базы в зонах
    getBaseZone() {
        if (!this.map || !this.map.basePosition) {
            return { x: 3, y: 6 }; // Центр снизу по умолчанию
        }

        const basePos = this.map.basePosition;

        // ПРЕОБРАЗУЕМ тайловые координаты в пиксельные!
        const pixelX = basePos.x * TILE_SIZE + TILE_SIZE / 2;
        const pixelY = basePos.y * TILE_SIZE + TILE_SIZE / 2;

        //console.log(`🎯 База: тайлы [${basePos.x},${basePos.y}] -> пиксели [${pixelX},${pixelY}]`);

        return this.getZoneId(pixelX, pixelY);
    }

    debugBasePosition() {
        if (!this.map) {
            console.log("❌ Карта не загружена");
            return;
        }

        console.log("🔍 Диагностика позиции базы:");
        console.log("- basePosition:", this.map.basePosition);
        console.log("- map.width:", this.map.width, "map.height:", this.map.height);

        if (this.map.basePosition) {
            const basePos = this.map.basePosition;
            const zone = this.getZoneId(basePos.x, basePos.y);
            console.log("- Координаты базы (пиксели):", basePos.x, basePos.y);
            console.log("- Координаты базы (зоны):", zone.x, zone.y);
            console.log("- Размер зоны:", ZONE_SYSTEM.ZONE_SIZE);
        } else {
            console.log("❌ basePosition не определен");

            // Попробуем найти базу вручную
            if (this.map.grid) {
                for (let y = 0; y < this.map.height; y++) {
                    for (let x = 0; x < this.map.width; x++) {
                        if (this.map.grid[y][x] === TILE_TYPES.BASE) {
                            console.log(`🎯 Нашел базу вручную: тайл [${x},${y}]`);
                            const pixelX = x * TILE_SIZE + TILE_SIZE / 2;
                            const pixelY = y * TILE_SIZE + TILE_SIZE / 2;
                            console.log("- Пиксельные координаты:", pixelX, pixelY);
                            const zone = this.getZoneId(pixelX, pixelY);
                            console.log("- Зона:", zone.x, zone.y);
                        }
                    }
                }
            }
        }
    }

    drawBaseProtectedZones(ctx) {
        if (!window.BASE_ZONE_SYSTEM.SHOW_BASE_ZONES) return;

        const baseZone = this.getBaseZone();
        const protectedRadius = window.BASE_ZONE_SYSTEM.PROTECTED_RADIUS;

        //console.log(`🎯 База в зоне: ${baseZone.x},${baseZone.y}`);

        ctx.save();

        // Рисуем защищенные зоны вокруг базы
        for (let dx = -protectedRadius; dx <= protectedRadius; dx++) {
            for (let dy = -protectedRadius; dy <= protectedRadius; dy++) {
                const zoneX = baseZone.x + dx;
                const zoneY = baseZone.y + dy;

                // Проверяем что зона в пределах игровой области
                if (zoneX >= 0 && zoneX < Math.ceil(ZONE_SYSTEM.GAME_AREA.width / ZONE_SYSTEM.ZONE_SIZE) &&
                    zoneY >= 0 && zoneY < Math.ceil(ZONE_SYSTEM.GAME_AREA.height / ZONE_SYSTEM.ZONE_SIZE)) {

                    const zoneRect = this.getZoneCoordinates(zoneX, zoneY);
                const distance = Math.max(Math.abs(dx), Math.abs(dy));

                // Полупрозрачная заливка
                if (distance === 0) {
                    ctx.fillStyle = window.BASE_ZONE_SYSTEM.CRITICAL_ZONE_COLOR;
                } else {
                    ctx.fillStyle = window.BASE_ZONE_SYSTEM.PLAYER_BASE_COLOR;
                }
                ctx.fillRect(zoneRect.x, zoneRect.y, zoneRect.width, zoneRect.height);

                // Тонкая обводка
                ctx.strokeStyle = distance === 0 ? 'rgba(255, 0, 0, 0.3)' : 'rgba(0, 255, 0, 0.2)';
                ctx.lineWidth = 1;
                ctx.strokeRect(zoneRect.x, zoneRect.y, zoneRect.width, zoneRect.height);
                    }
            }
        }

        ctx.restore();
    }

    // Метод для проверки, находится ли позиция в защищенной зоне базы
    isInBaseProtectedZone(x, y) {
        const zone = this.getZoneId(x, y);
        const baseZone = this.getBaseZone();
        const protectedRadius = BASE_ZONE_SYSTEM.PROTECTED_RADIUS;

        const distance = Math.max(
            Math.abs(zone.x - baseZone.x),
                                  Math.abs(zone.y - baseZone.y)
        );

        return distance <= protectedRadius;
    }

    // Метод для получения приоритета защиты зоны
    getZoneProtectionPriority(zoneX, zoneY) {
        const baseZone = this.getBaseZone();
        const protectedRadius = BASE_ZONE_SYSTEM.PROTECTED_RADIUS;

        const distance = Math.max(
            Math.abs(zoneX - baseZone.x),
                                  Math.abs(zoneY - baseZone.y)
        );

        if (distance > protectedRadius) return 0; // Вне защитной зоны

        // Чем ближе к базе - тем выше приоритет
        return protectedRadius - distance + 1;
    }
}
