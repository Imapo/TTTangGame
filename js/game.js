// === ОПТИМИЗИРОВАННЫЙ КЛАСС ИГРЫ ===
class Game {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');

        // Инициализация менеджеров
        this.enemyManager = new EnemyManager(this);
        this.bonusManager = new BonusManager(this);
        this.effectManager = new EffectManager(this);

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

        this.initLevel();
    }

    initLevel() {
        this.map = new GameMap(this.level);
        this.player = new Tank(224, 750);

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
        this.timeStopDuration = 12000; // 12 секунд
        this.timeResumePlayed = false; // Флаг чтобы звук не повторялся

        this.updateUI();
        this.updateStatusIndicators();
        this.soundManager.updateEngineSound(false, true);

        document.getElementById('levelComplete').style.display = 'none';
        document.getElementById('gameOver').style.display = 'none';
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
        this.enemyManager.update();
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

    handlePlayerBulletCollision(bullet, index, bulletBounds) {
        for (let j = this.enemyManager.enemies.length - 1; j >= 0; j--) {
            const enemy = this.enemyManager.enemies[j];
            if (bulletBounds.intersects(enemy.getBounds())) {

                const healthBefore = enemy.health;
                const isHeavyTank = enemy.enemyType === 'HEAVY';

                // Сохраняем информацию о бонусе до уничтожения
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

                    // Если танк имел бонус - создаем его
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

    nextLevel() {
        this.level++;
        this.initLevel();
    }

    restartGame() {
        this.level = 1;
        this.score = 0;
        this.lives = 3;
        this.soundManager.stopAll();
        this.initLevel();
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

        this.renderUIOverlays();

        // Восстанавливаем контекст
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
