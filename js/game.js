// === ОПТИМИЗИРОВАННЫЙ КЛАСС ИГРЫ ===
class Game {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');

        // Инициализация менеджеров
        this.enemyManager = new EnemyManager(this);
        this.bonusManager = new BonusManager(this);
        this.effectManager = new EffectManager(this);

        // Дебаг-флаги
        this.debugShowVision = false;
        this.debugAILog = false;
        this.debugGodMode = false;
        this.level = 1;

        this.createDebugMenu();
        this.currentRoundEnemies = new Map();
        this.roundEnemiesList = [];
        this.totalEnemiesSpawned = 0;

        this.viewerSystem = new ViewerSystem(this);

        this.tiktokClient = null;
        this.initTikTokIntegration();

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
        this.baseDestroyed = false;
        this.keys = {};

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

        this.baseFortified = false;
        this.baseFortifyTime = 0;
        this.baseFortifyDuration = 0;
        this.originalBaseWalls = [];

        this.playerProgress = this.loadPlayerProgress();
        this.playerLevel = this.playerProgress.level;
        this.playerExperience = this.playerProgress.experience;
        this.nextLevelExp = EXP_REQUIREMENTS[this.playerLevel + 1] || 999;

        this.currentExit = null;
        this.nextLevelExit = null;
        this.exitAnimationProgress = 0;
        this.waitingForExit = false;
        this.playerEnteredLevel = false;

        this.levelLeader = null;
        this.showLevelCompleteStats = false;
        this.levelCompleteTimer = 0;

        this.playerEnteredLevel = true;
        this.levelManuallyClosed = false;
        this.levelComplete = false;
        this.showLevelCompleteScreen = false;
        this.showLevelCompleteStats = false;
        this.showGameOverScreen = false;
        this.gameOver = false;

