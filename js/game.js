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

        console.log(`🎮 Загружен прогресс: уровень ${this.playerLevel}, опыт ${this.playerExperience}`);

        this.initLevel();
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

    debugAddBonus(bonusType) {
        if (this.player && this.player.isDestroyed) return;

        console.log(`🎁 Выдаем бонус: ${bonusType}`);

        switch(bonusType) {
            case 'SHIELD':
                if (this.player) this.player.activateShield();
                break;
            case 'INVINCIBILITY':
                if (this.player) this.player.activateShield(10000);
                break;
            case 'AUTO_AIM':
                if (this.player) this.player.activateAutoAim();
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

        // НОВОЕ: Обновляем дебаг информацию
        this.updateDebugInfo();

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
        this.handleInput();

        const allTanks = [this.player, ...this.enemyManager.enemies];

        if (!this.player.isDestroyed) {
            this.player.update();
        }

        // Обновляем через менеджеры
        // Обновляем врагов только если ИИ загружен
        if (typeof EnemyAI !== 'undefined') {
            this.enemyManager.update();
        }
        this.enemyManager.updateRespawns();
        this.updateBullets();
        this.effectManager.update();
        this.updateScreenShake();
        this.updateStatusIndicators();

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
        // Проверка столкновений между пулями (оптимизировано)
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

    // ОБНОВЛЯЕМ метод добавления опыта
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

                    // ДОБАВЛЯЕМ опыт игроку
                    this.player.addExperience(enemy.enemyType);

                    // СИНХРОНИЗИРУЕМ опыт с game и сохраняем
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

    handleEnemyBulletCollision(bullet, index, bulletBounds) {
        if (!this.player.isDestroyed && bulletBounds.intersects(this.player.getBounds())) {
            if (this.player.takeDamage()) {
                this.effectManager.addExplosion(this.player.position.x, this.player.position.y, 'tank');
                this.screenShake = 35;
                this.soundManager.play('tankExplosion');

                if (bullet.shooter && bullet.owner === 'enemy') {
                    this.addToLeaderboard(bullet.shooter);
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

    // НОВЫЕ МЕТОДЫ ДЛЯ ТЕСТИРОВАНИЯ
    debugTogglePanel() {
        const panel = document.getElementById('debugPanel');
        if (panel.style.display === 'none') {
            panel.style.display = 'block';
        } else {
            panel.style.display = 'none';
        }
    }

    debugAddBonus(bonusType) {
        if (this.player.isDestroyed) return;

        console.log(`🎁 Выдаем бонус: ${bonusType}`);

        switch(bonusType) {
            case 'SHIELD':
                this.player.activateShield();
                break;
            case 'INVINCIBILITY':
                this.player.activateShield(10000);
                break;
            case 'AUTO_AIM':
                this.player.activateAutoAim();
                break;
            case 'FORTIFY':
                this.fortifyBase(30000);
                break;
            case 'TIME_STOP':
                // Используем глобальную активацию
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

        if (wasMoving !== this.isPlayerMoving && this.soundManager) {
            if (this.gameOver || this.levelComplete || this.player.isDestroyed) {
                this.soundManager.stopLoop('engineIdle');
                this.soundManager.stopLoop('engineMoving');
            } else {
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

    updateStatusIndicator(indicatorId, timeElementId, isActive, remainingTime) {
        const indicator = document.getElementById(indicatorId);
        const timeElement = document.getElementById(timeElementId);

        if (isActive && !this.player.isDestroyed && !this.baseDestroyed) {
            timeElement.textContent = remainingTime.toFixed(1);
            indicator.style.display = 'block';
        } else {
            indicator.style.display = 'none';
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

    updateAutoAimIndicator() {
        const remainingTime = this.player.hasAutoAim ?
        (this.player.autoAimDuration - this.player.autoAimTimer) / 1000 : 0;
        this.updateStatusIndicator('autoaimIndicator', 'autoaimTime', this.player.hasAutoAim, remainingTime);
    }

    updateFortifyIndicator() {
        const remainingTime = this.baseFortified ?
        (this.baseFortifyDuration - this.baseFortifyTime) / 1000 : 0;
        this.updateStatusIndicator('fortifyIndicator', 'fortifyTime', this.baseFortified, remainingTime);
    }

    checkLevelCompletion() {
        if (this.enemiesDestroyed >= TOTAL_ENEMIES_PER_LEVEL &&
            this.enemyManager.enemies.length === 0 &&
            this.enemyManager.spawnAnimations.length === 0 &&
            !this.levelComplete) {

            this.levelComplete = true;
        this.showLevelCompleteScreen = true;
        this.showLevelComplete();
            }
    }

    showLevelComplete() {
        this.showLevelCompleteScreen = true;
        const levelCompleteScreen = document.getElementById('levelComplete');
        document.getElementById('destroyedTanks').textContent = this.enemiesDestroyed;
        document.getElementById('levelScore').textContent = this.score;
        levelCompleteScreen.style.display = 'block';
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
    nextLevel() {
        // СОХРАНЯЕМ прогресс из объекта игрока в game
        this.playerLevel = this.player.playerLevel;
        this.playerExperience = this.player.experience;
        this.savePlayerProgress();

        console.log(`➡️ Переход на уровень ${this.level + 1}. Прогресс: уровень ${this.playerLevel}, опыт ${this.playerExperience}`);

        this.level++;
        this.initLevel();
    }

    // ОБНОВЛЯЕМ метод restartGame
    restartGame() {
        if (confirm('Начать новую игру? Весь прогресс будет сброшен.')) {
            this.resetPlayerProgress();
            this.level = 1;
            this.score = 0;
            this.lives = 3;
            this.soundManager.stopAll();
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

    // МЕТОД УКРЕПЛЕНИЯ БАЗЫ (один экземпляр)
    fortifyBase(duration) {
        if (this.baseFortified) {
            console.log('🏰 База уже укреплена, продлеваем время');
            this.baseFortifyDuration = Math.max(this.baseFortifyDuration, duration);
            return;
        }

        console.log(`🏰 Укрепляем базу на ${duration/1000}сек`);
        this.baseFortified = true;
        this.baseFortifyTime = 0;
        this.baseFortifyDuration = duration;
        this.saveOriginalBaseWalls();
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

    updateBaseFortification() {
        if (this.baseFortified) {
            this.baseFortifyTime += this.deltaTime;

            if (this.baseFortifyDuration - this.baseFortifyTime < 5000) {
                const blink = Math.floor(this.baseFortifyTime / 200) % 2 === 0;
                if (blink) {
                    this.temporarilyRestoreWalls();
                } else {
                    this.temporarilyUpgradeWalls();
                }
            } else {
                this.temporarilyUpgradeWalls();
            }

            if (this.baseFortifyTime >= this.baseFortifyDuration) {
                this.baseFortified = false;
                this.permanentlyRestoreWalls();
                console.log('🏰 Укрепление базы закончилось');
            }
        }
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

    gameLoop(currentTime) {
        this.deltaTime = currentTime - this.lastTime;

        if (this.deltaTime >= FRAME_TIME) {
            this.lastTime = currentTime - (this.deltaTime % FRAME_TIME);
            this.update();
            this.render();
        }

        requestAnimationFrame((time) => this.gameLoop(time));
    }

    render() {
        if (this.screenShake > 0) {
            const intensity = this.screenShake / 50;
            this.ctx.fillStyle = `rgba(255, 100, 0, ${intensity * 0.3})`;
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        } else {
            this.ctx.fillStyle = '#000';
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        }

        this.map.draw(this.ctx);
        this.bonusManager.bonuses.forEach(bonus => bonus.draw(this.ctx));
        this.enemyManager.spawnAnimations.forEach(animation => animation.draw(this.ctx));

        if (!this.player.isDestroyed) {
            this.player.draw(this.ctx);
        }

        this.enemyManager.enemies.forEach(enemy => enemy.draw(this.ctx));
        this.bullets.forEach(bullet => bullet.draw(this.ctx));
        this.effectManager.explosions.forEach(explosion => explosion.draw(this.ctx));
        this.effectManager.bulletExplosions.forEach(explosion => explosion.draw(this.ctx));

        // НОВОЕ: Рисуем траву ПОСЛЕ всего (поверх танков, пуль и эффектов)
        this.map.drawGrassOverlay(this.ctx);

        this.renderUIOverlays();

        // Сохраняем оригинальный контекст
        this.ctx.save();

        if (this.screenShake > 0) {
            const intensity = this.screenShake / 50;
            this.ctx.fillStyle = `rgba(255, 100, 0, ${intensity * 0.3})`;
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        } else {
            this.ctx.fillStyle = '#000';
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        }

        this.map.draw(this.ctx);
        this.bonusManager.bonuses.forEach(bonus => bonus.draw(this.ctx));
        this.enemyManager.spawnAnimations.forEach(animation => animation.draw(this.ctx));

        if (!this.player.isDestroyed) {
            this.player.draw(this.ctx);
        }

        this.enemyManager.enemies.forEach(enemy => enemy.draw(this.ctx));
        this.bullets.forEach(bullet => bullet.draw(this.ctx));
        this.effectManager.explosions.forEach(explosion => explosion.draw(this.ctx));
        this.effectManager.bulletExplosions.forEach(explosion => explosion.draw(this.ctx));

        // НОВОЕ: Рисуем траву ПОСЛЕ всего (повторяем для второй части рендера)
        this.map.drawGrassOverlay(this.ctx);

        this.renderUIOverlays();

        // НОВОЕ: Отрисовка дебаг информации (зоны видимости и т.д.)
        if (this.debugShowVision) {
            this.drawDebugVision();
        }

        // Восстанавливаем контекст
        this.ctx.restore();
    }

    // НОВЫЙ МЕТОД: Отрисовка зон видимости врагов
    drawDebugVision() {
        this.ctx.save();

        this.enemyManager.enemies.forEach(enemy => {
            if (!enemy.isDestroyed) {
                const visionRange = VISION_RANGES[enemy.enemyType] || VISION_RANGES.BASIC;

                // Рисуем зону видимости
                this.ctx.strokeStyle = 'rgba(255, 255, 0, 0.3)';
                this.ctx.lineWidth = 1;
                this.ctx.beginPath();
                this.ctx.arc(enemy.position.x, enemy.position.y, visionRange, 0, Math.PI * 2);
                this.ctx.stroke();

                // Рисуем линию к игроку если видит
                if (this.player && !this.player.isDestroyed && enemy.canSeePlayer(this.player, this.map)) {
                    this.ctx.strokeStyle = 'rgba(255, 0, 0, 0.5)';
                    this.ctx.lineWidth = 2;
                    this.ctx.beginPath();
                    this.ctx.moveTo(enemy.position.x, enemy.position.y);
                    this.ctx.lineTo(this.player.position.x, this.player.position.y);
                    this.ctx.stroke();
                }

                // Подпись с типом ИИ
                this.ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
                this.ctx.font = '10px Arial';
                this.ctx.fillText(`AI:${enemy.aiLevel}`, enemy.position.x - 15, enemy.position.y - 10);
            }
        });

        this.ctx.restore();
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
}
