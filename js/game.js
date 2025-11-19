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

        // ИНИЦИАЛИЗАЦИЯ debugInfo
        this.debugInfo = document.getElementById('debugInfo') || { textContent: '' };

        this.createDebugMenu();
        this.currentRoundEnemies = new Map();
        this.roundEnemiesList = [];
        this.totalEnemiesSpawned = 0;

        this.avatarCache = new Map(); // Кэш загруженных аватарок
        this.avatarLoadCallbacks = new Map(); // Колбэки для ожидающих загрузки
        this.delayedSpawns = [];

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

        this.exitTeleport = null;
        this.entryTeleport = null;
        this.playerEnteredLevel = true;

        this.playerStats = this.loadPlayerStats();
        this.initLevel();
    }

    // Метод для предзагрузки аватарки
    preloadAvatar(userId, avatarUrl) {
        if (!avatarUrl || this.avatarCache.has(userId)) return;

        console.log(`🔄 Предзагрузка аватарки для ${userId}`);
        const img = new Image();
        img.crossOrigin = "anonymous";

        img.onload = () => {
            console.log(`✅ Аватарка предзагружена для ${userId}`);
            this.avatarCache.set(userId, img);
            // Вызываем колбэки ожидающих танков
            if (this.avatarLoadCallbacks.has(userId)) {
                this.avatarLoadCallbacks.get(userId).forEach(callback => callback(img));
                this.avatarLoadCallbacks.delete(userId);
            }
        };

        img.onerror = () => {
            console.log(`❌ Ошибка предзагрузки аватарки для ${userId}`);
            this.avatarCache.set(userId, null); // Помечаем как неудачную загрузку
        };

        img.src = avatarUrl;
    }

    // Получить аватарку из кэша
    getCachedAvatar(userId) {
        return this.avatarCache.get(userId);
    }

    // Ожидание загрузки аватарки
    waitForAvatar(userId, callback) {
        if (this.avatarCache.has(userId)) {
            callback(this.avatarCache.get(userId));
        } else {
            if (!this.avatarLoadCallbacks.has(userId)) {
                this.avatarLoadCallbacks.set(userId, []);
            }
            this.avatarLoadCallbacks.get(userId).push(callback);
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
    }

    getAllRoundEnemies() {
        const enemies = [];
        this.currentRoundEnemies.forEach((trackedEnemy, username) => {
            let finalStats;
            if (trackedEnemy.finalStats) finalStats = trackedEnemy.finalStats;
            else if (trackedEnemy.enemy && trackedEnemy.enemy.levelStats) finalStats = trackedEnemy.enemy.levelStats;
            else finalStats = { shots: 0, wallsDestroyed: 0, playerKills: 0, baseDestroyed: false, totalScore: 0 };

            enemies.push({
                username: username,
                enemyType: trackedEnemy.enemy?.enemyType || 'BASIC',
                stats: finalStats,
                spawnTime: trackedEnemy.spawnTime,
                destroyed: trackedEnemy.destroyed || false,
                destroyTime: trackedEnemy.destroyTime
            });
        });
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
        if (this.frameCount % 60 === 0) this.updateDebugPerformance();
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

    updateDebugPerformance() {
        const fps = this.deltaTime > 0 ? Math.round(1000 / this.deltaTime) : 0;
        const enemies = this.enemyManager.enemies.length;
        const bullets = this.bullets.length;
        const effects = this.effectManager.explosions.length + this.effectManager.bulletExplosions.length;
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

    createExitTeleport() {
        const safeZones = [
            { x: CANVAS_WIDTH / 2, y: 80, width: CANVAS_WIDTH - 160, height: 60 },
            { x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT - 80, width: CANVAS_WIDTH - 160, height: 60 },
            { x: 80, y: CANVAS_HEIGHT / 2, width: 60, height: CANVAS_HEIGHT - 160 },
            { x: CANVAS_WIDTH - 80, y: CANVAS_HEIGHT / 2, width: 60, height: CANVAS_HEIGHT - 160 }
        ];

        const randomZone = safeZones[Math.floor(Math.random() * safeZones.length)];
        const x = randomZone.x - randomZone.width / 2 + Math.random() * randomZone.width;
        const y = randomZone.y - randomZone.height / 2 + Math.random() * randomZone.height;

        const tileX = Math.floor(x / TILE_SIZE);
        const tileY = Math.floor(y / TILE_SIZE);
        const isWall = tileX >= 0 && tileX < this.map.width && tileY >= 0 && tileY < this.map.height &&
        (this.map.grid[tileY][tileX] === TILE_TYPES.BRICK || this.map.grid[tileY][tileX] === TILE_TYPES.CONCRETE);

        if (isWall) this.exitTeleport = new Teleport(randomZone.x, randomZone.y, 'exit');
        else this.exitTeleport = new Teleport(x, y, 'exit');
    }

    createEntryTeleport(x, y) {
        const safePosition = this.ensureSafePosition(x, y);
        this.entryTeleport = new Teleport(safePosition.x, safePosition.y, 'entry');

        setTimeout(() => {
            if (this.entryTeleport) this.entryTeleport.startClosing();
        }, 1000);
    }

    ensureSafePosition(x, y) {
        const tileX = Math.floor(x / TILE_SIZE);
        const tileY = Math.floor(y / TILE_SIZE);
        const isWall = tileX >= 0 && tileX < this.map.width && tileY >= 0 && tileY < this.map.height &&
        (this.map.grid[tileY][tileX] === TILE_TYPES.BRICK || this.map.grid[tileY][tileX] === TILE_TYPES.CONCRETE);

        if (!isWall) return { x: x, y: y };

        const safeZones = [
            { x: CANVAS_WIDTH / 2, y: 80 },
            { x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT - 80 },
            { x: 80, y: CANVAS_HEIGHT / 2 },
            { x: CANVAS_WIDTH - 80, y: CANVAS_HEIGHT / 2 }
        ];

        let closestZone = safeZones[0];
        let minDistance = Infinity;

        safeZones.forEach(zone => {
            const distance = Math.sqrt(Math.pow(zone.x - x, 2) + Math.pow(zone.y - y, 2));
            if (distance < minDistance) {
                minDistance = distance;
                closestZone = zone;
            }
        });

        return closestZone;
    }

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

                this.updateDebugInfo();
    }

    setGameLevel(targetLevel) {
        this.level = targetLevel;
        this.initLevel();
        this.updateDebugInfo();
    }

    debugSpawnTestEnemy() {
        const spawnPoint = this.enemyManager.getNextSpawnPoint();
        this.enemyManager.spawnAnimations.push(new SpawnAnimation(spawnPoint.x, spawnPoint.y));
    }

    updateDebugInfo() {
        if (typeof this.level === 'undefined') this.level = 1;

        const currentAIElement = document.getElementById('debugCurrentAI');
        if (currentAIElement) {
            currentAIElement.textContent = this.level <= 4 ? 'Базовый' : 'Продвинутый';
        }

        const levelSelect = document.getElementById('debugLevelSelect');
        if (levelSelect) levelSelect.value = this.level.toString();

        const playerLevelElement = document.getElementById('debugPlayerLevel');
        const playerExpElement = document.getElementById('debugPlayerExp');
        const gameLevelElement = document.getElementById('debugGameLevel');
        const killsElement = document.getElementById('debugKills');
        const deathsElement = document.getElementById('debugDeaths');
        const levelsElement = document.getElementById('debugLevels');

        if (playerLevelElement) playerLevelElement.textContent = this.playerLevel || 1;
        if (playerExpElement) playerExpElement.textContent = this.playerExperience || 0;
        if (gameLevelElement) gameLevelElement.textContent = this.level || 1;
        if (killsElement && this.playerStats) {
            killsElement.textContent = this.playerStats.enemiesKilled;
            deathsElement.textContent = this.playerStats.deaths;
            levelsElement.textContent = this.playerStats.levelsCompleted;
        }
    }

    debugAddBonus(bonusType) {
        if (this.player.isDestroyed) return;
        switch(bonusType) {
            case 'SHIELD': this.player.activateShield(5000); break;
            case 'INVINCIBILITY': this.player.activateShield(10000); break;
            case 'AUTO_AIM': this.player.activateAutoAim(15000); break;
            case 'FORTIFY': this.fortifyBase(30000); break;
            case 'TIME_STOP': this.activateTimeStop(8000); break;
        }
        this.updateStatusIndicators();
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
        this.map = new GameMap(this.level);
        this.player = new Tank(224, 750);
        this.destroyedViewerTanks = new Set();

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
        this.updateDebugInfo();

        if (this.enemyManager) this.enemyManager.clearStats();
        this.enemyManager.clear();
        this.bonusManager.clear();
        this.effectManager.clear();

        this.bullets = [];
        this.screenShake = 0;
        this.baseFortified = false;
        this.baseFortifyTime = 0;
        this.baseFortifyDuration = 0;
        this.originalBaseWalls = [];
        this.levelLeader = null;

        this.enemiesDestroyed = 0;
        this.enemiesToSpawn = TOTAL_ENEMIES_PER_LEVEL;
        this.levelComplete = false;
        this.gameOver = false;
        this.showGameOverScreen = false;
        this.showLevelCompleteScreen = false;
        this.baseDestroyed = false;

        this.timeStopActive = false;
        this.timeStopStartTime = 0;
        this.timeStopDuration = 12000;
        this.timeResumePlayed = false;

        this.updateUI();
        this.updateStatusIndicators();
        this.soundManager.updateEngineSound(false, true);
        this.updatePlayerStats();

        document.getElementById('levelComplete').style.display = 'none';
        document.getElementById('gameOver').style.display = 'none';
        this.clearRoundTracker();
    }

    activateTimeStop() {
        if (this.timeStopActive) {
            this.timeResumePlayed = false;
            const newEndTime = Date.now() + this.timeStopDuration;

            // Замораживаем существующих врагов
            this.enemyManager.enemies.forEach(enemy => {
                if (enemy.isFrozen) {
                    // Продлеваем заморозку существующим врагам
                    enemy.freezeDuration = this.timeStopDuration;
                    enemy.freezeStartTime = Date.now();
                } else {
                    // Замораживаем новых врагов
                    enemy.freeze(this.timeStopDuration);
                }
            });

            // 🔥 ЗАМОРАЖИВАЕМ АНИМАЦИИ СПАВНА (но не отменяем их!)
            this.enemyManager.spawnAnimations.forEach(animation => {
                if (!animation.isFrozen) {
                    animation.freeze(this.timeStopDuration);
                }
            });

            this.timeStopStartTime = Date.now();
            return;
        }

        this.timeStopActive = true;
        this.timeStopStartTime = Date.now();
        this.timeResumePlayed = false;

        // Замораживаем всех врагов
        this.enemyManager.enemies.forEach(enemy => enemy.freeze(this.timeStopDuration));

        // 🔥 ЗАМОРАЖИВАЕМ АНИМАЦИИ СПАВНА
        this.enemyManager.spawnAnimations.forEach(animation => {
            animation.freeze(this.timeStopDuration);
        });

        if (this.soundManager) this.soundManager.playTimeStop();
    }

    update() {
        this.frameCount = this.frameCount || 0;
        if (this.frameCount % 2 === 0) this.updateInfrequentSystems();
        this.frameCount++;

        this.handleInput();

        if (this.exitTeleport && this.exitTeleport.active) this.checkTeleportEntry();
        if (this.exitTeleport) this.exitTeleport.update();
        if (this.entryTeleport) {
            this.entryTeleport.update();
            if (!this.entryTeleport.active) this.entryTeleport = null;
        }

        if (!this.playerEnteredLevel) this.checkPlayerEntry();
        else if (this.waitingForExit) this.checkPlayerExit();

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
            this.checkLevelCompletion();
        }

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
    }

    updateBullets() {
        if (this.bullets.length > 10) this.checkBulletCollisions();
        for (let i = this.bullets.length - 1; i >= 0; i--) {
            const bullet = this.bullets[i];
            bullet.deltaTime = this.deltaTime;
            bullet.update();
            if (!this.processBulletCollisions(bullet, i)) continue;
        }
    }

    checkBulletCollisions() {
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

    processBulletCollisions(bullet, index) {
        const destructionResult = this.map.checkBulletCollision(bullet);
        if (destructionResult) return this.handleBulletMapCollision(bullet, index, destructionResult);

        const bulletBounds = bullet.getBounds();
        if (bullet.owner === 'player') return this.handlePlayerBulletCollision(bullet, index, bulletBounds);
        else return this.handleEnemyBulletCollision(bullet, index, bulletBounds);

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

    handlePlayerBulletCollision(bullet, index, bulletBounds) {
        for (let j = this.enemyManager.enemies.length - 1; j >= 0; j--) {
            const enemy = this.enemyManager.enemies[j];
            if (bulletBounds.intersects(enemy.getBounds())) {
                const healthBefore = enemy.health;
                const isHeavyTank = enemy.enemyType === 'HEAVY';
                const isViewerTank = enemy.enemyType === 'VIEWER' || enemy.isViewerTank;
                const hadBonus = enemy.hasBonus;
                const bonusType = enemy.bonusType;
                const destructionResult = enemy.takeDamage();

                // ЗВУК ПРИ ПОПАДАНИИ В ТАНК С НЕСКОЛЬКИМИ ЖИЗНЯМИ
                if ((isViewerTank && healthBefore > 1 && enemy.health > 0) ||
                    (isHeavyTank && enemy.health > 0)) {
                    this.soundManager.play('heavyTankHit');
                this.effectManager.addHitEffect(enemy.position.x, enemy.position.y);

                    }

                    if (destructionResult === true || destructionResult === 'bonus') {
                        // ДОБАВЛЯЕМ В СПИСОК УНИЧТОЖЕННЫХ
                        if (isViewerTank) {
                            if (!this.destroyedViewerTanks) this.destroyedViewerTanks = new Set();
                            this.destroyedViewerTanks.add(enemy.userId);
                            console.log(`🗑️ Танк зрителя ${enemy.username} добавлен в список уничтоженных`);
                        }

                        this.markEnemyDestroyed(enemy);
                        this.effectManager.addExplosion(enemy.position.x, enemy.position.y, 'tank');
                        this.screenShake = enemy.enemyType === 'HEAVY' ? 25 : 20;
                        this.soundManager.play('tankExplosion');

                        if (isViewerTank) {
                            this.streamManager?.sendChatMessage(`💀 Танк зрителя ${enemy.username} был уничтожен!`);
                        } else {
                            this.recordEnemyKill();
                            this.player.addExperience(enemy.enemyType);
                            this.playerExperience = this.player.experience;
                            this.playerLevel = this.player.playerLevel;
                            this.savePlayerProgress();
                        }

                        if (hadBonus && bonusType) this.bonusManager.spawnBonusFromTank(enemy);
                        this.enemyManager.enemies.splice(j, 1);
                        this.enemiesDestroyed++;
                        this.score += 100;
                        this.updateUI();
                    }

                    this.bullets.splice(index, 1);
                    return false;
            }
        }
        return true;
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
        const currentDirection = this.getCurrentDirection();

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
        this.debugInfo.textContent = `Уровень: ${this.level} | Уничтожено: ${this.enemiesDestroyed}/${TOTAL_ENEMIES_PER_LEVEL} | Осталось заспавнить: ${this.enemiesToSpawn} | Бонусы: ${this.bonusManager.bonuses.length} | Танки с бонусами: ${bonusTanksCount} | FPS: ${Math.round(1000 / this.deltaTime)}` +
        (this.gameOver ? ' | ИГРА ОКОНЧЕНА' : '') + (this.levelComplete ? ' | УРОВЕНЬ ПРОЙДЕН' : '') + (this.baseDestroyed ? ' | БАЗА УНИЧТОЖЕНА' : '');
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

    checkLevelCompletion() {
        if ((this.playerEnteredLevel || this.level === 1) &&
            this.enemiesDestroyed >= TOTAL_ENEMIES_PER_LEVEL &&
            this.enemyManager.enemies.length === 0 &&
            this.enemyManager.spawnAnimations.length === 0 &&
            !this.levelComplete) {

            this.levelComplete = true;
        this.levelCompleteTimer = 0;

        // Сбрасываем данные зрителей
        this.resetForNewRound();

        setTimeout(() => {
            this.calculateLevelLeader();
            if (!this.levelLeader) this.findHonoraryLeader();
            this.showLevelCompleteStats = true;
            this.showLevelComplete();
        }, 1000);
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
        let leader = null;
        let maxScore = -1;

        allEnemies.forEach((enemyData) => {
            const stats = enemyData.stats;
            if (stats.baseDestroyed) {
                leader = { enemy: { username: enemyData.username, enemyType: enemyData.enemyType }, stats: stats };
                maxScore = stats.totalScore;
                return;
            }
        });

        if (!leader) {
            allEnemies.forEach((enemyData) => {
                const stats = enemyData.stats;
                const hasActivity = stats.shots > 0 || stats.wallsDestroyed > 0 || stats.playerKills > 0 || stats.baseDestroyed;
                if (stats.totalScore > maxScore && hasActivity) {
                    maxScore = stats.totalScore;
                    leader = { enemy: { username: enemyData.username, enemyType: enemyData.enemyType }, stats: stats };
                }
            });
        }

        if (!leader && allEnemies.length > 0) {
            const activeEnemies = allEnemies.filter(e => e.stats.shots > 0 || e.stats.wallsDestroyed > 0);
            if (activeEnemies.length > 0) {
                const randomEnemy = activeEnemies[Math.floor(Math.random() * activeEnemies.length)];
                leader = { enemy: { username: randomEnemy.username, enemyType: randomEnemy.enemyType }, stats: randomEnemy.stats };
            } else {
                const randomEnemy = allEnemies[Math.floor(Math.random() * allEnemies.length)];
                leader = { enemy: { username: randomEnemy.username, enemyType: randomEnemy.enemyType }, stats: randomEnemy.stats };
            }
        }

        this.levelLeader = leader;
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
        this.showLevelCompleteScreen = true;
        const levelCompleteElement = document.getElementById("levelComplete");
        if (levelCompleteElement) {
            document.getElementById("destroyedTanks").textContent = this.enemiesDestroyed;
            document.getElementById("levelScore").textContent = this.score;

            if (!this.levelLeader) this.calculateLevelLeader();
            this.showLevelLeaderStats();
            levelCompleteElement.style.display = "block";

            if (this.soundManager) this.soundManager.stopLoop("engineIdle");
        }
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

        if (!this.gameOver) this.createExitTeleport();
    }

    checkTeleportEntry() {
        if (!this.exitTeleport || !this.exitTeleport.active) return false;
        if (this.exitTeleport.isPlayerInside(this.player)) {
            const exitX = this.exitTeleport.position.x;
            const exitY = this.exitTeleport.position.y;
            this.exitTeleport.activate();
            this.exitTeleport.active = false;
            this.nextLevel(exitX, exitY);
            return true;
        }
        return false;
    }

    openRandomExit() {
        const exitTypes = [EXIT_TYPES.TOP, EXIT_TYPES.BOTTOM, EXIT_TYPES.LEFT, EXIT_TYPES.RIGHT];
        this.currentExit = exitTypes[Math.floor(Math.random() * exitTypes.length)];
        this.waitingForExit = true;
        this.exitAnimationProgress = 0;
        this.animateExitOpening();
    }

    animateExitOpening() {
        const animationDuration = EXIT_ANIMATION_DURATION;
        const startTime = Date.now();

        const animate = () => {
            const elapsed = Date.now() - startTime;
            this.exitAnimationProgress = Math.min(elapsed / animationDuration, 1);
            if (this.exitAnimationProgress < 1) requestAnimationFrame(animate);
        };
            animate();
    }

    calculateNextLevelExit() {
        if (!this.currentExit) return EXIT_TYPES.TOP;
        const oppositeExits = {
            [EXIT_TYPES.TOP]: EXIT_TYPES.BOTTOM,
            [EXIT_TYPES.BOTTOM]: EXIT_TYPES.TOP,
            [EXIT_TYPES.LEFT]: EXIT_TYPES.RIGHT,
            [EXIT_TYPES.RIGHT]: EXIT_TYPES.LEFT
        };
        return oppositeExits[this.currentExit];
    }

    checkPlayerExit() {
        if (!this.waitingForExit || !this.currentExit || this.player.isDestroyed) return false;
        const playerBounds = this.player.getBounds();
        let exited = false;

        switch (this.currentExit) {
            case EXIT_TYPES.TOP: exited = playerBounds.y + playerBounds.height < -10; break;
            case EXIT_TYPES.BOTTOM: exited = playerBounds.y > CANVAS_HEIGHT + 10; break;
            case EXIT_TYPES.LEFT: exited = playerBounds.x + playerBounds.width < -10; break;
            case EXIT_TYPES.RIGHT: exited = playerBounds.x > CANVAS_WIDTH + 10; break;
        }

        if (exited) {
            this.nextLevelExit = this.calculateNextLevelExit();
            this.nextLevel();
            return true;
        }
        return false;
    }

    checkPlayerEntry() {
        if (this.playerEnteredLevel || !this.nextLevelExit || this.player.isDestroyed) return false;
        const playerBounds = this.player.getBounds();
        let entered = false;

        switch (this.nextLevelExit) {
            case EXIT_TYPES.TOP: entered = playerBounds.y > TILE_SIZE; break;
            case EXIT_TYPES.BOTTOM: entered = playerBounds.y + playerBounds.height < CANVAS_HEIGHT - TILE_SIZE; break;
            case EXIT_TYPES.LEFT: entered = playerBounds.x > TILE_SIZE; break;
            case EXIT_TYPES.RIGHT: entered = playerBounds.x + playerBounds.width < CANVAS_WIDTH - TILE_SIZE; break;
        }

        if (entered) {
            this.playerEnteredLevel = true;
            this.nextLevelExit = null;
            this.closeExit();
        }
        return entered;
    }

    closeExit() {
        this.currentExit = null;
        this.waitingForExit = false;
        this.exitAnimationProgress = 0;
    }

    showGameOver() {
        this.showGameOverScreen = true;
        const gameOverScreen = document.getElementById('gameOver');

        document.getElementById('finalScore').textContent = this.score;
        document.getElementById('finalLevel').textContent = this.level;

        this.calculateLevelLeader();
        if (!this.levelLeader) this.findHonoraryLeader();
        this.showGameOverLeaderStats();

        setTimeout(() => this.forceShowGameOverStats(), 100);
        gameOverScreen.style.display = 'block';

        if (this.soundManager) {
            this.soundManager.stopLoop('engineIdle');
            this.soundManager.stopLoop('engineMoving');
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
        const tankIcon = {BASIC:"🔴", FAST:"🟡", HEAVY:"🟣", SNIPER:"🟢"}[leader.enemy.enemyType] || "⚫";

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

        if (exitX !== null && exitY !== null) {
            this.createEntryTeleport(exitX, exitY);
            this.placePlayerAtTeleport(exitX, exitY);
        }
    }

    placePlayerAtTeleport(teleportX, teleportY) {
        this.player.position.x = teleportX;
        this.player.position.y = teleportY;
        this.player.activateShield(3000);
    }

    placePlayerNearEntry(entryPosition) {
        const offset = 80;
        const centerX = CANVAS_WIDTH / 2;
        const centerY = CANVAS_HEIGHT / 2;
        const directionX = entryPosition.x - centerX;
        const directionY = entryPosition.y - centerY;
        const length = Math.sqrt(directionX * directionX + directionY * directionY);
        const normalizedX = directionX / length;
        const normalizedY = directionY / length;

        this.player.position.x = entryPosition.x + normalizedX * offset;
        this.player.position.y = entryPosition.y + normalizedY * offset;
        this.player.direction = this.calculateDirectionToCenter(this.player.position);
        this.player.activateShield(3000);
    }

    calculateDirectionToCenter(position) {
        const centerX = CANVAS_WIDTH / 2;
        const centerY = CANVAS_HEIGHT / 2;
        const dx = centerX - position.x;
        const dy = centerY - position.y;
        if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? DIRECTIONS.RIGHT : DIRECTIONS.LEFT;
        else return dy > 0 ? DIRECTIONS.DOWN : DIRECTIONS.UP;
    }

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
        this.player.activateShield(3000);
    }

    restartGame() {
        if (confirm('Начать новую игру? Весь прогресс будет сброшен.')) {
            try {
                this.clearAllLevelStats();
                this.levelLeader = null;

                const levelComplete = document.getElementById('levelComplete');
                const gameOver = document.getElementById('gameOver');
                const levelLeaderStats = document.getElementById('levelLeaderStats');
                const gameOverLeaderStats = document.getElementById('gameOverLeaderStats');

                if (levelComplete) levelComplete.style.display = 'none';
                if (gameOver) gameOver.style.display = 'none';
                if (levelLeaderStats) levelLeaderStats.style.display = 'none';
                if (gameOverLeaderStats) gameOverLeaderStats.style.display = 'none';

            } catch (error) {
                console.log("⚠️ Ошибка при скрытии элементов:", error);
            }

            this.resetPlayerProgress();
            this.level = 1;
            this.score = 0;
            this.lives = 3;
            this.gameOver = false;
            this.baseDestroyed = false;
            this.showGameOverScreen = false;
            this.levelComplete = false;
            this.showLevelCompleteScreen = false;

            this.clearRoundTracker();

            if (this.soundManager) {
                this.soundManager.stopLoop('engineIdle');
                this.soundManager.stopLoop('engineMoving');
            }

            this.initLevel();
        }
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
        document.getElementById('tanksLeft').textContent = TOTAL_ENEMIES_PER_LEVEL - this.enemiesDestroyed;
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

        // Отрисовываем всплывающие тексты
        this.drawFloatingTexts(this.ctx);

        this.enemyManager.enemies.forEach(enemy => enemy.draw(this.ctx));
        this.bullets.forEach(bullet => bullet.draw(this.ctx));
        this.effectManager.explosions.forEach(explosion => explosion.draw(this.ctx));
        this.effectManager.bulletExplosions.forEach(explosion => explosion.draw(this.ctx));

        this.map.drawGrassOverlay(this.ctx);

        if (this.exitTeleport && this.exitTeleport.active) this.exitTeleport.draw(this.ctx);
        if (this.entryTeleport) this.entryTeleport.draw(this.ctx);

        this.renderUIOverlays();
        this.drawPlayerStats(this.ctx);

        if (this.debugShowVision) this.drawDebugVision(this.ctx);
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

            this.ctx.fillStyle = '#FF4444';
            this.ctx.font = '24px Courier New';
            this.ctx.textAlign = 'center';
            this.ctx.fillText('БАЗА УНИЧТОЖЕНА!', this.canvas.width / 2, this.canvas.height / 2 - 20);
            this.ctx.font = '16px Courier New';
            this.ctx.fillText('Миссия провалена', this.canvas.width / 2, this.canvas.height / 2 + 10);
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

    spawnViewerTank(userId, username, avatarUrl) {
        // ПРОВЕРКА НА ЗАВЕРШЕНИЕ РАУНДА
        if (this.levelComplete || this.gameOver) {
            console.log('🚫 Раунд завершен! Новые танки нельзя создавать.');
            return;
        }

        // ПРОВЕРКА НА ДУБЛИКАТ
        const existingViewerTank = this.enemyManager.enemies.find(enemy =>
        (enemy.enemyType === 'VIEWER' || enemy.isViewerTank) && enemy.userId === userId
        );

        if (existingViewerTank) {
            console.log(`🎮 Танк зрителя ${username} (ID: ${userId}) уже существует в этом раунде!`);
            return;
        }

        // ДОПОЛНИТЕЛЬНАЯ ПРОВЕРКА - в глобальном списке уничтоженных за раунд
        if (this.destroyedViewerTanks && this.destroyedViewerTanks.has(userId)) {
            console.log(`🎮 Танк зрителя ${username} (ID: ${userId}) уже был уничтожен в этом раунде!`);
            return;
        }

        const spawnPoint = this.enemyManager.getNextSpawnPoint();

        // Создаем анимацию спавна
        const spawnAnimation = new SpawnAnimation(spawnPoint.x, spawnPoint.y);
        this.enemyManager.spawnAnimations.push(spawnAnimation);

        // ПРЕДЗАГРУЗКА АВАТАРКИ
        if (avatarUrl && avatarUrl !== '') {
            this.preloadAvatar(userId, avatarUrl);
        }

        // Сохраняем оригинальный метод
        const originalComplete = this.enemyManager.completeSpawnAnimation.bind(this.enemyManager);

        // Временно заменяем метод completeSpawnAnimation
        this.enemyManager.completeSpawnAnimation = (position) => {
            // Восстанавливаем оригинальный метод
            this.enemyManager.completeSpawnAnimation = originalComplete;

            // ФИНАЛЬНАЯ ПРОВЕРКА ПЕРЕД СОЗДАНИЕМ ТАНКА
            const duplicateCheck = this.enemyManager.enemies.find(enemy =>
            (enemy.enemyType === 'VIEWER' || enemy.isViewerTank) && enemy.userId === userId
            );

            if (duplicateCheck) {
                console.log(`🎮 Танк зрителя ${username} (ID: ${userId}) уже создан! Отмена спавна.`);
                return;
            }

            if (this.destroyedViewerTanks && this.destroyedViewerTanks.has(userId)) {
                console.log(`🎮 Танк зрителя ${username} (ID: ${userId}) был уничтожен! Отмена спавна.`);
                return;
            }

            // Создаем танк зрителя
            const viewerTank = new Tank(position.x, position.y, "enemy", this.level, 'VIEWER');

            // Кастомизация для зрителя
            viewerTank.username = username;
            viewerTank.userId = userId;
            viewerTank.avatarUrl = avatarUrl;
            viewerTank.viewerName = username;
            viewerTank.color = this.getViewerColor(userId);
            viewerTank.health = 2;
            viewerTank.isViewerTank = true;

            // ОПТИМИЗИРОВАННАЯ ЗАГРУЗКА АВАТАРКИ
            this.setupViewerTankAvatar(viewerTank, userId, avatarUrl);

            // 🔥 ВАЖНО: ПРИМЕНЯЕМ ЭФФЕКТ "СТОП-ВРЕМЕНИ" ЕСЛИ ОН АКТИВЕН
            if (this.timeStopActive) {
                const remainingTime = this.timeStopDuration - (Date.now() - this.timeStopStartTime);
                if (remainingTime > 0) {
                    viewerTank.freeze(remainingTime);
                    console.log(`⏰ Танк зрителя ${username} заморожен на ${remainingTime}мс`);
                }
            }

            // Добавляем в список врагов
            this.enemyManager.enemies.push(viewerTank);

            console.log(`🎮 Танк зрителя "${username}" создан через анимацию`);

            // Визуальный эффект
            this.effectManager.addExplosion(position.x, position.y, 'bonus');
            this.screenShake = 10;
        };

        let spawnDelay = 3000; // 🔥 Теперь 3 секунды (было 500)

        if (this.timeStopActive) {
            spawnDelay = 3500; // Немного больше при стоп-времени
            console.log(`⏰ Анимация спавна танка ${username} замедлена из-за стоп-времени`);
        }

        // Устанавливаем таймер для завершения анимации
        setTimeout(() => {
            const index = this.enemyManager.spawnAnimations.indexOf(spawnAnimation);
            if (index !== -1) {
                this.enemyManager.spawnAnimations.splice(index, 1);

                // Проверяем, не закончилось ли стоп-время пока шла анимация
                if (!this.timeStopActive) {
                    this.enemyManager.completeSpawnAnimation(spawnPoint);
                } else {
                    // Если время все еще остановлено, откладываем создание танка
                    console.log(`⏰ Откладываем создание танка ${username} до окончания стоп-времени`);
                    this.delayedSpawn = {
                        point: spawnPoint,
                        callback: () => this.enemyManager.completeSpawnAnimation(spawnPoint)
                    };
                }
            }
        }, spawnDelay);
    }

    // Новый метод для настройки аватарки
    setupViewerTankAvatar(tank, userId, avatarUrl) {
        tank.avatarLoaded = false;
        tank.avatarError = false;

        if (!avatarUrl || avatarUrl === '') {
            tank.avatarError = true;
            return;
        }

        // Пытаемся использовать кэшированную аватарку
        const cachedAvatar = this.getCachedAvatar(userId);
        if (cachedAvatar) {
            console.log(`✅ Используем кэшированную аватарку для ${tank.username}`);
            tank.avatarImage = cachedAvatar;
            tank.avatarLoaded = true;
        } else if (cachedAvatar === null) {
            // Помечаем как ошибку если загрузка ранее не удалась
            tank.avatarError = true;
        } else {
            // Ждем загрузки аватарки
            console.log(`⏳ Ожидаем загрузку аватарки для ${tank.username}`);
            this.waitForAvatar(userId, (loadedAvatar) => {
                if (loadedAvatar) {
                    tank.avatarImage = loadedAvatar;
                    tank.avatarLoaded = true;
                    console.log(`✅ Аватарка загружена для ${tank.username}`);
                } else {
                    tank.avatarError = true;
                    console.log(`❌ Аватарка не загрузилась для ${tank.username}`);
                }
            });
        }
    }

    // Генерируем уникальный цвет на основе ID пользователя
    getViewerColor(userId) {
        const colors = [
            '#FF69B4', // Розовый
            '#9370DB', // Фиолетовый
            '#00CED1', // Бирюзовый
            '#32CD32', // Лаймовый
            '#FFD700', // Золотой
            '#FF6347', // Томатный
            '#1E90FF', // Голубой
            '#FF8C00'  // Оранжевый
        ];

        // Простой хэш для получения индекса цвета
        let hash = 0;
        for (let i = 0; i < userId.length; i++) {
            hash = ((hash << 5) - hash) + userId.charCodeAt(i);
            hash = hash & hash;
        }

        return colors[Math.abs(hash) % colors.length];
    }

    handleLikeFromViewer(userId, username, message) {
        if (!this.player || this.player.isDestroyed) {
            console.log(`💖 ${username} лайкнул, но игрок уничтожен`);
            return;
        }

        // Добавляем опыт игроку за лайк
        const expGained = 5; // Опыт за лайк
        this.player.experience += expGained;
        this.playerExperience = this.player.experience;

        // Проверяем уровень ап
        const levelBefore = this.player.playerLevel;
        this.player.checkLevelUp();
        const levelAfter = this.player.playerLevel;

        // Визуальный эффект с именем отправителя
        const likeText = levelAfter > levelBefore
        ? `УРОВЕНЬ ${levelAfter}! ⭐`
        : `+${expGained} XP 💖`;

        this.createFloatingText(
            this.player.position.x,
            this.player.position.y - 20,
            `${username}: ${likeText}`,
            '#FF69B4'
        );

        // Дополнительный эффект при уровнепе
        if (levelAfter > levelBefore) {
            this.effectManager.addExplosion(this.player.position.x, this.player.position.y, 'bonus');
            this.screenShake = 15;
            console.log(`⭐ Игрок достиг уровня ${levelAfter}! Спасибо ${username} за лайки!`);
        }

        console.log(`💖 ${username} лайкнул! Игрок получает +${expGained} опыта!`);

        // Сохраняем прогресс
        this.savePlayerProgress();
        this.updatePlayerStats();
    }

    createFloatingText(x, y, text, color = '#FFFFFF') {
        if (!this.floatingTexts) this.floatingTexts = [];

        this.floatingTexts.push({
            x: x,
            y: y,
            text: text,
            color: color,
            lifetime: 120, // 2 секунды при 60 FPS
            alpha: 1.0,
            velocity: new Vector2(0, -1.5), // Двигается вверх
                                scale: 1.0
        });
    }

    drawFloatingTexts(ctx) {
        if (!this.floatingTexts || this.floatingTexts.length === 0) return;

        ctx.save();

        this.floatingTexts.forEach(text => {
            // Тень
            ctx.fillStyle = 'rgba(0, 0, 0, ' + (text.alpha * 0.7) + ')';
            ctx.font = `bold ${text.fontSize || 16}px Arial`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(text.text, text.x + 2, text.y + 2);

            // Основной текст
            ctx.fillStyle = text.color.replace(')', ', ' + text.alpha + ')').replace('rgb', 'rgba');
            ctx.fillText(text.text, text.x, text.y);
        });

        ctx.restore();
    }

    resetForNewRound() {
        // Очищаем всплывающие тексты
        if (this.floatingTexts) {
            this.floatingTexts = [];
        }

        // Можно также очистить другие данные зрителей при необходимости
        console.log('🔄 Данные зрителей сброшены для нового раунда');
    }

    handlePowerupGift(userId, username, giftType, giftConfig) {
        // Создаем бонус на карте используя существующий тип
        const position = this.bonusManager.findFreeBonusPosition();
        if (position) {
            const bonus = new Bonus(
                position.x,
                position.y,
                giftConfig.bonusType, // Используем существующий тип бонуса
                this
            );

            // Увеличиваем время жизни бонуса
            bonus.lifetime = 15000;
            bonus.giftedBy = username; // Добавляем информацию о дарителе

            this.bonusManager.bonuses.push(bonus);
        }

        // Визуальный эффект и сообщение
        if (!this.floatingTexts) this.floatingTexts = [];
        this.floatingTexts.push({
            x: this.player.position.x,
            y: this.player.position.y,
            text: `${giftConfig.message} ${username}`,
            color: this.getGiftColor(giftType),
                                lifetime: 120,
                                alpha: 1.0,
                                velocity: { x: 0, y: -1.2 },
                                scale: 1.0
        });

        this.screenShake = 8;
        this.soundManager.play('bonusPickup');

        console.log(`🎁 Создан бонус ${giftConfig.bonusType.id} от ${username}`);
    }

    handleGiftFromViewer(userId, username, message) {
        if (!this.player || this.player.isDestroyed) {
            console.log(`🎁 ${username} отправил подарок, но игрок уничтожен`);
            return;
        }

        // Определяем тип подарка из сообщения
        const giftType = this.detectGiftType(message);

        if (!giftType) {
            // Случайный бонус за неузнанный подарок
            this.handleRandomGift(userId, username);
            return;
        }

        const giftConfig = GIFT_BONUSES[giftType];
        if (!giftConfig) {
            this.handleRandomGift(userId, username);
            return;
        }

        console.log(`🎁 ${username} отправил подарок: ${giftType}`);

        // Все подарки создают бонусы на карте
        this.handlePowerupGift(userId, username, giftType, giftConfig);
    }

    // Определение типа подарка по сообщению
    detectGiftType(message) {
        const cleanMessage = message.toLowerCase();

        for (const [giftKey, keywords] of Object.entries(GIFT_TYPES)) {
            if (keywords.some(keyword => cleanMessage.includes(keyword))) {
                return giftKey;
            }
        }

        return null;
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

    handleRandomGift(userId, username) {
        const randomGifts = ['rose', 'coin', 'diamond', 'cake'];
        const randomGift = randomGifts[Math.floor(Math.random() * randomGifts.length)];
        const giftConfig = GIFT_BONUSES[randomGift];

        this.handlePowerupGift(userId, username, randomGift, giftConfig);
    }
} // ← ЭТА скобка закрывает класс Game

// Глобальная функция для тестирования чата - ВНЕ класса Game
window.testChat = (id, name, avatar, command) => {
    if (!game) {
        console.log('Игра не инициализирована');
        return;
    }

    if (command === '!танк') {
        game.spawnViewerTank(id, name, avatar);
    } else {
        console.log(`Неизвестная команда: ${command}`);
    }
};

// Глобальная функция для тестирования чата - ВНЕ класса Game
window.testChat = (id, name, avatar, command) => {
    if (!game) {
        console.log('Игра не инициализирована');
        return;
    }

    // ПРОВЕРКА НА ЗАВЕРШЕНИЕ РАУНДА
    if (game.levelComplete || game.gameOver) {
        console.log('🚫 Раунд завершен! Новые танки нельзя создавать.');
        return;
    }

    const cleanCommand = command.toString().toLowerCase().trim();

    if (command === '!танк') {
        game.spawnViewerTank(id, name, avatar);
    } else if (command.toLowerCase().includes('лайк') ||
        command.toLowerCase().includes('like') ||
        command.includes('❤️') ||
        command.includes('💖') ||
        command.includes('👍')) {
        game.handleLikeFromViewer(id, name, command);
        } else if (command.toLowerCase().includes('подарок') ||
            command.toLowerCase().includes('gift') ||
            command.includes('🎁')) {
            game.handleGiftFromViewer(id, name, command);
            } else {
                console.log(`Неизвестная команда: ${command}`);
            }
};