        this.playerStats = this.loadPlayerStats();
        this.initLevel();
    }

    resetLevelState() {
        console.log('🔄 Полный сброс состояния уровня');

        // Сбрасываем флаги завершения
        this.levelComplete = false;
        this.levelManuallyClosed = false;

        // Сбрасываем счетчики врагов
        this.enemiesDestroyed = 0;
        this.enemiesToSpawn = TOTAL_ENEMIES_PER_LEVEL || 20;

        // Очищаем всех врагов
        if (this.enemyManager) {
            this.enemyManager.enemies = [];
            this.enemyManager.spawnAnimations = [];
            this.enemyManager.destroyedEnemies = 0;
            this.enemyManager.destroyedEnemiesStats = [];
        }

        // Очищаем пули
        this.bullets = [];

        // Сбрасываем систему зрителей
        if (this.viewerSystem) {
            this.viewerSystem.resetForNewRound();
        }

        // Очищаем эффекты
        if (this.effectManager) {
            this.effectManager.clear();
        }

        // Очищаем бонусы
        if (this.bonusManager) {
            this.bonusManager.clear();
        }

        console.log('✅ Состояние уровня сброшено');
    }

    // 🔥 НОВЫЕ МЕТОДЫ ДЛЯ ОБРАТНОГО ОТСЧЕТА

    startLevelCompleteCountdown() {
        console.log('⏱️ Запуск обратного отсчета для завершения уровня');

        const timerElement = document.getElementById('levelCompleteTimer');
        const countElement = timerElement ? timerElement.querySelector('.timer-count') : null;
        const progressBar = timerElement ? timerElement.querySelector('.timer-progress-bar') : null;

        if (!timerElement || !countElement || !progressBar) {
            console.error('❌ Не найдены элементы таймера для levelComplete');
            return;
        }

        // 🔥 Гарантируем что элемент видим
        timerElement.style.display = 'block';

        // Сбрасываем стили
        countElement.textContent = '5';
        countElement.style.color = '#FFD700';
        progressBar.style.width = '100%';
        progressBar.style.background = 'linear-gradient(90deg, #4CAF50, #8BC34A)';

        let countdown = 5; // 5 секунд

        // Останавливаем предыдущий таймер если есть
        if (this.levelCompleteCountdown) {
            clearInterval(this.levelCompleteCountdown);
        }

        this.levelCompleteCountdown = setInterval(() => {
            countdown--;

            // Обновляем отображение
            countElement.textContent = countdown;
            progressBar.style.width = `${(countdown / 5) * 100}%`;

            // Меняем цвет при малом времени
            if (countdown <= 2) {
                countElement.style.color = '#FF4444';
                progressBar.style.background = 'linear-gradient(90deg, #FF4444, #FF9800)';
            }

            // Когда время вышло
            if (countdown <= 0) {
                this.stopLevelCompleteCountdown();
                this.startNextLevel();
            }

        }, 1000);
    }

    stopLevelCompleteCountdown() {
        console.log('⏹️ Остановка обратного отсчета для завершения уровня');

        if (this.levelCompleteCountdown) {
            clearInterval(this.levelCompleteCountdown);
            this.levelCompleteCountdown = null;
        }

        // Скрываем таймер
        const timerElement = document.getElementById('levelCompleteTimer');
        if (timerElement) {
            timerElement.style.display = 'none';
        }
    }

    startGameOverCountdown() {
        console.log('⏱️ Запуск обратного отсчета для Game Over');

        const timerElement = document.getElementById('gameOverTimer');
        const countElement = timerElement ? timerElement.querySelector('.timer-count') : null;
        const progressBar = timerElement ? timerElement.querySelector('.timer-progress-bar') : null;

        if (!timerElement || !countElement || !progressBar) {
            console.error('❌ Не найдены элементы таймера для gameOver');
            return;
        }

        // 🔥 Гарантируем что элемент видим
        timerElement.style.display = 'block';

        // Сбрасываем стили
        countElement.textContent = '5';
        countElement.style.color = '#FFD700';
        progressBar.style.width = '100%';
        progressBar.style.background = 'linear-gradient(90deg, #F44336, #FF9800)';

        let countdown = 5; // 5 секунд

        // Останавливаем предыдущий таймер если есть
        if (this.gameOverCountdown) {
            clearInterval(this.gameOverCountdown);
        }

        this.gameOverCountdown = setInterval(() => {
            countdown--;

            // Обновляем отображение
            countElement.textContent = countdown;
            progressBar.style.width = `${(countdown / 5) * 100}%`;

            // Меняем цвет при малом времени
            if (countdown <= 2) {
                countElement.style.color = '#FF4444';
                progressBar.style.background = 'linear-gradient(90deg, #FF4444, #FF9800)';
            }

            // Когда время вышло
            if (countdown <= 0) {
                this.stopGameOverCountdown();
                this.restartGame();
            }

        }, 1000);
    }

    stopGameOverCountdown() {
        console.log('⏹️ Остановка обратного отсчета для Game Over');

        if (this.gameOverCountdown) {
            clearInterval(this.gameOverCountdown);
            this.gameOverCountdown = null;
        }

        // Скрываем таймер
        const timerElement = document.getElementById('gameOverTimer');
        if (timerElement) {
            timerElement.style.display = 'none';
        }
    }

    // 🔥 НОВЫЙ МЕТОД: Прямой переход на следующий уровень без окна статистики
    forceNextLevelSilent() {
        console.log('🚀 Прямой переход на следующий уровень (без статистики)');

        // 🔥 ВАЖНО: Сбрасываем все флаги
        this.levelManuallyClosed = false;
        this.levelComplete = false;

        // Сначала завершаем текущий уровень если нужно
        if (!this.levelComplete) {
            this.completeLevelOnClose();
        }

        // Закрываем все окна
        window.closeGameScreens();

        // Ждем немного чтобы окна успели закрыться
        setTimeout(() => {
            try {
                // Записываем текущий уровень как завершенный
                this.recordLevelCompleted();
                this.clearLevelStatsFromStorage();

                // Сохраняем прогресс игрока
                if (this.player) {
                    this.playerLevel = this.player.playerLevel;
                    this.playerExperience = this.player.experience;
                    this.savePlayerProgress();
                }

                // Увеличиваем уровень
                this.level++;

                // 🔥 ВАЖНО: Полностью переинициализируем уровень
                this.initLevel();

                console.log(`🎮 Перешел на уровень ${this.level} без показа статистики`);

                // Добавляем визуальный эффект
                if (this.effectManager) {
                    this.effectManager.addExplosion(CANVAS_WIDTH/2, CANVAS_HEIGHT/2, 'levelup');
                    this.screenShake = 15;
                }

            } catch (error) {
                console.error('❌ Ошибка при переходе на следующий уровень:', error);
            }
        }, 100);
    }

    // 🔥 ЕЩЕ ОДИН МЕТОД: Завершение текущего уровня с показом статистики (для обычной игры)
    completeCurrentLevel() {
        console.log('✅ Завершение текущего уровня со статистикой');

        // Сбрасываем флаг ручного закрытия
        this.levelManuallyClosed = false;

        // Устанавливаем флаги завершения
        this.levelComplete = true;
        this.enemiesDestroyed = this.totalEnemies || 20;
        this.enemiesToSpawn = 0;

        // Очищаем всех врагов
        if (this.enemyManager) {
            this.enemyManager.enemies = [];
            this.enemyManager.spawnAnimations = [];
        }

        // Сбрасываем данные зрителей
        if (this.viewerSystem) {
            this.viewerSystem.resetForNewRound();
        }

        // Показываем окно завершения
        this.showLevelComplete();
    }

    getActiveEnemiesCount() {
        if (!this.enemyManager || !this.enemyManager.enemies) return 0;

        // 🔥 СЧИТАЕМ ТОЛЬКО АКТИВНЫХ ВРАГОВ (НЕ огарки)
        return this.enemyManager.enemies.filter(enemy =>
        !enemy.isDestroyed || !enemy.isWreck
        ).length;
    }

    initTikTokIntegration() {
        try {
            this.tiktokClient = new TikTokClient(this);
            this.tiktokClient.connect();
            console.log('🎮 TikTok клиент инициализирован');
        } catch (error) {
            console.log('ℹ️ TikTok интеграция недоступна (сервер не запущен)');
        }
    }

    markEnemyDestroyed(enemy) {
        if (!enemy || !enemy.username) return;

        const trackedEnemy = this.currentRoundEnemies.get(enemy.username);
        if (trackedEnemy && !trackedEnemy.destroyed) {
            trackedEnemy.destroyed = true;
            trackedEnemy.destroyTime = Date.now();
            trackedEnemy.finalStats = {...enemy.levelStats};
        }

        // 🔥 ВАЖНОЕ ИСПРАВЛЕНИЕ: Добавляем трекинг для танков зрителей
        // Проверяем, был ли это танк зрителя
        if ((enemy.enemyType === 'VIEWER' || enemy.isViewerTank) && enemy.userId) {
            // Если танка зрителя еще нет в трекере, добавляем
            if (!this.currentRoundEnemies.has(enemy.username)) {
                this.currentRoundEnemies.set(enemy.username, {
                    enemy: enemy,
                    spawnTime: Date.now() - 30000, // Примерное время спавна
                                             destroyed: true,
                                             destroyTime: Date.now(),
                                             finalStats: enemy.levelStats || {
                                                 shots: enemy.levelStats?.shots || 0,
                                                 wallsDestroyed: enemy.levelStats?.wallsDestroyed || 0,
                                                 playerKills: enemy.levelStats?.playerKills || 0,
                                                 baseDestroyed: enemy.levelStats?.baseDestroyed || false,
                                                 totalScore: enemy.levelStats?.totalScore || 0
                                             }
                });
            }
        }
    }

    getAllRoundEnemies() {
        const enemies = [];

        // 1. Сначала добавляем всех отслеживаемых врагов
        this.currentRoundEnemies.forEach((trackedEnemy, username) => {
            let finalStats;
            if (trackedEnemy.finalStats) {
                finalStats = trackedEnemy.finalStats;
            } else if (trackedEnemy.enemy && trackedEnemy.enemy.levelStats) {
                finalStats = trackedEnemy.enemy.levelStats;
            } else {
                finalStats = {
                    shots: 0,
                    wallsDestroyed: 0,
                    playerKills: 0,
                    baseDestroyed: false,
                    totalScore: 0
                };
            }

            enemies.push({
                username: username,
                enemyType: trackedEnemy.enemy?.enemyType || 'BASIC',
                isViewerTank: trackedEnemy.enemy?.isViewerTank || trackedEnemy.enemy?.enemyType === 'VIEWER',
                stats: finalStats,
                spawnTime: trackedEnemy.spawnTime,
                destroyed: trackedEnemy.destroyed || false,
                destroyTime: trackedEnemy.destroyTime
            });
        });

        // 2. Добавляем танки зрителей, которые могли быть пропущены
        // (например, уничтоженные до добавления в трекер)
        if (this.viewerSystem && this.viewerSystem.viewerTanks) {
            this.viewerSystem.viewerTanks.forEach(viewerTank => {
                if (!viewerTank || !viewerTank.username) return;

                // Проверяем, не добавлен ли уже этот танк
                const alreadyAdded = enemies.some(e => e.username === viewerTank.username);
                if (!alreadyAdded) {
                    enemies.push({
                        username: viewerTank.username,
                        enemyType: 'VIEWER',
                        isViewerTank: true,
                        stats: viewerTank.levelStats || {
                            shots: 0,
                            wallsDestroyed: 0,
                            playerKills: 0,
                            baseDestroyed: false,
                            totalScore: 0
                        },
                        spawnTime: Date.now() - 60000, // Примерное время
                                 destroyed: viewerTank.isDestroyed || false,
                                 destroyTime: viewerTank.isDestroyed ? Date.now() : null
                    });
                }
            });
        }

        return enemies;
    }

    clearRoundTracker() {
        this.currentRoundEnemies.clear();
        this.roundEnemiesList = [];
        this.totalEnemiesSpawned = 0;
    }

    updateInfrequentSystems() {
        const now = Date.now();
        if (now - this.lastVisionCheck > 500) {
            this.lastVisionCheck = now;
            this.updateEnemyVisionChecks();
        }
        if (now - this.lastAICheck > 300) {
            this.lastAICheck = now;
            this.updateEnemyAI();
        }
    }

    updateEnemyVisionChecks() {
        if (!this.player || this.player.isDestroyed) return;
        const enemies = this.enemyManager.enemies;
        const maxChecks = Math.min(enemies.length, 3);

        for (let i = 0; i < maxChecks; i++) {
            const enemy = enemies[i];
            if (enemy && !enemy.isDestroyed && enemy.ai) {
                const distance = Math.sqrt(
                    Math.pow(enemy.position.x - this.player.position.x, 2) +
                    Math.pow(enemy.position.y - this.player.position.y, 2)
                );
                const visionRange = VISION_RANGES[enemy.enemyType] || 200;
                if (distance <= visionRange) enemy.canSeePlayer(this.player, this.map);
            }
        }
    }

    updateEnemyAI() {
        const enemies = this.enemyManager.enemies;
        if (enemies.length === 0) return;
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

    loadPlayerStats() {
        try {
            const savedStats = localStorage.getItem('tankGame_playerStats');
            if (savedStats) return JSON.parse(savedStats);
        } catch (error) {
            console.error('Ошибка загрузки статистики:', error);
        }
        return { level: 1, enemiesKilled: 0, deaths: 0, blocksDestroyed: 0, playTime: 0, levelsCompleted: 0, startTime: Date.now() };
    }

    savePlayerStats() {
        try {
            if (this.playerStats.startTime) {
                this.playerStats.playTime = Math.floor((Date.now() - this.playerStats.startTime) / 1000);
            }
            localStorage.setItem('tankGame_playerStats', JSON.stringify(this.playerStats));
        } catch (error) {
            console.error('Ошибка сохранения статистики:', error);
        }
    }

    resetPlayerStats() {
        this.playerStats = { level: 1, enemiesKilled: 0, deaths: 0, blocksDestroyed: 0, playTime: 0, levelsCompleted: 0, startTime: Date.now() };
        this.savePlayerStats();
    }

    recordEnemyKill() { this.playerStats.enemiesKilled++; this.savePlayerStats(); }
    recordPlayerDeath() { this.playerStats.deaths++; this.savePlayerStats(); }
    recordBlockDestroyed(count = 1) { this.playerStats.blocksDestroyed += count; this.savePlayerStats(); }
    recordLevelCompleted() { this.playerStats.levelsCompleted++; this.savePlayerStats(); }
    updatePlayerLevel(newLevel) { this.playerStats.level = newLevel; this.savePlayerStats(); }

    createDebugMenu() {
        const existingMenu = document.getElementById('debugMenu');
        if (existingMenu) existingMenu.remove();

        const debugMenu = document.createElement('div');
        debugMenu.id = 'debugMenu';
        debugMenu.style.cssText = `
        position: fixed; top: 10px; left: 10px; background: rgba(0,0,0,0.9); color: white;
        padding: 15px; border-radius: 10px; border: 2px solid #4CAF50; font-family: 'Courier New', monospace;
        font-size: 12px; z-index: 1000; min-width: 250px; max-height: 80vh; overflow-y: auto;
        `;

        debugMenu.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
        <h3 style="margin: 0; color: #4CAF50;">🎮 Дебаг Меню</h3>
        <button id="debugToggleMenu" style="background: #ff4444; color: white; border: none; border-radius: 3px; padding: 2px 6px; cursor: pointer;">✕</button>
        </div>
        <div style="margin-bottom: 10px;">
        <label style="display: block; margin-bottom: 5px; font-weight: bold;">Уровень игры:</label>
        <select id="debugLevelSelect" style="width: 100%; padding: 5px; background: #333; color: white; border: 1px solid #4CAF50;">
        ${Array.from({length: 10}, (_, i) => `<option value="${i+1}">${i+1} - ${i < 4 ? 'Базовый ИИ' : 'Продвинутый ИИ'}</option>`).join('')}
        </select>
        </div>
        <div style="margin-bottom: 10px;">
        <button id="debugApplyLevel" style="width: 100%; padding: 8px; background: #4CAF50; color: white; border: none; border-radius: 5px; cursor: pointer; margin-bottom: 5px;">Применить уровень</button>
        <button id="debugSpawnEnemy" style="width: 100%; padding: 8px; background: #2196F3; color: white; border: none; border-radius: 5px; cursor: pointer;">Заспавнить врага</button>
        </div>

        <!-- УПРАВЛЕНИЕ ИГРОЙ - ИСПРАВЛЕННЫЕ КНОПКИ -->
        <div style="margin-bottom: 10px; border-top: 1px solid #444; padding-top: 10px;">
        <h4 style="margin: 0 0 8px 0; color: #FF9800;">Управление игрой:</h4>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 5px;">
        <button onclick="restartGameFromDebug(); event.stopPropagation(); return false;" style="padding: 8px; background: #F44336; color: white; border: none; border-radius: 5px; cursor: pointer; font-weight: bold;">🔄 Начать заново</button>
        <button onclick="goToNextLevelFromDebug(); event.stopPropagation(); return false;" style="padding: 8px; background: #4CAF50; color: white; border: none; border-radius: 5px; cursor: pointer; font-weight: bold;">🚀 Следующий уровень</button>
        <button onclick="completeLevelWithStats(); event.stopPropagation(); return false;" style="padding: 8px; background: #2196F3; color: white; border: none; border-radius: 5px; cursor: pointer; font-weight: bold; margin-top: 5px;">📊 Завершить уровень (со статистикой)</button>
        </div>
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
        <div style="margin-bottom: 5px;"><label><input type="checkbox" id="debugShowVision" style="margin-right: 5px;">Показывать зону видимости</label></div>
        <div style="margin-bottom: 5px;"><label><input type="checkbox" id="debugShowAILog" style="margin-right: 5px;">Лог ИИ в консоль</label></div>
        <div style="margin-bottom: 5px;"><label><input type="checkbox" id="debugGodMode" style="margin-right: 5px;">Режим бога</label></div>
        <div style="margin-bottom: 5px;"><label><input type="checkbox" id="debugShowZoneBorders" style="margin-right: 5px;">Границы зон</label></div>
        <div style="margin-bottom: 5px;"><label><input type="checkbox" id="debugShowZoneNumbers" style="margin-right: 5px;">Номера зон</label></div>
        <div style="margin-bottom: 5px;"><label><input type="checkbox" id="debugShowZoneInfo" style="margin-right: 5px;">Инфо о зонах</label></div>
        <div style="margin-bottom: 5px;"><label><input type="checkbox" id="debugShowBaseZones" style="margin-right: 5px;">Зоны базы игрока</label></div>
        <div style="margin-bottom: 5px;"><label><input type="checkbox" id="debugShowMemory" style="margin-right: 5px;">Показывать память пути ИИ</label></div>
        </div>
        <div style="margin-bottom: 10px; border-top: 1px solid #444; padding-top: 10px;">
        <h4 style="margin: 0 0 8px 0; color: #FF9800;">Статистика:</h4>
        <button id="debugResetStats" style="width: 100%; padding: 8px; background: #FF5722; color: white; border: none; border-radius: 5px; cursor: pointer; margin-bottom: 5px;">🗑️ Сбросить статистику</button>
        <div style="font-size: 10px; color: #888; text-align: center;">Убийств: <span id="debugKills">0</span> | Смертей: <span id="debugDeaths">0</span> | Уровней: <span id="debugLevels">0</span></div>
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
        this.setupDebugEventListeners();
    }

    closeLevelStats() {
        console.log('closeLevelStats вызван');

        // Просто вызываем глобальную функцию
        window.closeGameScreens();

        // Сбрасываем состояние
        this.showLevelCompleteStats = false;
        this.showLevelCompleteScreen = false;
        this.showGameOverScreen = false;
    }

    setupDebugEventListeners() {
        document.getElementById('debugApplyLevel').addEventListener('click', () => {
            const selectedLevel = parseInt(document.getElementById('debugLevelSelect').value);
            this.setGameLevel(selectedLevel);
        });

        document.getElementById('debugSpawnEnemy').addEventListener('click', () => this.debugSpawnTestEnemy());
        document.getElementById('debugShowVision').addEventListener('change', (e) => this.debugShowVision = e.target.checked);
        document.getElementById('debugShowAILog').addEventListener('change', (e) => this.debugAILog = e.target.checked);
        document.getElementById('debugGodMode').addEventListener('change', (e) => {
            this.debugGodMode = e.target.checked;
            if (this.debugGodMode && this.player) this.player.activateShield(999999);
        });

            document.getElementById('debugAddLife').addEventListener('click', () => this.debugAddLife());
            document.getElementById('debugToggleMenu').addEventListener('click', () => {
                const menu = document.getElementById('debugMenu');
                menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
            });

            document.querySelectorAll('.debugBonusBtn').forEach(btn => {
                btn.addEventListener('click', (e) => this.debugAddBonus(e.target.dataset.bonus));
            });

            document.getElementById('debugResetStats').addEventListener('click', () => {
                if (confirm('Точно сбросить всю статистику?')) this.resetPlayerStats();
            });

                document.getElementById('debugShowZoneBorders').addEventListener('change', (e) => ZONE_SYSTEM.SHOW_ZONE_BORDERS = e.target.checked);
                document.getElementById('debugShowZoneNumbers').addEventListener('change', (e) => ZONE_SYSTEM.SHOW_ZONE_NUMBERS = e.target.checked);
                document.getElementById('debugShowZoneInfo').addEventListener('change', (e) => this.debugShowZoneInfo = e.target.checked);
                document.getElementById('debugShowBaseZones').addEventListener('change', (e) => window.BASE_ZONE_SYSTEM.SHOW_BASE_ZONES = e.target.checked);
                document.getElementById('debugShowMemory').addEventListener('change', (e) => {
                    if (this.enemyManager && this.enemyManager.enemies) {
                        this.enemyManager.enemies.forEach(enemy => {
                            if (enemy.ai) enemy.ai.debugShowMemory = e.target.checked;
                        });
                    }
                });
    }

    setGameLevel(targetLevel) {
        this.level = targetLevel;
        this.initLevel();
    }

    debugSpawnTestEnemy() {
        const spawnPoint = this.enemyManager.getNextSpawnPoint();
        this.enemyManager.spawnAnimations.push(new SpawnAnimation(spawnPoint.x, spawnPoint.y));
    }

    debugAddBonus(bonusType) {
        if (this.player.isDestroyed) return;
        switch(bonusType) {
            case 'SHIELD': this.player.activateShield(5000); break;
            case 'INVINCIBILITY': this.player.activateShield(10000); break;
            case 'AUTO_AIM': this.player.activateAutoAim(15000); break;
            case 'FORTIFY': this.fortifyBase(30000); break;
            case 'TIME_STOP':
                // Если стоп-время уже активно - размораживаем
                if (this.timeStopActive) {
                    this.deactivateTimeStop();
                    console.log('⏰ Стоп-время отменено');
                } else {
                    // Иначе замораживаем
                    this.activateTimeStop(999000); // 999 секунд
                }
                break;
        }
        this.updateStatusIndicators();
    }

    deactivateTimeStop() {
        if (!this.timeStopActive) return;

        console.log('🔥 Размораживаю время...');

        // 1. Размораживаем всех врагов
        this.enemyManager.enemies.forEach(enemy => {
            if (enemy.isFrozen) {
                enemy.isFrozen = false;
                enemy.speed = enemy.originalSpeed || 2;
                enemy.canShoot = enemy.originalCanShoot || true;

                // Очищаем таймеры заморозки
                delete enemy.freezeStartTime;
                delete enemy.freezeDuration;

                // Эффект разморозки
                if (this.effectManager) {
                    this.effectManager.addExplosion(
                        enemy.position.x,
                        enemy.position.y,
                        'unfreeze'
                    );
                }
            }
        });

        // 3. Останавливаем звуки стоп-времени
        if (this.soundManager) {
            this.soundManager.stopTimeStop();
            // Дополнительный звук разморозки
            this.soundManager.play('timeResume');
        }

        // 4. Сбрасываем состояние
        this.timeStopActive = false;
        this.timeStopStartTime = 0;
        this.timeResumePlayed = false;

        // 5. Визуальный эффект разморозки на весь экран
        this.screenShake = 15;

        console.log('✅ Время восстановлено!');
    }

    debugAddLife() {
        this.lives++;
        this.updateUI();
    }

    loadPlayerProgress() {
        try {
            const savedProgress = localStorage.getItem('tankGame_playerProgress');
            if (savedProgress) {
                const progress = JSON.parse(savedProgress);
                return { level: progress.level || 1, experience: progress.experience || 0 };
            }
        } catch (error) {
            console.error('Ошибка загрузки прогресса:', error);
        }
        return { level: 1, experience: 0 };
    }

    savePlayerProgress() {
        try {
            const progress = { level: this.playerLevel, experience: this.playerExperience, timestamp: Date.now() };
            localStorage.setItem('tankGame_playerProgress', JSON.stringify(progress));
        } catch (error) {
            console.error('Ошибка сохранения прогресса:', error);
        }
    }

    resetPlayerProgress() {
        this.playerLevel = 1;
        this.playerExperience = 0;
        this.nextLevelExp = EXP_REQUIREMENTS[2];
        if (this.player) {
            this.player.playerLevel = 1;
            this.player.experience = 0;
            this.player.upgradeToLevel(1);
        }
        localStorage.removeItem('tankGame_playerProgress');
        this.updatePlayerStats();
    }

    initLevel() {
        console.log(`🎮 Инициализация уровня ${this.level}`);

        // 🔥 ВАЖНО: Полный сброс всех флагов состояния
        this.levelComplete = false;
        this.levelManuallyClosed = false;
        this.gameOver = false;
        this.baseDestroyed = false;
        this.showGameOverScreen = false;
        this.showLevelCompleteScreen = false;
        this.showLevelCompleteStats = false;

        // Сбрасываем счетчики
        this.enemiesDestroyed = 0;
        this.enemiesToSpawn = TOTAL_ENEMIES_PER_LEVEL || 20;

        // Инициализируем карту
        this.map = new GameMap(this.level);

        // Создаем игрока
        this.player = new Tank(224, 750);
        this.destroyedViewerTanks = new Set();

        // 🔥 ВАЖНО: Очищаем только живых врагов, огарки остаются
        // (но они будут удалены при превышении лимита)
        const aliveEnemies = this.enemyManager.enemies.filter(enemy =>
        !enemy.isWreck || !enemy.isDestroyed
        );

        // Если огарков слишком много (больше 20), удаляем самые старые
        if (aliveEnemies.length < this.enemyManager.enemies.length) {
            const wrecks = this.enemyManager.enemies.filter(enemy =>
            enemy.isWreck && enemy.isDestroyed
            );

            if (wrecks.length > 20) {
                // Удаляем самые старые огарки (можно отслеживать по timer)
                wrecks.sort((a, b) => (a.wreckTimer || 0) - (b.wreckTimer || 0));
                const toRemove = wrecks.slice(20); // Оставляем 20 самых свежих

                toRemove.forEach(wreck => {
                    const index = this.enemyManager.enemies.indexOf(wreck);
                    if (index !== -1) {
                        this.enemyManager.enemies.splice(index, 1);
                    }
                });

                console.log(`🗑️ Удалено ${toRemove.length} старых огарков`);
            }
        }

        if (this.playerLevel > 1) {
            this.player.playerLevel = this.playerLevel;
            this.player.experience = this.playerExperience;
            this.player.upgrade = PLAYER_UPGRADES[`LEVEL_${this.playerLevel}`];
            this.player.speed = this.player.upgrade.speed;
            this.player.color = this.player.upgrade.color;
            this.player.bulletSpeed = this.player.upgrade.bulletSpeed;
            this.player.reloadTime = this.player.upgrade.reloadTime;
            this.player.bulletPower = this.player.upgrade.bulletPower;
            this.player.canDestroyConcrete = this.player.upgrade.canDestroyConcrete;
            this.player.health = this.player.upgrade.health;
        }

        this.exitTeleport = null;
        this.entryTeleport = null;

        if (this.enemyManager) this.enemyManager.clearStats();
        // Очищаем все системы
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
        this.levelLeader = null;

        // 🔥 ВАЖНО: Сбрасываем счетчики в EnemyManager
        if (this.enemyManager) {
            this.enemyManager.destroyedEnemies = 0;
            this.enemyManager.destroyedEnemiesStats = [];
        }

        // Сбрасываем стоп-время
        this.timeStopActive = false;
        this.timeStopStartTime = 0;
        this.timeStopDuration = 12000;
        this.timeResumePlayed = false;

        // Обновляем UI
        this.updateUI();
        //this.updateStatusIndicators();

        if (this.soundManager) {
            this.soundManager.updateEngineSound(false, true);
        }

        this.updatePlayerStats();

        // Скрываем все окна
        document.getElementById('levelComplete').style.display = 'none';
        document.getElementById('gameOver').style.display = 'none';

        // Очищаем трекер раунда
        this.clearRoundTracker();

        console.log(`✅ Уровень ${this.level} инициализирован`);
    }

    activateTimeStop(duration = null) {
        // Используем переданную длительность или дефолтную
        const freezeDuration = duration !== null ? duration : this.timeStopDuration;

        if (this.timeStopActive) {
            this.timeResumePlayed = false;
            const newEndTime = Date.now() + freezeDuration;

            // Замораживаем существующих врагов
            this.enemyManager.enemies.forEach(enemy => {
                if (enemy.isFrozen) {
                    // Продлеваем заморозку существующим врагам
                    enemy.freezeDuration = freezeDuration;
                    enemy.freezeStartTime = Date.now();
                } else {
                    // Замораживаем новых врагов
                    enemy.freeze(freezeDuration);
                }
            });

            // Замораживаем анимации спавна
            this.enemyManager.spawnAnimations.forEach(animation => {
                if (!animation.isFrozen) {
                    animation.freeze(freezeDuration);
                }
            });

            this.timeStopStartTime = Date.now();
            return;
        }

        this.timeStopActive = true;
        this.timeStopStartTime = Date.now();
        this.timeStopDuration = freezeDuration; // Сохраняем текущую длительность
        this.timeResumePlayed = false;

        // Замораживаем всех врагов
        this.enemyManager.enemies.forEach(enemy => enemy.freeze(freezeDuration));

        // Замораживаем анимации спавна
        this.enemyManager.spawnAnimations.forEach(animation => {
            animation.freeze(freezeDuration);
        });

        if (this.soundManager) this.soundManager.playTimeStop();

        console.log(`⏰ Стоп-время активировано на ${freezeDuration / 1000} секунд`);
    }

    update() {
        this.frameCount = this.frameCount || 0;
        if (this.frameCount % 2 === 0) this.updateInfrequentSystems();
        this.frameCount++;

        this.handleInput();

        if (this.levelComplete && this.soundManager && !this.isPlayerMoving) {
            this.soundManager.stopLoop('engineMoving');
        }

        const allTanks = [this.player, ...this.enemyManager.enemies];
        const fixedDelta = 16;

        if (!this.player.isDestroyed) this.player.update();

        if ((this.playerEnteredLevel || this.level === 1) && !this.levelComplete) {
            if (typeof EnemyAI !== 'undefined') this.enemyManager.update();
            this.enemyManager.updateRespawns();
        }

        if (typeof EnemyAI !== 'undefined') this.enemyManager.update();
        this.updateBullets();
        this.effectManager.update();
        this.updateScreenShake();
        this.updateStatusIndicators();

        if (this.playerEnteredLevel) {
            this.updateBaseFortification();
            this.bonusManager.update();
            this.map.update(allTanks);

            // 🔥 ПРОВЕРЯЕМ ЗАВЕРШЕНИЕ ТОЛЬКО ЕСЛИ НЕ БЫЛО РУЧНОГО ЗАКРЫТИЯ
            if (!this.levelManuallyClosed) {
                this.checkLevelCompletion();
            }
        }

        // Обновляем систему зрителей
        this.viewerSystem.update();

        // Обновляем всплывающие тексты
        if (this.floatingTexts) {
            for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
                const text = this.floatingTexts[i];
                text.lifetime--;

                // Плавное исчезание
                text.alpha = Math.max(0, text.lifetime / 60);

                // Добавляем легкое раскачивание
                if (!text.startX) text.startX = text.x; // Сохраняем начальную позицию
                const swing = Math.sin(Date.now() * 0.01 + i) * 2; // Легкое раскачивание

                text.x = text.startX + swing;
                text.y -= 1; // Медленное поднятие

                // Увеличиваем шрифт в начале и уменьшаем в конце
                if (!text.originalSize) text.originalSize = 16;
                const sizeProgress = Math.sin((text.lifetime / 120) * Math.PI);
                text.fontSize = text.originalSize * (0.8 + sizeProgress * 0.2);

                if (text.lifetime <= 0) {
                    this.floatingTexts.splice(i, 1);
                }
            }
        }

        // 🔥 ОБРАБОТКА ОТЛОЖЕННЫХ СПАВНОВ ПРИ ЗАВЕРШЕНИИ СТОП-ВРЕМЕНИ
        if (this.timeStopActive) {
            const elapsed = Date.now() - this.timeStopStartTime;
            const remaining = this.timeStopDuration - elapsed;

            if (remaining <= 1000 && !this.timeResumePlayed && this.soundManager) {
                this.soundManager.play('timeResume');
                this.timeResumePlayed = true;
            }

            if (remaining <= 0) {
                this.timeStopActive = false;
                // 🔥 ВАЖНО: РАЗМОРАЖИВАЕМ ВСЕХ ВРАГОВ ПРИ ЗАВЕРШЕНИИ
                this.enemyManager.enemies.forEach(enemy => {
                    if (enemy.isFrozen) {
                        enemy.isFrozen = false;
                        enemy.speed = enemy.originalSpeed;
                        enemy.canShoot = enemy.originalCanShoot;
                    }
                });

                if (this.soundManager) this.soundManager.stopTimeStop();
            }
        }

        // РАЗМОРАЖИВАЕМ ИГРОКА ПРИ СМЕРТИ
        if (this.player.isDestroyed && this.viewerSystem.playerFrozen) {
            this.viewerSystem.unfreezeOnDeath();
        }

        // 🔥 ОБНОВЛЯЕМ ОГАРКИ
        this.updateWrecks();

        // 🔥 ПРОВЕРЯЕМ НАВЕДЕНИЕ МЫШКИ
        if (this.mousePosition) {
            let anyHovered = false;

            this.enemyManager.enemies.forEach(enemy => {
                if (enemy.isWreck && enemy.isDestroyed) {
                    const hovered = enemy.handleWreckHover(
                        this.mousePosition.x,
                        this.mousePosition.y
                    );
                    if (hovered) anyHovered = true;
                }
            });

            // Меняем курсор
            this.canvas.style.cursor = anyHovered ? 'pointer' : 'default';
        }
    }

    // 🔥 ОБНОВЛЕНИЕ ВСЕХ ОГАРКОВ
    updateWrecks() {
        this.enemyManager.enemies.forEach(enemy => {
            if (enemy.isWreck && enemy.updateWreckState) {
                enemy.updateWreckState();
            }
        });
    }

    // 🔥 ПРОВЕРКА НАВЕДЕНИЯ МЫШКИ НА ВСЕ ОГАРКИ
    checkAllWreckHovers(mouseX, mouseY) {
        let anyHovered = false;

        // Проверяем всех врагов
        this.enemyManager.enemies.forEach(enemy => {
            if (enemy.isWreck && enemy.isDestroyed && enemy.checkInfoBlockHover) {
                const hovered = enemy.checkInfoBlockHover(mouseX, mouseY);
                if (hovered) anyHovered = true;
            }
        });

        // Меняем курсор при наведении
        this.canvas.style.cursor = anyHovered ? 'pointer' : 'default';
    }

    updateBullets() {
        // ВСЕГДА проверяем столкновения пуль (не только когда >10)
        this.checkBulletCollisions();

        for (let i = this.bullets.length - 1; i >= 0; i--) {
            const bullet = this.bullets[i];
            bullet.deltaTime = this.deltaTime;
            bullet.update();
            if (!this.processBulletCollisions(bullet, i)) continue;
        }
    }

    checkBulletCollisions() {
        // Проверяем все пули на столкновения друг с другом
        for (let i = this.bullets.length - 1; i >= 0; i--) {
            const bullet1 = this.bullets[i];
            if (!bullet1 || !bullet1.active) continue;

            for (let j = this.bullets.length - 1; j > i; j--) {
                const bullet2 = this.bullets[j];
                if (!bullet2 || !bullet2.active) continue;

                const bounds1 = bullet1.getBounds();
                const bounds2 = bullet2.getBounds();

                const collision = bounds1.intersects(bounds2);

                if (collision) {
                    // ★★★ РАЗНЫЕ ТИПЫ СТОЛКНОВЕНИЙ ★★★
                    if (bullet1.owner !== bullet2.owner) {
                        // 1. Пули разных владельцев (игрок/враг) - обычное столкновение
                        console.log('💥 СТОЛКНОВЕНИЕ РАЗНЫХ ПУЛЬ!');
                        this.handleBulletCollision(bullet1, bullet2, 'enemy_vs_player');

                    } else if (bullet1.owner === 'enemy' && bullet2.owner === 'enemy') {
                        // 2. Вражеские пули между собой - уничтожаются без урона
                        this.handleBulletCollision(bullet1, bullet2, 'enemy_vs_enemy');

                    } else if (bullet1.owner === 'player' && bullet2.owner === 'player') {
                        // 3. Пули игрока между собой (если будет многопользовательская игра)
                        console.log('👥 ПУЛИ ИГРОКА СТОЛКНУЛИСЬ!');
                        this.handleBulletCollision(bullet1, bullet2, 'player_vs_player');
                    }

                    // Удаляем обе пули из массива
                    this.bullets.splice(j, 1);
                    this.bullets.splice(i, 1);

                    break;
                }
            }
        }
    }

    // ★★★ НОВЫЙ МЕТОД: ОБРАБОТКА РАЗНЫХ ТИПОВ СТОЛКНОВЕНИЙ ★★★
    handleBulletCollision(bullet1, bullet2, collisionType) {
        // Визуальный эффект в центре столкновения
        const centerX = (bullet1.position.x + bullet2.position.x) / 2;
        const centerY = (bullet1.position.y + bullet2.position.y) / 2;

        // Разные эффекты для разных типов столкновений
        switch(collisionType) {
            case 'enemy_vs_player':
                // Мощный эффект для столкновения вражеской и игровой пули
                this.effectManager.addBulletExplosion(centerX, centerY, 'powerful');
                this.playBulletCollisionSound(bullet1, bullet2, 'powerful');
                break;

            case 'enemy_vs_enemy':
                // Более слабый эффект для вражеских пуль между собой
                this.effectManager.addBulletExplosion(centerX, centerY, 'weak');

                // Звук мягкого столкновения
                if (this.soundManager) {
                    this.soundManager.play('bulletHit');

                    // Тихий дополнительный звук для эффекта
                    setTimeout(() => {
                        this.soundManager.play('brickHit');
                    }, 50);
                }
                break;

            case 'player_vs_player':
                // Нейтральный эффект
                this.effectManager.addBulletExplosion(centerX, centerY, 'neutral');
                this.playBulletCollisionSound(bullet1, bullet2, 'neutral');
                break;
        }

        // Деактивируем пули
        bullet1.active = false;
        bullet2.active = false;
    }

    // ★★★ ОБНОВЛЕННЫЙ МЕТОД ДЛЯ ЗВУКОВ ★★★
    playBulletCollisionSound(bullet1, bullet2, type = 'normal') {
        if (!this.soundManager) return;

        switch(type) {
            case 'powerful':
                // Мощное столкновение (разные владельцы)
                this.soundManager.play('bulletCollision');
                setTimeout(() => this.soundManager.play('brickDestroy'), 30);
                break;

            case 'weak':
                // Слабое столкновение (вражеские пули между собой)
                this.soundManager.play('bulletHit');

                // Тише и короче
                try {
                    const sound = this.soundManager.sounds.get('bulletHit');
                    if (sound) {
                        const clone = sound.cloneNode();
                        clone.volume = 0.3;
                        clone.playbackRate = 1.2; // Быстрее
                        clone.play().catch(() => {});
                    }
                } catch (e) {
                    // Фолбэк
                    this.soundManager.play('bulletHit');
                }
                break;

            default:
                // Обычное столкновение
                this.soundManager.play('bulletCollision');
        }
    }

    processBulletCollisions(bullet, index) {
        const destructionResult = this.map.checkBulletCollision(bullet);
        if (destructionResult) return this.handleBulletMapCollision(bullet, index, destructionResult);

        const bulletBounds = bullet.getBounds();

        if (bullet.owner === 'player') {
            return this.handlePlayerBulletCollision(bullet, index, bulletBounds);
        } else if (bullet.owner === 'enemy') {
            // ★★★ ОБРАБОТКА ВРАЖЕСКИХ ПУЛЬ С ТАНКАМИ СОЮЗНИКОВ ★★★
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
                    if (bullet.owner === 'enemy' && bullet.shooter) {
                        this.recordBaseDestroyedByEnemy(bullet.shooter);
                    }
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

    // 🔥 ИСПРАВЛЕННЫЙ МЕТОД handlePlayerBulletCollision
    handlePlayerBulletCollision(bullet, index, bulletBounds) {
        for (let j = this.enemyManager.enemies.length - 1; j >= 0; j--) {
            const enemy = this.enemyManager.enemies[j];

            // 🔥 ПРОПУСКАЕМ ОГАРКИ
            if (enemy.isWreck && enemy.isDestroyed) {
                continue;
            }

            if (bulletBounds.intersects(enemy.getBounds())) {
                const healthBefore = enemy.health;
                const isHeavyTank = enemy.enemyType === 'HEAVY';
                const isViewerTank = enemy.isViewerTank || enemy.enemyType === 'VIEWER';

                // 🔥 ВАЖНО: Сохраняем был ли враг жив ДО попадания
                const wasAlive = !enemy.isDestroyed;

                const destructionResult = enemy.takeDamage();

                // 🔥 ИСПРАВЛЕНИЕ: ИГРАЕМ ЗВУК ПРИ ЛЮБОМ ПОПАДАНИИ (если враг был жив)
                if (wasAlive) {
                    if (healthBefore > 1 && enemy.health > 0) {
                        // Не смертельное попадание - звук попадания
                        if (isHeavyTank || isViewerTank) {
                            this.soundManager.play('heavyTankHit');
                        } else {
                            this.soundManager.play('bulletHit');
                        }

                        // Визуальный эффект попадания
                        this.effectManager.addHitEffect(enemy.position.x, enemy.position.y);
                    }
                }

                // 🔥 ЕСЛИ ТАНК ПРЕВРАТИЛСЯ В ОГАРОК
                if (destructionResult === 'wreck') {
                    console.log(`🔥 Танк ${enemy.username || enemy.enemyType} стал огарком`);

                    // Смертельное попадание - звук взрыва
                    this.soundManager.play('tankExplosion');
                    this.effectManager.addExplosion(enemy.position.x, enemy.position.y, 'wreck');
                    this.screenShake = 15;

                    // Увеличиваем счетчики
                    this.enemiesDestroyed++;
                    this.score += 100;
                    this.updateUI();

                    // Дополнительная обработка для зрителей
                    if (isViewerTank && this.viewerSystem) {
                        this.viewerSystem.destroyedViewerTanks.add(enemy.userId);
                        this.markEnemyDestroyed(enemy);
                    }

                    this.bullets.splice(index, 1);
                    return false;
                }

                this.bullets.splice(index, 1);
                return false;
            }
        }
        return true;
    }

    // 🔥 НОВЫЙ МЕТОД: ПРЕВРАЩЕНИЕ В ОГАРОК
    convertToWreck(enemy, hadBonus, bonusType) {
        // Помечаем как огарок
        enemy.isWreck = true;
        enemy.isDestroyed = true;

        // 🔥 ДЛЯ ТАНКОВ ЗРИТЕЛЕЙ - МГНОВЕННО ДЕЛАЕМ БЛЕДНЫМИ
        if (enemy.isViewerTank || enemy.enemyType === 'VIEWER') {
            this.instantlyFadeViewerWreck(enemy);
        } else {
            // Для ИИ танков - стандартное затемнение
            enemy.fadeAlpha = 0.5;
        }

        // Добавляем в список уничтоженных
        this.markEnemyDestroyed(enemy);

        // Эффект превращения
        this.effectManager.addExplosion(enemy.position.x, enemy.position.y, 'wreck');
        this.screenShake = 15;
        this.soundManager.play('tankExplosion');

        // Если был бонус - спавним
        if (hadBonus && bonusType) this.bonusManager.spawnBonusFromTank(enemy);

        // 🔥 ОЧЕНЬ ВАЖНО: Не удаляем из массива enemies!
        console.log(`✅ Танк ${enemy.username || enemy.enemyType} стал огарком (всего огарков: ${
            this.enemyManager.enemies.filter(e => e.isWreck).length
        })`);
    }

    // 🔥 НОВЫЙ МЕТОД: МГНОВЕННОЕ ЗАТЕМНЕНИЕ ТАНКА ЗРИТЕЛЯ
    instantlyFadeViewerWreck(enemy) {
        if (!enemy) return;

        // 🔥 МГНОВЕННОЕ ЗАТЕМНЕНИЕ (без анимации)
        enemy.wreckFadeAlpha = 0.3; // Очень бледный
        enemy.avatarFadeAlpha = 0.2; // Аватарка почти невидима
        enemy.nameFadeAlpha = 0.4; // Имя полупрозрачное

        // 🔥 ОСТАНАВЛИВАЕМ ВСЕ АНИМАЦИИ
        if (enemy.animationTimer) clearTimeout(enemy.animationTimer);
        if (enemy.fadeAnimation) clearInterval(enemy.fadeAnimation);

        console.log(`⚡ Танк зрителя ${enemy.username} мгновенно затемнен`);
    }


    // 🔥 ВСПОМОГАТЕЛЬНЫЙ МЕТОД ДЛЯ УНИЧТОЖЕНИЯ ОБЫЧНЫХ ВРАГОВ
    processRegularEnemyDestruction(enemy, hadBonus, bonusType) {
        this.markEnemyDestroyed(enemy);
        this.effectManager.addExplosion(enemy.position.x, enemy.position.y, 'tank');
        this.screenShake = enemy.enemyType === 'HEAVY' ? 25 : 20;
        this.soundManager.play('tankExplosion');

        if (hadBonus && bonusType) this.bonusManager.spawnBonusFromTank(enemy);
        this.recordEnemyKill();
        this.player.addExperience(enemy.enemyType);
        this.playerExperience = this.player.experience;
        this.playerLevel = this.player.playerLevel;
        this.savePlayerProgress();
    }

    handleEnemyBulletCollision(bullet, index, bulletBounds) {
        if (!this.player.isDestroyed && bulletBounds.intersects(this.player.getBounds())) {
            const healthBefore = this.player.health;

            if (this.player.takeDamage()) {
                // ЗВУК ПРИ ПОПАДАНИИ В ИГРОКА С НЕСКОЛЬКИМИ ЖИЗНЯМИ
                if (healthBefore > 1) {
                    this.soundManager.play('heavyTankHit');
                }

                this.effectManager.addExplosion(this.player.position.x, this.player.position.y, 'tank');
                this.screenShake = 35;
                this.soundManager.play('tankExplosion');
                this.recordPlayerDeath();

                if (bullet.shooter && bullet.owner === 'enemy') {
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
            } else {
                // Игрок получил урон, но не уничтожен (остались жизни)
                if (healthBefore > 1) {
                    this.soundManager.play('heavyTankHit');
                    // Визуальный эффект попадания
                    this.effectManager.addBulletExplosion(this.player.position.x, this.player.position.y);
                }
            }

            this.bullets.splice(index, 1);
            return false;
        }

        // ★★★ 2. Проверка столкновения с другими врагами (союзниками) ★★★
        for (let j = this.enemyManager.enemies.length - 1; j >= 0; j--) {
            const enemy = this.enemyManager.enemies[j];

            // Пропускаем: уничтоженных, самого стреляющего, или если пуля принадлежит этому врагу
            if (enemy.isDestroyed ||
                bullet.shooter === enemy ||
                (bullet.shooter && bullet.shooter.username === enemy.username)) {
                continue;
                }

                if (bulletBounds.intersects(enemy.getBounds())) {
                    // Визуальный эффект (без урона)
                    this.effectManager.addBulletExplosion(
                        bullet.position.x,
                        bullet.position.y,
                        'friendly_fire'
                    );

                    // Звук попадания по броне
                    if (this.soundManager) {
                        this.soundManager.play('heavyTankHit');

                        // Тихий звук столкновения
                        setTimeout(() => {
                            this.soundManager.play('bulletHit');
                        }, 50);
                    }

                    // Минимальный экранный шейк для обратной связи
                    this.screenShake = Math.max(this.screenShake, 5);

                    // ★★★ ПУЛЯ УНИЧТОЖАЕТСЯ, НО УРОНА НЕ НАНОСИТ ★★★
                    bullet.active = false;
                    this.bullets.splice(index, 1);

                    // Визуальный эффект на танке (мигание)
                    enemy.blinkTimer = 0;
                    enemy.blinkAlpha = 0.5;
                    enemy.blinkDirection = 1;

                    // Записываем статистику (дружественный огонь)
                    if (bullet.shooter && bullet.shooter.recordShot) {
                        bullet.shooter.recordShot();
                    }

                    return false;
                }
        }

        // 3. Проверка столкновения с другими пулями (уже обработано в checkBulletCollisions)
        // 4. Если не было столкновений, пуля продолжает полет
        return true;
    }

    recordBaseDestroyedByEnemy(enemy) {
        if (!enemy || !enemy.username) return;
        enemy.recordBaseDestroyed();
        this.saveEnemyStatsToStorage(enemy);
        this.addBaseDestroyerToLeaderboard(enemy);
    }

    addBaseDestroyerToLeaderboard(enemy) {
        if (!enemy || !enemy.username) return;
        let totalScore = LEVEL_STATS_POINTS.BASE_DESTROYED;

        if (enemy.levelStats) {
            totalScore += enemy.levelStats.shots * LEVEL_STATS_POINTS.SHOT +
            enemy.levelStats.wallsDestroyed * LEVEL_STATS_POINTS.WALL_DESTROYED +
            enemy.levelStats.playerKills * LEVEL_STATS_POINTS.PLAYER_KILL;
            enemy.levelStats.totalScore = totalScore;
        }

        const existingIndex = this.leaderboard.findIndex(entry =>
        entry.name === enemy.username && entry.type === enemy.enemyType
        );

        if (existingIndex !== -1) {
            this.leaderboard[existingIndex].score += totalScore;
            this.leaderboard[existingIndex].level = this.level;
            this.leaderboard[existingIndex].baseDestroyed = true;

            if (enemy.levelStats) {
                if (this.leaderboard[existingIndex].stats) {
                    this.leaderboard[existingIndex].stats.shots += enemy.levelStats.shots;
                    this.leaderboard[existingIndex].stats.wallsDestroyed += enemy.levelStats.wallsDestroyed;
                    this.leaderboard[existingIndex].stats.playerKills += enemy.levelStats.playerKills;
                    this.leaderboard[existingIndex].stats.baseDestroyed = true;
                    this.leaderboard[existingIndex].stats.totalScore += totalScore;
                } else {
                    this.leaderboard[existingIndex].stats = {...enemy.levelStats};
                    this.leaderboard[existingIndex].stats.baseDestroyed = true;
                }
            }
        } else {
            const newEntry = {
                name: enemy.username,
                type: enemy.enemyType,
                score: totalScore,
                level: this.level,
                baseDestroyed: true
            };

            if (enemy.levelStats) {
                newEntry.stats = {
                    shots: enemy.levelStats.shots,
                    wallsDestroyed: enemy.levelStats.wallsDestroyed,
                    playerKills: enemy.levelStats.playerKills,
                    baseDestroyed: true,
                    totalScore: totalScore
                };
            }

            this.leaderboard.push(newEntry);
        }

        this.leaderboard.sort((a, b) => b.score - a.score);
        this.saveLeaderboard();
        this.updateLeaderboardUI();
    }

    setupEventListeners() {
        document.addEventListener('keydown', (e) => {
            this.keys[e.code] = true;

            if (e.code === 'ArrowUp' || e.code === 'KeyW') this.directionPriority = DIRECTIONS.UP;
            else if (e.code === 'ArrowDown' || e.code === 'KeyS') this.directionPriority = DIRECTIONS.DOWN;
            else if (e.code === 'ArrowLeft' || e.code === 'KeyA') this.directionPriority = DIRECTIONS.LEFT;
            else if (e.code === 'ArrowRight' || e.code === 'KeyD') this.directionPriority = DIRECTIONS.RIGHT;

            if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code)) e.preventDefault();
        });

            document.addEventListener('keyup', (e) => {
                this.keys[e.code] = false;
                if ((e.code === 'ArrowUp' || e.code === 'KeyW') && this.directionPriority === DIRECTIONS.UP) this.directionPriority = null;
                else if ((e.code === 'ArrowDown' || e.code === 'KeyS') && this.directionPriority === DIRECTIONS.DOWN) this.directionPriority = null;
                else if ((e.code === 'ArrowLeft' || e.code === 'KeyA') && this.directionPriority === DIRECTIONS.LEFT) this.directionPriority = null;
                else if ((e.code === 'ArrowRight' || e.code === 'KeyD') && this.directionPriority === DIRECTIONS.RIGHT) this.directionPriority = null;
            });

                this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
                // 🔥 ДОБАВЛЯЕМ ОБРАБОТЧИКИ МЫШИ
                this.canvas.addEventListener('mousemove', (e) => {
                    const rect = this.canvas.getBoundingClientRect();
                    this.mousePosition = {
                        x: e.clientX - rect.left,
                        y: e.clientY - rect.top
                    };
                });

                this.canvas.addEventListener('mouseleave', () => {
                    this.mousePosition = null;
                    this.canvas.style.cursor = 'default';

                    // Сбрасываем все hover состояния
                    this.resetAllWreckHovers();
                });
    }

    // 🔥 СБРОС ВСЕХ HOVER СОСТОЯНИЙ
    resetAllWreckHovers() {
        this.enemyManager.enemies.forEach(enemy => {
            if (enemy.isWreck && enemy.isDestroyed) {
                enemy.infoBlockHovered = false;
            }
        });
    }

    getCurrentDirection() {
        if (this.directionPriority) return this.directionPriority;
        if (this.keys['ArrowUp'] || this.keys['KeyW']) return DIRECTIONS.UP;
        if (this.keys['ArrowDown'] || this.keys['KeyS']) return DIRECTIONS.DOWN;
        if (this.keys['ArrowLeft'] || this.keys['KeyA']) return DIRECTIONS.LEFT;
        if (this.keys['ArrowRight'] || this.keys['KeyD']) return DIRECTIONS.RIGHT;
        return null;
    }

    handleInput() {
        const allTanks = [this.player, ...this.enemyManager.enemies];
        const allFragments = this.getAllFragments();

        // ПОЛУЧАЕМ НАПРАВЛЕНИЕ С УЧЕТОМ РЕВЕРСА
        let currentDirection;
        if (this.viewerSystem.playerReversed) {
            currentDirection = this.viewerSystem.getReversedDirection();
        } else {
            currentDirection = this.getCurrentDirection();
        }

        const wasMoving = this.isPlayerMoving;
        this.isPlayerMoving = false;

        if (currentDirection && !this.player.isDestroyed && !this.baseDestroyed) {
            if (this.player.move(currentDirection, this.map, allTanks, allFragments)) {
                this.isPlayerMoving = true;
            }
        }

        if (wasMoving !== this.isPlayerMoving && this.soundManager) {
            if (this.gameOver || this.player.isDestroyed) {
                this.soundManager.stopLoop('engineIdle');
                this.soundManager.stopLoop('engineMoving');
            } else if (this.levelComplete) {
                if (this.isPlayerMoving) {
                    this.soundManager.stopLoop('engineIdle');
                    this.soundManager.playLoop('engineMoving');
                } else {
                    this.soundManager.stopLoop('engineIdle');
                    this.soundManager.stopLoop('engineMoving');
                }
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
            if (this.player.hasAutoAim) nearestEnemy = this.player.findNearestTarget(this.enemyManager.enemies, this.map);

            const bullet = this.player.shoot(nearestEnemy);
            if (bullet) {
                this.bullets.push(bullet);
                this.soundManager.play('playerShot');
            }
        }

        const bonusTanksCount = this.enemyManager.enemies.filter(enemy => enemy.hasBonus).length;
    }

    loadLeaderboard() {
        try {
            const saved = localStorage.getItem('tankGame_leaderboard');
            if (saved) return JSON.parse(saved);
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

    resetLeaderboard() {
        this.leaderboard = [];
        this.saveLeaderboard();
        this.updateLeaderboardUI();
        console.log('🗑️ Таблица лидеров сброшена');

        // Также можно сбросить статистику уровней
        this.clearAllLevelStats();
    }

    addToLeaderboard(enemy, isBaseDestroyer = false) {
        if (!enemy || !enemy.username) return;
        if (isBaseDestroyer) {
            this.addBaseDestroyerToLeaderboard(enemy);
            return;
        }

        let totalScore = 0;
        if (enemy.levelStats) totalScore = enemy.levelStats.totalScore;
        else totalScore = 100;

        const existingIndex = this.leaderboard.findIndex(entry =>
        entry.name === enemy.username && entry.type === enemy.enemyType
        );

        if (existingIndex !== -1) {
            this.leaderboard[existingIndex].score += totalScore;
            this.leaderboard[existingIndex].level = this.level;
            if (enemy.levelStats) {
                if (this.leaderboard[existingIndex].stats) {
                    this.leaderboard[existingIndex].stats.shots += enemy.levelStats.shots;
                    this.leaderboard[existingIndex].stats.wallsDestroyed += enemy.levelStats.wallsDestroyed;
                    this.leaderboard[existingIndex].stats.playerKills += enemy.levelStats.playerKills;
                    this.leaderboard[existingIndex].stats.totalScore += totalScore;
                } else {
                    this.leaderboard[existingIndex].stats = {...enemy.levelStats};
                }
            }
        } else {
            const newEntry = {
                name: enemy.username,
                type: enemy.enemyType,
                score: totalScore,
                level: this.level,
                baseDestroyed: false
            };

            if (enemy.levelStats) newEntry.stats = {...enemy.levelStats};
            this.leaderboard.push(newEntry);
        }

        this.leaderboard.sort((a, b) => b.score - a.score);
        this.leaderboard.length > 20 && (this.leaderboard = this.leaderboard.slice(0, 20));
        this.saveLeaderboard();
        this.updateLeaderboardUI();
    }

    updateLeaderboardUI() {
        const container = document.getElementById('leaderboardEntries');
        if (!container) return;
        container.innerHTML = '';

        const icons = { 'BASIC': '🔴', 'FAST': '🟡', 'HEAVY': '🟣', 'SNIPER': '🟢' };
        const displayEntries = this.showFullLeaderboard ? this.leaderboard : this.leaderboard.slice(0, 5);

        const leaderboardElement = document.getElementById("leaderboard");
        if (leaderboardElement) {
            const titleElement = leaderboardElement.querySelector("h3");
            if (titleElement) {
                if (this.leaderboard.length === 0) titleElement.textContent = "🏆 Таблица лидеров";
                else {
                    const displayedCount = this.showFullLeaderboard ? this.leaderboard.length : Math.min(5, this.leaderboard.length);
                    titleElement.textContent = `🏆 Лидеры (${displayedCount}/${this.leaderboard.length})`;
                }
            }
        }

        if (displayEntries.length === 0) {
            container.innerHTML = '<div style="text-align: center; color: #888; font-size: 12px;">Победителей пока нет</div>';
            return;
        }

        displayEntries.forEach((entry, index) => {
            const entryEl = document.createElement('div');
            entryEl.className = 'leaderboard-entry';
            if (entry.baseDestroyed) {
                entryEl.style.background = 'rgba(255, 0, 0, 0.2)';
                entryEl.style.border = '1px solid #ff4444';
            }

            const rank = this.showFullLeaderboard ? index + 1 : (this.leaderboard.findIndex(e => e.name === entry.name && e.type === entry.type) + 1);
            const baseDestroyerIcon = entry.baseDestroyed ? ' 💥' : '';

            entryEl.innerHTML = `
            <span class="rank">${rank}</span>
            <span class="tank-icon">${icons[entry.type] || '⚫'}</span>
            <span class="name">${entry.name}${baseDestroyerIcon}</span>
            <span class="score">${entry.score}</span>
            <span class="level">ур.${entry.level}</span>
            `;
            container.appendChild(entryEl);
        });
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
        const shouldShow = isActive && remainingTime > 0 && !this.player.isDestroyed && !this.baseDestroyed;

        if (shouldShow) {
            timeElement.textContent = remainingTime.toFixed(1);
            indicator.style.display = 'block';
        } else {
            indicator.style.display = 'none';
            timeElement.textContent = '0.0';
        }
    }

    updateShieldIndicator() {
        const remainingTime = this.player.hasShield() ? this.player.shield.getRemainingTime() : 0;
        this.updateStatusIndicator('shieldIndicator', 'shieldTime', this.player.hasShield(), remainingTime);
    }

    updateInvincibilityIndicator() {
        const remainingTime = this.player.isInvincible ? (this.player.invincibilityDuration - this.player.invincibilityTimer) / 1000 : 0;
        this.updateStatusIndicator('invincibilityIndicator', 'invincibilityTime', this.player.isInvincible, remainingTime);
    }

    updateAutoAimIndicator() {
        const hasAutoAim = this.player.hasAutoAim && this.player.autoAimDuration > 0 && this.player.autoAimTimer < this.player.autoAimDuration;
        if (!hasAutoAim) {
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

    // В классе Game:
    getAllEnemiesCount() {
        // 🔥 СЧИТАЕМ ТОЛЬКО ЖИВЫХ ВРАГОВ
        return this.enemyManager.enemies.length;
    }

    getTotalDestroyedCount() {
        // 🔥 ОГАРКИ + УНИЧТОЖЕННЫЕ ОБЫЧНЫЕ ВРАГИ
        const wreckCount = this.enemyManager.wrecks ? this.enemyManager.wrecks.length : 0;
        const destroyedCount = this.enemyManager.destroyedEnemies || 0;
        return wreckCount + destroyedCount;
    }

    checkLevelCompletion() {
        // 🔥 ПРОВЕРКА: Не проверяем завершение если игра уже окончена, уровень завершен или был вручную закрыт
        if (this.gameOver || this.levelComplete || this.levelManuallyClosed) {
            return;
        }

        const enemiesLeft = this.enemiesToSpawn > 0 ? this.enemiesToSpawn : 0;
        const activeEnemies = this.getActiveEnemiesCount();

        if (enemiesLeft === 0 &&
            activeEnemies === 0 &&
            this.enemyManager.spawnAnimations.length === 0) {

        // Устанавливаем флаг только один раз
        if (!this.levelComplete) {
            this.levelComplete = true;
            this.levelCompleteTimer = 0;

            // Сбрасываем данные зрителей
            this.viewerSystem.resetForNewRound();

            setTimeout(() => {
                this.calculateLevelLeader();
                if (!this.levelLeader) this.findHonoraryLeader();
                this.showLevelCompleteStats = true;
                this.showLevelComplete();
            }, 1000);
        }
            }
    }

    saveEnemyStatsToStorage(enemy) {
        if (!enemy || !enemy.username) return;
        try {
            const storageKey = `tankGame_level_${this.level}_stats`;
            let levelStats = JSON.parse(localStorage.getItem(storageKey)) || {};
            levelStats[enemy.username] = {
                enemyType: enemy.enemyType,
                stats: enemy.levelStats,
                timestamp: Date.now()
            };
            localStorage.setItem(storageKey, JSON.stringify(levelStats));
        } catch (error) {
            console.error('Ошибка сохранения статистики:', error);
        }
    }

    loadLevelStatsFromStorage() {
        try {
            const storageKey = `tankGame_level_${this.level}_stats`;
            return JSON.parse(localStorage.getItem(storageKey)) || {};
        } catch (error) {
            console.error('Ошибка загрузки статистики:', error);
            return {};
        }
    }

    clearLevelStatsFromStorage() {
        try {
            const storageKey = `tankGame_level_${this.level}_stats`;
            localStorage.removeItem(storageKey);
        } catch (error) {
            console.error('Ошибка очистки статистики:', error);
        }
    }

    calculateLevelLeader() {
        const allEnemies = this.getAllRoundEnemies();

        // 🔥 ДЕБАГ: Вывести всех врагов в консоль
        console.log("=== Все враги в раунде ===");
        allEnemies.forEach(enemy => {
            console.log(`${enemy.username} (${enemy.enemyType}) - ` +
            `убийств игрока: ${enemy.stats.playerKills}, ` +
            `выстрелов: ${enemy.stats.shots}, ` +
            `стен: ${enemy.stats.wallsDestroyed}`);
        });

        let leader = null;
        let maxScore = -1;

        // Сначала ищем того, кто уничтожил базу
        allEnemies.forEach((enemyData) => {
            const stats = enemyData.stats;
            if (stats.baseDestroyed) {
                leader = {
                    enemy: {
                        username: enemyData.username,
                        enemyType: enemyData.enemyType,
                        isViewerTank: enemyData.isViewerTank
                    },
                    stats: stats
                };
                maxScore = stats.totalScore;
                console.log(`Найден разрушитель базы: ${enemyData.username}`);
                return;
            }
        });

        // Если никто не разрушил базу, ищем по очкам
        if (!leader) {
            allEnemies.forEach((enemyData) => {
                const stats = enemyData.stats;
                const hasActivity = stats.shots > 0 ||
                stats.wallsDestroyed > 0 ||
                stats.playerKills > 0 ||
                stats.baseDestroyed;

                if (stats.totalScore > maxScore && hasActivity) {
                    maxScore = stats.totalScore;
                    leader = {
                        enemy: {
                            username: enemyData.username,
                            enemyType: enemyData.enemyType,
                            isViewerTank: enemyData.isViewerTank
                        },
                        stats: stats
                    };
                    console.log(`Новый лидер по очкам: ${enemyData.username} (${stats.totalScore})`);
                }
            });
        }

        // Если все еще нет лидера, выбираем случайного активного врага
        if (!leader && allEnemies.length > 0) {
            const activeEnemies = allEnemies.filter(e =>
            e.stats.shots > 0 || e.stats.wallsDestroyed > 0
            );

            if (activeEnemies.length > 0) {
                const randomEnemy = activeEnemies[Math.floor(Math.random() * activeEnemies.length)];
                leader = {
                    enemy: {
                        username: randomEnemy.username,
                        enemyType: randomEnemy.enemyType,
                        isViewerTank: randomEnemy.isViewerTank
                    },
                    stats: randomEnemy.stats
                };
                console.log(`Выбран случайный активный враг: ${randomEnemy.username}`);
            } else {
                // Если все были полностью пассивны, все равно выбираем кого-то
                const randomEnemy = allEnemies[Math.floor(Math.random() * allEnemies.length)];
                leader = {
                    enemy: {
                        username: randomEnemy.username,
                        enemyType: randomEnemy.enemyType,
                        isViewerTank: randomEnemy.isViewerTank
                    },
                    stats: randomEnemy.stats
                };
                console.log(`Выбран случайный враг (все пассивны): ${randomEnemy.username}`);
            }
        }

        this.levelLeader = leader;
        console.log("=== ФИНАЛЬНЫЙ ЛИДЕР ===", leader);
    }

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

    showLevelComplete() {
        console.log('🟢 Показываю окно завершения уровня');

        this.showLevelCompleteScreen = true;
        this.levelComplete = true;

        const levelCompleteElement = document.getElementById("levelComplete");
        if (levelCompleteElement) {
            // Добавляем класс force-visible и показываем
            levelCompleteElement.classList.add('force-visible');
            levelCompleteElement.style.display = "block";

            // 🔥 ВАЖНО: Сбрасываем состояние таймера
            const timerElement = document.getElementById('levelCompleteTimer');
            if (timerElement) {
                // Показываем элемент
                timerElement.style.display = 'block';

                // Сбрасываем текст
                const timerText = timerElement.querySelector('.timer-text');
                if (timerText) {
                    timerText.innerHTML = 'Автоматический переход через: <span class="timer-count">5</span>с';
                    timerText.style.color = 'white';
                }

                // Сбрасываем прогресс-бар
                const progressBar = timerElement.querySelector('.timer-progress-bar');
                if (progressBar) {
                    progressBar.style.width = '100%';
                    progressBar.style.background = 'linear-gradient(90deg, #4CAF50, #8BC34A)';
                }

                // Показываем кнопку отмены
                const cancelBtn = timerElement.querySelector('.cancel-timer-btn');
                if (cancelBtn) {
                    cancelBtn.style.display = 'block';
                }
            }


            if (!this.levelLeader) this.calculateLevelLeader();
            this.showLevelLeaderStats();

            // Останавливаем звук двигателя
            if (this.soundManager) {
                this.soundManager.stopLoop("engineIdle");
                this.soundManager.stopLoop("engineMoving");
            }

            // Добавляем кнопку следующего уровня
            this.addNextLevelButton();

            // 🔥 ЗАПУСКАЕМ ОБРАТНЫЙ ОТСЧЕТ
            setTimeout(() => {
                this.startLevelCompleteCountdown();
            }, 500);

            console.log('✅ Окно levelComplete показано');
        }
    }

    showGameOver() {
        console.log('🔴 Показываю окно проигрыша');
        this.showGameOverScreen = true;
        this.gameOver = true;

        const gameOverScreen = document.getElementById('gameOver');
        if (gameOverScreen) {
            // Добавляем класс force-visible и показываем
            gameOverScreen.classList.add('force-visible');
            gameOverScreen.style.display = 'block';

            // 🔥 ВАЖНО: Сбрасываем состояние таймера
            const timerElement = document.getElementById('gameOverTimer');
            if (timerElement) {
                // Показываем элемент
                timerElement.style.display = 'block';

                // Сбрасываем текст
                const timerText = timerElement.querySelector('.timer-text');
                if (timerText) {
                    timerText.innerHTML = 'Новая игра через: <span class="timer-count">5</span>с';
                    timerText.style.color = 'white';
                }

                // Сбрасываем прогресс-бар
                const progressBar = timerElement.querySelector('.timer-progress-bar');
                if (progressBar) {
                    progressBar.style.width = '100%';
                    progressBar.style.background = 'linear-gradient(90deg, #F44336, #FF9800)';
                }

                // Показываем кнопку отмены
                const cancelBtn = timerElement.querySelector('.cancel-timer-btn');
                if (cancelBtn) {
                    cancelBtn.style.display = 'block';
                }
            }

            this.calculateLevelLeader();
            if (!this.levelLeader) this.findHonoraryLeader();
            this.showGameOverLeaderStats();

            // Останавливаем звуки
            if (this.soundManager) {
                this.soundManager.stopLoop('engineIdle');
                this.soundManager.stopLoop('engineMoving');
            }

            // 🔥 ЗАПУСКАЕМ ОБРАТНЫЙ ОТСЧЕТ
            setTimeout(() => {
                this.startGameOverCountdown();
            }, 500);

            console.log('✅ Окно gameOver показано');
        }
    }

    // 🔥 НОВЫЙ МЕТОД ДЛЯ ДОБАВЛЕНИЯ КНОПКИ
    addNextLevelButton() {
        const leaderContent = document.getElementById("leaderContent");
        if (!leaderContent) return;

        // Удаляем старую кнопку если есть
        const oldButton = document.getElementById("nextLevelBtn");
        if (oldButton) oldButton.remove();

        const buttonHTML = `
        <div class="auto-timer" id="levelCompleteTimer">
        <div class="timer-text">Автоматический переход через: <span class="timer-count">5</span>с</div>
        <div class="timer-progress">
        <div class="timer-progress-bar"></div>
        </div>
        <button class="cancel-timer-btn" onclick="cancelAutoTransition('level')">✕ Отменить авто-переход</button>
        </div>
        <div class="game-over-actions">
        <button id="nextLevelBtn">
        🎮 НАЧАТЬ СЛЕДУЮЩИЙ РАУНД
        </button>
        <div style="color: #bdc3c7; font-size: 12px; margin-top: 10px;">
        Уровень ${this.level + 1} готов к бою!
        </div>
        </div>
        `;

        leaderContent.insertAdjacentHTML('beforeend', buttonHTML);

        // Добавляем обработчик
        document.getElementById("nextLevelBtn").addEventListener("click", (e) => {
            e.stopPropagation();
            console.log('Кнопка "Следующий раунд" нажата');
            this.startNextLevel();
        });
    }

    // 🔥 НОВЫЙ МЕТОД ЗАПУСКА СЛЕДУЮЩЕГО УРОВНЯ
    startNextLevel() {
        console.log('🚀 Запуск следующего уровня');

         this.resetAllTimers();

        // Останавливаем таймер
        this.stopLevelCompleteCountdown();

        // Скрываем экран завершения уровня
        const levelCompleteScreen = document.getElementById('levelComplete');
        if (levelCompleteScreen) {
            levelCompleteScreen.style.display = 'none';
            levelCompleteScreen.classList.remove('force-visible');
        }

        // Сбрасываем флаги
        this.showLevelCompleteScreen = false;
        this.showLevelCompleteStats = false;
        this.levelComplete = false;

        // Записываем статистику завершенного уровня
        this.recordLevelCompleted();
        this.clearLevelStatsFromStorage();

        // Сохраняем прогресс игрока
        this.playerLevel = this.player.playerLevel;
        this.playerExperience = this.player.experience;
        this.savePlayerProgress();

        // Увеличиваем уровень
        this.level++;

        // Перезапускаем уровень
        this.initLevel();

        console.log(`🎮 Начинаем раунд ${this.level}!`);
    }

    showLevelLeaderStats() {
        const leaderContent = document.getElementById("leaderContent");
        const levelLeaderStats = document.getElementById("levelLeaderStats");

        if (!leaderContent) return;
        let htmlContent = "";

        if (this.levelLeader) htmlContent = this.generateGameOverLeaderStatsHTML(this.levelLeader);
        else htmlContent = `<div style="text-align: center; color: #bdc3c7; padding: 20px;"><p>Все противники были уничтожены слишком быстро</p><p>⚡ Никто не успел проявить активность</p></div>`;

        leaderContent.innerHTML = htmlContent;
        if (levelLeaderStats) levelLeaderStats.style.display = "block";
    }

    closeLevelStats() {
        if (this.countdownInterval) {
            clearInterval(this.countdownInterval);
            this.countdownInterval = null;
        }

        this.showLevelCompleteStats = false;
        this.showLevelCompleteScreen = false;

        const levelCompleteScreen = document.getElementById('levelComplete');
        const gameOverScreen = document.getElementById('gameOver');
        if (levelCompleteScreen) levelCompleteScreen.style.display = 'none';
        if (gameOverScreen) gameOverScreen.style.display = 'none';

        // 🔥 УДАЛИТЬ создание телепорта
        // if (!this.gameOver) this.createExitTeleport();

        // Вместо телепорта - предлагаем начать следующий раунд
        if (!this.gameOver) {
            this.showLevelComplete();
        }
    }

    forceShowGameOverStats() {
        const leaderStats = document.getElementById('gameOverLeaderStats');
        if (!leaderStats) return;
        leaderStats.style.cssText = `display: block !important; visibility: visible !important; opacity: 1 !important; position: relative !important; z-index: 1000 !important;`;
        leaderStats.classList.add('force-visible');
    }

    generateGameOverLeaderStatsHTML(leader) {
        if (!leader || !leader.enemy || !leader.stats) return "<div>Ошибка: данные лидера неполные</div>";

        // 🔥 ИКОНКИ ДЛЯ ТАНКОВ ЗРИТЕЛЕЙ
        let tankIcon;
        if (leader.enemy.isViewerTank || leader.enemy.enemyType === 'VIEWER') {
            tankIcon = '👤'; // Или '🎮' или '📹' - иконка для зрителя
        } else {
            tankIcon = {BASIC:"🔴", FAST:"🟡", HEAVY:"🟣", SNIPER:"🟢"}[leader.enemy.enemyType] || "⚫";
        }

        if (leader.stats.baseDestroyed) {
            return `
            <div class="leader-tank-info">
            <div class="tank-icon-large">${tankIcon}</div>
            <div class="tank-name">${leader.enemy.username}</div>
            <div class="total-score" style="color: #ff4444;">💥 РАЗРУШИТЕЛЬ БАЗЫ!</div>
            </div>
            <div class="leader-stats-details">
            <div class="stat-row"><span class="stat-label">Выстрелов:</span><span class="stat-value">${leader.stats.shots}</span></div>
            <div class="stat-row"><span class="stat-label">Разрушенных стен:</span><span class="stat-value">${leader.stats.wallsDestroyed}</span></div>
            <div class="stat-row"><span class="stat-label">Убийств игрока:</span><span class="stat-value">${leader.stats.playerKills}</span></div>
            <div class="stat-row"><span class="stat-label">Достижение:</span><span class="stat-value" style="color: #ff4444;">💀 Уничтожил вашу базу</span></div>
            </div>
            `;
        }

        return `
        <div class="leader-tank-info">
        <div class="tank-icon-large">${tankIcon}</div>
        <div class="tank-name">${leader.enemy.username}</div>
        <div class="total-score">Общий счет: ${leader.stats.totalScore}</div>
        </div>
        <div class="leader-stats-details">
        <div class="stat-row"><span class="stat-label">Выстрелов:</span><span class="stat-value">${leader.stats.shots}</span></div>
        <div class="stat-row"><span class="stat-label">Разрушенных стен:</span><span class="stat-value">${leader.stats.wallsDestroyed}</span></div>
        <div class="stat-row"><span class="stat-label">Убийств игрока:</span><span class="stat-value">${leader.stats.playerKills}</span></div>
        <div class="stat-row"><span class="stat-label">Разрушений базы:</span><span class="stat-value">${leader.stats.baseDestroyed ? "1 ✅" : "0"}</span></div>
        </div>
        `;
    }

    findHonoraryLeader() {
        let bestEnemy = null;
        let bestScore = -1;

        this.enemyManager.enemies.forEach(enemy => {
            if (!enemy.isDestroyed && enemy.levelStats) {
                const score = enemy.levelStats.totalScore;
                if (score > bestScore) {
                    bestScore = score;
                    bestEnemy = { enemy: { username: enemy.username, enemyType: enemy.enemyType }, stats: enemy.levelStats };
                }
            }
        });

        if (bestEnemy && bestScore > 0) this.levelLeader = bestEnemy;
        else if (this.enemyManager.enemies.length > 0) {
            const activeEnemies = this.enemyManager.enemies.filter(enemy => !enemy.isDestroyed);
            if (activeEnemies.length > 0) {
                const randomEnemy = activeEnemies[Math.floor(Math.random() * activeEnemies.length)];
                this.levelLeader = { enemy: { username: randomEnemy.username, enemyType: randomEnemy.enemyType }, stats: { shots: 0, wallsDestroyed: 0, playerKills: 0, baseDestroyed: false, totalScore: 0 } };
            }
        } else this.levelLeader = null;
    }

    showGameOverLeaderStats() {
        const leaderContent = document.getElementById('gameOverLeaderContent');
        const leaderStats = document.getElementById('gameOverLeaderStats');
        if (!leaderContent || !leaderStats) return;

        let htmlContent = "";
        if (this.levelLeader) htmlContent = this.generateGameOverLeaderStatsHTML(this.levelLeader);
        else htmlContent = `<div style="text-align: center; color: #bdc3c7; padding: 20px;"><p>Ни один противник не проявил активности</p><p>😴 Все враги были пассивны в этом раунде</p></div>`;

        leaderContent.innerHTML = htmlContent;
        leaderStats.style.display = 'block';
    }

    nextLevel(exitX = null, exitY = null) {
        this.recordLevelCompleted();
        this.clearLevelStatsFromStorage();

        this.playerLevel = this.player.playerLevel;
        this.playerExperience = this.player.experience;
        this.savePlayerProgress();

        this.level++;
        this.initLevel();
    }

    restartGame() {
        console.log('=== ПОЛНЫЙ ПЕРЕЗАПУСК ИГРЫ ===');

        this.resetAllTimers();

        // Останавливаем таймеры
        this.stopLevelCompleteCountdown();
        this.stopGameOverCountdown();

        // Закрываем все окна
        window.closeGameScreens();

        // Ждем небольшое время
        setTimeout(() => {
            try {
                // Сбрасываем состояние
                this.clearAllLevelStats();
                this.levelLeader = null;

                this.level = 1;
                this.score = 0;
                this.lives = 3;
                this.gameOver = false;
                this.baseDestroyed = false;
                this.levelComplete = false;
                this.showGameOverScreen = false;
                this.showLevelCompleteScreen = false;

                this.clearRoundTracker();

                // Останавливаем звуки
                if (this.soundManager) {
                    this.soundManager.stopAll();
                }

                // Инициализируем уровень заново
                this.initLevel();

                // Обновляем UI
                this.updateUI();
                this.updatePlayerStats();

                console.log('✅ Игра успешно перезапущена');

            } catch (error) {
                console.error('❌ Ошибка при перезапуске:', error);
                alert('Ошибка перезапуска: ' + error.message);
            }
        }, 50);
    }

    clearAllLevelStats() {
        for (let i = 1; i <= 10; i++) {
            try {
                localStorage.removeItem(`tankGame_level_${i}_stats`);
                localStorage.removeItem(`level_${i}_leader`);
            } catch (error) {
                console.error(`Ошибка очистки уровня ${i}:`, error);
            }
        }
    }



    updateUI() {
        document.getElementById('score').textContent = this.score;
        document.getElementById('lives').textContent = this.lives;
        document.getElementById('level').textContent = this.level;

        // 🔥 ПРОСТОЕ РЕШЕНИЕ: используем enemiesToSpawn
        document.getElementById('tanksLeft').textContent = this.enemiesToSpawn;
    }

    updatePlayerStats() {
        const expElement = document.getElementById('playerExp');
        const levelElement = document.getElementById('playerLevel');

        if (expElement) {
            const nextLevel = this.playerLevel + 1;
            const nextExp = EXP_REQUIREMENTS[nextLevel] || 999;
            expElement.textContent = `${this.playerExperience}/${nextExp}`;
        }
        if (levelElement) levelElement.textContent = this.playerLevel;
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
                    this.originalBaseWalls.push({ x: x, y: y, type: originalTile, brickTile: this.map.brickTiles.get(key) });
                } else {
                    this.originalBaseWalls.push({ x: x, y: y, type: originalTile, brickTile: null });
                }
            }
        });
    }

    updateBaseFortification() {
        if (this.baseFortified) {
            const currentTime = Date.now();
            if (!this.baseFortifyStartTime) this.baseFortifyStartTime = currentTime;

            const elapsedTime = currentTime - this.baseFortifyStartTime;
            const remainingTime = this.baseFortifyDuration - elapsedTime;

            if (remainingTime < 5000) {
                const blink = Math.floor(elapsedTime / 200) % 2 === 0;
                if (blink) this.temporarilyRestoreWalls();
                else this.temporarilyUpgradeWalls();
            } else this.temporarilyUpgradeWalls();

            if (remainingTime <= 0) {
                this.baseFortified = false;
                this.baseFortifyStartTime = null;
                this.permanentlyRestoreWalls();
            }
            this.updateStatusIndicators();
        }
    }

    fortifyBase(duration) {
        if (this.baseFortified) {
            const elapsed = Date.now() - this.baseFortifyStartTime;
            this.baseFortifyDuration = Math.max(this.baseFortifyDuration - elapsed, duration);
            this.baseFortifyStartTime = Date.now();
            return;
        }

        this.baseFortified = true;
        this.baseFortifyDuration = duration;
        this.baseFortifyStartTime = Date.now();
        this.saveOriginalBaseWalls();
    }

    temporarilyRestoreWalls() {
        this.originalBaseWalls.forEach(wall => {
            if (wall.x >= 0 && wall.x < this.map.width && wall.y >= 0 && wall.y < this.map.height) {
                this.map.grid[wall.y][wall.x] = wall.type;
                if (wall.type === TILE_TYPES.BRICK && wall.brickTile) {
                    this.map.brickTiles.set(`${wall.x},${wall.y}`, wall.brickTile);
                }
            }
        });
    }

    temporarilyUpgradeWalls() {
        this.originalBaseWalls.forEach(wall => {
            if (wall.x >= 0 && wall.x < this.map.width && wall.y >= 0 && wall.y < this.map.height) {
                this.map.grid[wall.y][wall.x] = TILE_TYPES.CONCRETE;
                if (wall.type === TILE_TYPES.BRICK) this.map.brickTiles.delete(`${wall.x},${wall.y}`);
            }
        });
    }

    permanentlyRestoreWalls() {
        this.originalBaseWalls.forEach(wall => {
            if (wall.x >= 0 && wall.x < this.map.width && wall.y >= 0 && wall.y < this.map.height) {
                this.map.grid[wall.y][wall.x] = wall.type;
                if (wall.type === TILE_TYPES.BRICK && wall.brickTile) {
                    this.map.brickTiles.set(`${wall.x},${wall.y}`, wall.brickTile);
                } else if (wall.type === TILE_TYPES.BRICK && !wall.brickTile) {
                    this.map.brickTiles.set(`${wall.x},${wall.y}`, new BrickTile(wall.x, wall.y));
                }
            }
        });
        this.originalBaseWalls = [];
    }

    gameLoop(currentTime) {
        if (!this.lastTime) this.lastTime = currentTime;
        this.deltaTime = currentTime - this.lastTime;
        this.lastTime = currentTime;

        const fixedTimeStep = 16;
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
        if (this.screenShake > 0) {
            const intensity = this.screenShake / 50;
            this.ctx.fillStyle = `rgba(255, 100, 0, ${intensity * 0.3})`;
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        } else {
            this.ctx.fillStyle = '#000';
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        }

        this.map.draw(this.ctx);
        this.drawBaseProtectedZones(this.ctx);
        this.drawZoneGrid(this.ctx);

        if (this.debugShowZoneInfo) {
            this.drawEnemyZones(this.ctx);
            this.drawPlayerZoneHighlight(this.ctx);
        }

        this.bonusManager.bonuses.forEach(bonus => bonus.draw(this.ctx));
        this.enemyManager.spawnAnimations.forEach(animation => animation.draw(this.ctx));

        if (!this.player.isDestroyed) {
            this.player.draw(this.ctx);
            this.drawPlayerStats(this.ctx);
        }

        // 🔥 ОТРИСОВЫВАЕМ ОГАРКИ ПОСЛЕ ЖИВЫХ ТАНКОВ
        this.drawWrecks(this.ctx);

        // СНАЧАЛА эффекты
        this.viewerSystem.drawEffects(this.ctx);

        // ПОТОМ тексты (поверх эффектов)
        this.viewerSystem.drawFloatingTexts(this.ctx);

        this.enemyManager.enemies.forEach(enemy => enemy.draw(this.ctx));
        this.bullets.forEach(bullet => bullet.draw(this.ctx));
        this.effectManager.explosions.forEach(explosion => explosion.draw(this.ctx));
        this.effectManager.bulletExplosions.forEach(explosion => explosion.draw(this.ctx));

        this.map.drawGrassOverlay(this.ctx);

        this.renderUIOverlays();
        this.drawPlayerStats(this.ctx);

        if (this.debugShowVision) this.drawDebugVision(this.ctx);
    }

    // 🔥 МЕТОД ОТРИСОВКИ ВСЕХ ОГАРКОВ
    drawWrecks(ctx) {
        this.enemyManager.enemies.forEach(enemy => {
            if (enemy.isWreck && enemy.isDestroyed) {
                enemy.draw(ctx);
            }
        });
    }

    drawDebugVision(ctx) {
        this.enemyManager.enemies.forEach(enemy => {
            if (!enemy.isDestroyed) {
                const visionRange = VISION_RANGES[enemy.enemyType] || VISION_RANGES.BASIC;
                const gradient = ctx.createRadialGradient(enemy.position.x, enemy.position.y, 0, enemy.position.x, enemy.position.y, visionRange);
                gradient.addColorStop(0, 'rgba(255, 255, 0, 0.1)');
                gradient.addColorStop(1, 'rgba(255, 255, 0, 0.05)');

                ctx.fillStyle = gradient;
                ctx.beginPath();
                ctx.arc(enemy.position.x, enemy.position.y, visionRange, 0, Math.PI * 2);
                ctx.fill();

                ctx.strokeStyle = 'rgba(255, 255, 0, 0.3)';
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.arc(enemy.position.x, enemy.position.y, visionRange, 0, Math.PI * 2);
                ctx.stroke();

                if (this.player && !this.player.isDestroyed && enemy.canSeePlayer(this.player, this.map)) {
                    const lineGradient = ctx.createLinearGradient(enemy.position.x, enemy.position.y, this.player.position.x, this.player.position.y);
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

    drawPlayerStats(ctx) {
        if (!this.debugShowVision || this.player.isDestroyed || !this.playerStats) return;
        ctx.save();
        ctx.translate(this.player.position.x, this.player.position.y);

        const statsLines = [
            `🧠 Уровень: ${this.player.playerLevel}`,
            `🤖 Убито противников: ${this.playerStats.enemiesKilled}`,
            `💀 Смертей: ${this.playerStats.deaths}`,
            `🧱 Сломано блоков: ${this.playerStats.blocksDestroyed}`
        ];

        const minutes = Math.floor(this.playerStats.playTime / 60);
        const hours = Math.floor(minutes / 60);
        const displayMinutes = minutes % 60;
        const timeText = hours > 0 ? `${hours}ч ${displayMinutes}м` : `${minutes}м`;
        statsLines.push(`⏰ Сыграно времени: ${timeText}`);
        statsLines.push(`🚧 Пройдено уровней: ${this.playerStats.levelsCompleted}`);

        const lineHeight = 14;
        const padding = 6;
        const totalHeight = statsLines.length * lineHeight + padding * 2;
        const maxWidth = this.getPlayerStatsTextWidth(ctx, statsLines) + padding * 2;

        const blockX = -this.player.size - maxWidth - 15;
        const blockY = -this.player.size - totalHeight - 10;

        const gradient = ctx.createLinearGradient(blockX, blockY, blockX + maxWidth, blockY + totalHeight);
        gradient.addColorStop(0, 'rgba(0, 0, 0, 0.85)');
        gradient.addColorStop(1, 'rgba(70, 130, 180, 0.85)');

        ctx.fillStyle = gradient;
        ctx.fillRect(blockX, blockY, maxWidth, totalHeight);

        ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.lineWidth = 1;
        ctx.strokeRect(blockX, blockY, maxWidth, totalHeight);

        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 11px Arial';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';

        statsLines.forEach((line, index) => {
            const yPos = blockY + padding + (index * lineHeight) + lineHeight/2;
            const xPos = blockX + padding;

            ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
            ctx.fillText(line, xPos + 1, yPos + 1);
            ctx.fillStyle = '#FFFFFF';
            ctx.fillText(line, xPos, yPos);
        });

        ctx.strokeStyle = 'rgba(100, 200, 255, 0.6)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(blockX + maxWidth, blockY + totalHeight/2);
        ctx.lineTo(-this.player.size/2, 0);
        ctx.stroke();

        ctx.restore();
    }

    getZoneId(x, y) {
        const gameArea = ZONE_SYSTEM.GAME_AREA;
        if (x < gameArea.startX || x > gameArea.startX + gameArea.width ||
            y < gameArea.startY || y > gameArea.startY + gameArea.height) {
            return { x: -1, y: -1, id: 'out_of_bounds' };
            }

            const zoneX = Math.floor((x - gameArea.startX) / ZONE_SYSTEM.ZONE_SIZE);
        const zoneY = Math.floor((y - gameArea.startY) / ZONE_SYSTEM.ZONE_SIZE);
        return { x: zoneX, y: zoneY, id: `${zoneX},${zoneY}` };
    }

    getZoneCoordinates(zoneX, zoneY) {
        const gameArea = ZONE_SYSTEM.GAME_AREA;
        return {
            x: gameArea.startX + zoneX * ZONE_SYSTEM.ZONE_SIZE,
            y: gameArea.startY + zoneY * ZONE_SYSTEM.ZONE_SIZE,
            width: ZONE_SYSTEM.ZONE_SIZE,
            height: ZONE_SYSTEM.ZONE_SIZE
        };
    }

    drawZoneGrid(ctx) {
        if (!window.ZONE_SYSTEM.SHOW_ZONE_BORDERS && !window.ZONE_SYSTEM.SHOW_ZONE_NUMBERS) return;
        ctx.save();

        const gameArea = ZONE_SYSTEM.GAME_AREA;
        const zonesX = Math.ceil(gameArea.width / ZONE_SYSTEM.ZONE_SIZE);
        const zonesY = Math.ceil(gameArea.height / ZONE_SYSTEM.ZONE_SIZE);

        if (window.ZONE_SYSTEM.SHOW_ZONE_BORDERS) {
            ctx.strokeStyle = window.ZONE_SYSTEM.ZONE_COLOR;
            ctx.lineWidth = 2;
            ctx.setLineDash([5, 5]);

            for (let x = 0; x <= zonesX; x++) {
                const lineX = gameArea.startX + x * ZONE_SYSTEM.ZONE_SIZE;
                ctx.beginPath();
                ctx.moveTo(lineX, gameArea.startY);
                ctx.lineTo(lineX, gameArea.startY + gameArea.height);
                ctx.stroke();
            }

            for (let y = 0; y <= zonesY; y++) {
                const lineY = gameArea.startY + y * ZONE_SYSTEM.ZONE_SIZE;
                ctx.beginPath();
                ctx.moveTo(gameArea.startX, lineY);
                ctx.lineTo(gameArea.startX + gameArea.width, lineY);
                ctx.stroke();
            }

            ctx.setLineDash([]);
        }

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

    drawPlayerZoneHighlight(ctx) {
        const playerZone = this.getZoneId(this.player.position.x, this.player.position.y);
        const zoneRect = this.getZoneCoordinates(playerZone.x, playerZone.y);

        ctx.save();
        ctx.fillStyle = 'rgba(255, 0, 0, 0.3)';
        ctx.fillRect(zoneRect.x, zoneRect.y, zoneRect.width, zoneRect.height);

        ctx.strokeStyle = 'rgba(255, 0, 0, 0.8)';
        ctx.lineWidth = 3;
        ctx.strokeRect(zoneRect.x, zoneRect.y, zoneRect.width, zoneRect.height);

        ctx.fillStyle = '#FF4444';
        ctx.font = 'bold 16px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('🎮 ИГРОК', zoneRect.x + zoneRect.width / 2, zoneRect.y + zoneRect.height / 2);
        ctx.restore();
    }

    drawEnemyZones(ctx) {
        const enemies = this.enemyManager.enemies.filter(enemy => !enemy.isDestroyed);
        enemies.forEach(enemy => {
            const enemyZone = this.getZoneId(enemy.position.x, enemy.position.y);
            const zoneRect = this.getZoneCoordinates(enemyZone.x, enemyZone.y);

            ctx.save();
            ctx.fillStyle = 'rgba(255, 255, 0, 0.2)';
            ctx.fillRect(zoneRect.x, zoneRect.y, zoneRect.width, zoneRect.height);

            ctx.fillStyle = '#FFFF00';
            ctx.beginPath();
            ctx.arc(enemy.position.x, enemy.position.y, 5, 0, Math.PI * 2);
            ctx.fill();

            ctx.strokeStyle = 'rgba(255, 255, 0, 0.5)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(zoneRect.x + zoneRect.width / 2, zoneRect.y + zoneRect.height / 2);
            ctx.lineTo(enemy.position.x, enemy.position.y);
            ctx.stroke();
            ctx.restore();
        });
    }

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
        }
    }

    getBaseZone() {
        if (!this.map || !this.map.basePosition) return { x: 3, y: 6 };
        const basePos = this.map.basePosition;
        const pixelX = basePos.x * TILE_SIZE + TILE_SIZE / 2;
        const pixelY = basePos.y * TILE_SIZE + TILE_SIZE / 2;
        return this.getZoneId(pixelX, pixelY);
    }

    drawBaseProtectedZones(ctx) {
        if (!window.BASE_ZONE_SYSTEM.SHOW_BASE_ZONES) return;
        const baseZone = this.getBaseZone();
        const protectedRadius = window.BASE_ZONE_SYSTEM.PROTECTED_RADIUS;

        ctx.save();
        for (let dx = -protectedRadius; dx <= protectedRadius; dx++) {
            for (let dy = -protectedRadius; dy <= protectedRadius; dy++) {
                const zoneX = baseZone.x + dx;
                const zoneY = baseZone.y + dy;

                if (zoneX >= 0 && zoneX < Math.ceil(ZONE_SYSTEM.GAME_AREA.width / ZONE_SYSTEM.ZONE_SIZE) &&
                    zoneY >= 0 && zoneY < Math.ceil(ZONE_SYSTEM.GAME_AREA.height / ZONE_SYSTEM.ZONE_SIZE)) {

                    const zoneRect = this.getZoneCoordinates(zoneX, zoneY);
                const distance = Math.max(Math.abs(dx), Math.abs(dy));

                if (distance === 0) ctx.fillStyle = window.BASE_ZONE_SYSTEM.CRITICAL_ZONE_COLOR;
                else ctx.fillStyle = window.BASE_ZONE_SYSTEM.PLAYER_BASE_COLOR;

                ctx.fillRect(zoneRect.x, zoneRect.y, zoneRect.width, zoneRect.height);

                    ctx.strokeStyle = distance === 0 ? 'rgba(255, 0, 0, 0.3)' : 'rgba(0, 255, 0, 0.2)';
                    ctx.lineWidth = 1;
                    ctx.strokeRect(zoneRect.x, zoneRect.y, zoneRect.width, zoneRect.height);
                    }
            }
        }
        ctx.restore();
    }

    isInBaseProtectedZone(x, y) {
        const zone = this.getZoneId(x, y);
        const baseZone = this.getBaseZone();
        const protectedRadius = BASE_ZONE_SYSTEM.PROTECTED_RADIUS;
        const distance = Math.max(Math.abs(zone.x - baseZone.x), Math.abs(zone.y - baseZone.y));
        return distance <= protectedRadius;
    }

    getZoneProtectionPriority(zoneX, zoneY) {
        const baseZone = this.getBaseZone();
        const protectedRadius = BASE_ZONE_SYSTEM.PROTECTED_RADIUS;
        const distance = Math.max(Math.abs(zoneX - baseZone.x), Math.abs(zoneY - baseZone.y));
        if (distance > protectedRadius) return 0;
        return protectedRadius - distance + 1;
    }

    // Вспомогательные методы
    getGiftSymbol(giftType) {
        const symbols = {
            'rose': '🌹',
            'coin': '🪙',
            'diamond': '💎',
            'cake': '🎂',
            'crown': '👑',
            'rocket': '🚀',
            'super_star': '⭐'
        };
        return symbols[giftType] || '🎁';
    }

    getGiftColor(giftType) {
        const colors = {
            'rose': '#FF69B4',
            'coin': '#FFD700',
            'diamond': '#00FFFF',
            'cake': '#FF6B6B',
            'crown': '#FFA500',
            'rocket': '#9370DB',
            'super_star': '#FFFF00'
        };
        return colors[giftType] || '#FFFFFF';
    }


    debugForceLevelComplete() {
        console.log('🔧 Принудительное завершение уровня (тест)');

        // Сбрасываем все флаги
        this.resetWindowState();

        // Устанавливаем условия завершения
        this.enemiesToSpawn = 0;
        this.enemiesDestroyed = this.totalEnemies || 20;

        // Очищаем врагов
        if (this.enemyManager) {
            this.enemyManager.enemies = [];
            this.enemyManager.spawnAnimations = [];
        }

        // Запускаем проверку завершения
        this.checkLevelCompletion();
    }

    resetAllTimers() {
        console.log('🔄 Сброс всех таймеров');

        // Останавливаем таймеры
        this.stopLevelCompleteCountdown();
        this.stopGameOverCountdown();

        // Сбрасываем элементы таймеров
        const levelTimer = document.getElementById('levelCompleteTimer');
        const gameOverTimer = document.getElementById('gameOverTimer');

        if (levelTimer) {
            levelTimer.style.display = 'none';
            const cancelBtn = levelTimer.querySelector('.cancel-timer-btn');
            if (cancelBtn) cancelBtn.style.display = 'block';
        }

        if (gameOverTimer) {
            gameOverTimer.style.display = 'none';
            const cancelBtn = gameOverTimer.querySelector('.cancel-timer-btn');
            if (cancelBtn) cancelBtn.style.display = 'block';
        }
    }
}

// === ГЛОБАЛЬНЫЕ ФУНКЦИИ ДЛЯ ВЗАИМОДЕЙСТВИЯ ===
window.testChat = (id, name, avatar, command) => {
    if (!game || !game.viewerSystem) {
        console.log('Игра или система зрителей не инициализирована');
        return;
    }

    const cleanCommand = command.toString().toLowerCase().trim();

    if (command === '!танк') {
        // ПРОВЕРКА НА ЗАВЕРШЕНИЕ РАУНДА ТОЛЬКО ДЛЯ ТАНКОВ
        if (game.levelComplete || game.gameOver) {
            console.log('🚫 Раунд завершен! Новые танки нельзя создавать.');
            return;
        }
        game.viewerSystem.spawnViewerTank(id, name, avatar);
    } else if (command.toLowerCase().includes('лайк') ||
        command.toLowerCase().includes('like') ||
        command.includes('❤️') ||
        command.includes('💖') ||
        command.includes('👍')) {
        // ЛАЙКИ РАЗРЕШЕНЫ В ЛЮБОЕ ВРЕМЯ
        game.viewerSystem.handleLikeFromViewer(id, name, command);
        } else if (command.toLowerCase().includes('подарок') ||
            command.toLowerCase().includes('gift') ||
            command.includes('🎁')) {
            // ПОДАРКИ РАЗРЕШЕНЫ В ЛЮБОЕ ВРЕМЯ
            game.viewerSystem.handleGiftFromViewer(id, name, command);
            } else if (command.toLowerCase().includes('лед') ||
                command.toLowerCase().includes('ice') ||
                command.toLowerCase().includes('мороз') ||
                command.toLowerCase().includes('freeze') ||
                command.toLowerCase().includes('холод') ||
                command.includes('❄️') ||
                command.includes('🌨️')) {
                // ПРОКЛЯТИЯ ЗАМОРОЗКИ РАЗРЕШЕНЫ В ЛЮБОЕ ВРЕМЯ
                game.viewerSystem.handleGiftFromViewer(id, name, command);
                } else if (command.toLowerCase().includes('череп') ||
                    command.toLowerCase().includes('skull') ||
                    command.toLowerCase().includes('проклятие') ||
                    command.toLowerCase().includes('curse') ||
                    command.toLowerCase().includes('смерть') ||
                    command.includes('💀') ||
                    command.includes('☠️')) {
                    // ПРОКЛЯТИЯ ЗАМОРОЗКИ РАЗРЕШЕНЫ В ЛЮБОЕ ВРЕМЯ
                    game.viewerSystem.handleGiftFromViewer(id, name, command);
                    } else {
                        console.log(`Неизвестная команда: ${command}`);
                    }
};

// === ИНИЦИАЛИЗАЦИЯ ИГРЫ ===
let game = null; // Глобальная переменная

document.addEventListener('DOMContentLoaded', () => {
    try {
        console.log('🚀 Инициализация игры...');
        game = new Game();
        console.log('✅ Игра успешно инициализирована');

        // Экспортируем глобально для отладки
        window.game = game;

    } catch (error) {
        console.error('❌ Ошибка инициализации игры:', error);
        alert('Ошибка запуска игры: ' + error.message);
    }
});

window.closeGameScreens = () => {
    console.log('🔴 Закрытие всех игровых окон');

    // Останавливаем все таймеры
    if (window.game) {
        if (window.game.stopLevelCompleteCountdown) {
            window.game.stopLevelCompleteCountdown();
        }
        if (window.game.stopGameOverCountdown) {
            window.game.stopGameOverCountdown();
        }
    }

    // Получаем элементы окон
    const levelComplete = document.getElementById('levelComplete');
    const gameOver = document.getElementById('gameOver');

    // Убираем класс force-visible
    if (levelComplete) {
        console.log('Закрываю окно levelComplete');
        levelComplete.classList.remove('force-visible');
        levelComplete.style.display = 'none';
    }

    if (gameOver) {
        console.log('Закрываю окно gameOver');
        gameOver.classList.remove('force-visible');
        gameOver.style.display = 'none';
    }

    // Убираем класс force-visible у всех похожих элементов
    document.querySelectorAll('.force-visible').forEach(el => {
        el.classList.remove('force-visible');
    });

    // НЕ скрываем таймеры здесь - они скроются вместе с родительскими окнами

    // Сбрасываем флаги показа
    if (window.game) {
        console.log('Сбрасываю флаги показа окон');
        window.game.showLevelCompleteScreen = false;
        window.game.showGameOverScreen = false;
    }

    console.log('✅ Окна закрыты');
};

window.restartGameFromDebug = () => {
    console.log('🔄 Перезапуск игры из дебаг-меню');

    // Сначала закрываем все окна
    window.closeGameScreens();

    // Ждем 100ms и перезапускаем
    setTimeout(() => {
        if (window.game) {
            console.log('Вызываю game.restartGame()');
            window.game.restartGame();
        } else {
            console.error('❌ game не определен!');
            alert('Игра не загружена. Обновите страницу (F5).');
        }
    }, 100);
};

window.goToNextLevelFromDebug = () => {
    console.log('🚀 Переход на следующий уровень из дебаг-меню');

    if (!window.game) {
        console.error('❌ game не определен!');
        alert('Игра не загружена. Обновите страницу (F5).');
        return;
    }

    // 🔥 УПРОЩЕННАЯ ЛОГИКА: Всегда прямой переход без статистики
    console.log('Прямой переход на следующий уровень');
    window.game.forceNextLevelSilent();
};

// 🔥 Функция для завершения уровня со статистикой (отдельная кнопка)
window.completeLevelWithStats = () => {
    console.log('✅ Завершение уровня со статистикой');

    if (!window.game) {
        console.error('❌ game не определен!');
        return;
    }

    if (window.game.levelComplete) {
        alert('Уровень уже завершен!');
        return;
    }

    // Завершаем текущий уровень
    window.game.completeCurrentLevel();
};

window.skipLevel = () => {
    console.log('⏭️ Быстрый пропуск уровня');

    if (!window.game) {
        console.error('❌ game не определен!');
        return;
    }

    // Прямой переход без вопросов
    window.game.forceNextLevelSilent();
};

window.testLevelComplete = () => {
    if (window.game) {
        window.game.debugForceLevelComplete();
    } else {
        alert('Игра не инициализирована');
    }
};

// Функция отмены автоматического перехода
window.cancelAutoTransition = (type) => {
    console.log(`⏹️ Отмена автоматического перехода для ${type}`);

    if (!window.game) return;

    // Останавливаем соответствующий таймер
    if (type === 'level') {
        window.game.stopLevelCompleteCountdown();
        const levelTimer = document.getElementById('levelCompleteTimer');
        if (levelTimer) {
            // Вместо скрытия элемента, просто показываем сообщение об отмене
            const timerText = levelTimer.querySelector('.timer-text');
            if (timerText) {
                timerText.innerHTML = '❌ Авто-переход отменен';
                timerText.style.color = '#FF4444';
            }

            // Скрываем кнопку отмены
            const cancelBtn = levelTimer.querySelector('.cancel-timer-btn');
            if (cancelBtn) {
                cancelBtn.style.display = 'none';
            }

            // Через 1.5 секунды скрываем таймер
            setTimeout(() => {
                if (levelTimer && levelTimer.parentElement) {
                    levelTimer.style.display = 'none';
                }
            }, 1500);
        }
    } else if (type === 'gameOver') {
        window.game.stopGameOverCountdown();
        const gameOverTimer = document.getElementById('gameOverTimer');
        if (gameOverTimer) {
            // Вместо скрытия элемента, просто показываем сообщение об отмене
            const timerText = gameOverTimer.querySelector('.timer-text');
            if (timerText) {
                timerText.innerHTML = '❌ Авто-переход отменен';
                timerText.style.color = '#FF4444';
            }

            // Скрываем кнопку отмены
            const cancelBtn = gameOverTimer.querySelector('.cancel-timer-btn');
            if (cancelBtn) {
                cancelBtn.style.display = 'none';
            }

            // Через 1.5 секунды скрываем таймер
            setTimeout(() => {
                if (gameOverTimer && gameOverTimer.parentElement) {
                    gameOverTimer.style.display = 'none';
                }
            }, 1500);
        }
    }

    console.log(`✅ Авто-переход отменен для ${type}`);
};
