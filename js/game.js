// === ОСНОВНОЙ КЛАСС ИГРЫ ===
class Game {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
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
        this.shieldIndicator = document.getElementById('shieldIndicator');
        this.shieldTime = document.getElementById('shieldTime');
        this.lastTime = 0;
        this.deltaTime = 0;
        this.directionPriority = null;

        this.enemiesDestroyed = 0;
        this.totalEnemies = TOTAL_ENEMIES_PER_LEVEL;
        this.enemiesToSpawn = TOTAL_ENEMIES_PER_LEVEL;
        this.lastRespawnTime = Date.now();

        this.explosions = [];
        this.bulletExplosions = [];
        this.spawnAnimations = [];
        this.bonuses = []; // НОВОЕ: массив бонусов
        this.screenShake = 0;

        this.currentSpawnIndex = 0;

        this.soundManager = new SoundManager();
        this.isPlayerMoving = false;
        this.lastPlayerPosition = new Vector2(0, 0);
        this.leaderboard = this.loadLeaderboard();
        this.showFullLeaderboard = false;
        this.updateLeaderboardUI();
        this.usedEnemyNames = new Set();

        this.initLevel();
        this.setupEventListeners();
        this.gameLoop(0);
    }

    initLevel() {
        this.map = new GameMap(this.level);
        this.player = new Tank(224, 750);
        this.enemies = [];
        this.bullets = [];
        this.explosions = [];
        this.bulletExplosions = [];
        this.spawnAnimations = [];
        this.bonuses = []; // НОВОЕ: очищаем бонусы
        this.screenShake = 0;

        this.enemiesDestroyed = 0;
        this.enemiesToSpawn = TOTAL_ENEMIES_PER_LEVEL;
        this.lastRespawnTime = Date.now();
        this.levelComplete = false;
        this.gameOver = false;
        this.showGameOverScreen = false;
        this.showLevelCompleteScreen = false;
        this.baseDestroyed = false;

        this.currentSpawnIndex = 0;
        this.usedEnemyNames.clear();

        this.updateUI();
        this.updateShieldIndicator();
        this.soundManager.updateEngineSound(false, true);

        document.getElementById('levelComplete').style.display = 'none';
        document.getElementById('gameOver').style.display = 'none';
    }

    // НОВЫЙ МЕТОД: Создание бонуса в случайном месте
    spawnBonusFromTank(destroyedTank) {
        if (!destroyedTank.hasBonus || !destroyedTank.bonusType) {
            return;
        }

        const position = this.findFreeBonusPosition();
        if (position) {
            console.log(`🎁 Создаем бонус ${destroyedTank.bonusType.id} из танка ${destroyedTank.username}`);
            this.bonuses.push(new Bonus(position.x, position.y, destroyedTank.bonusType));
        }
    }

    // НОВЫЙ МЕТОД: Поиск свободной позиции для бонуса
    findFreeBonusPosition() {
        const attempts = 50;

        for (let i = 0; i < attempts; i++) {
            const x = Math.floor(Math.random() * (24 - 4) + 2) * TILE_SIZE + TILE_SIZE/2;
            const y = Math.floor(Math.random() * (24 - 8) + 4) * TILE_SIZE + TILE_SIZE/2;

            const position = new Vector2(x, y);
            const bonusBounds = new Rectangle(
                x - TILE_SIZE/2,
                y - TILE_SIZE/2,
                TILE_SIZE,
                TILE_SIZE
            );

            if (!this.map.checkCollision(bonusBounds) &&
                !this.checkTankCollision(bonusBounds) &&
                !this.checkBonusCollision(position)) {
                return position;
                }
        }

        return null;
    }

    // НОВЫЙ МЕТОД: Проверка столкновения с танками
    checkTankCollision(bounds) {
        if (!this.player.isDestroyed && bounds.intersects(this.player.getBounds())) {
            return true;
        }

        for (const enemy of this.enemies) {
            if (bounds.intersects(enemy.getBounds())) {
                return true;
            }
        }

        return false;
    }

    // НОВЫЙ МЕТОД: Проверка столкновения с другими бонусами
    checkBonusCollision(position) {
        for (const bonus of this.bonuses) {
            const distance = Math.sqrt(
                Math.pow(bonus.position.x - position.x, 2) +
                Math.pow(bonus.position.y - position.y, 2)
            );
            if (distance < TILE_SIZE * 2) {
                return true;
            }
        }
        return false;
    }

    // НОВЫЙ МЕТОД: Обновление бонусов
    updateBonuses() {
        for (let i = this.bonuses.length - 1; i >= 0; i--) {
            const bonus = this.bonuses[i];

            if (!bonus.update()) {
                this.bonuses.splice(i, 1);
                continue;
            }

            // Проверка подбора игроком
            if (!this.player.isDestroyed &&
                bonus.getBounds().intersects(this.player.getBounds())) {
                bonus.applyBonus(this);
            this.bonuses.splice(i, 1);
                }
        }
    }

    // Остальные методы...
    getNextSpawnPoint() {
        const point = SPAWN_POINTS[this.currentSpawnIndex];
        this.currentSpawnIndex = (this.currentSpawnIndex + 1) % SPAWN_POINTS.length;
        return point;
    }

    spawnEnemy() {
        if (this.enemiesToSpawn <= 0) return null;

        const spawnPoint = this.getNextSpawnPoint();

        this.spawnAnimations.push(new SpawnAnimation(spawnPoint.x, spawnPoint.y));
        this.showSpawnNotification();

        this.enemiesToSpawn--;
        this.updateUI();

        return spawnPoint;
    }

    getRandomEnemyType() {
        const random = Math.random();
        let cumulativeChance = 0;

        for (const [type, config] of Object.entries(ENEMY_TYPES)) {
            cumulativeChance += config.chance;
            if (random <= cumulativeChance) {
                return type;
            }
        }

        return 'BASIC';
    }

    generateUniqueEnemyName(enemyType) {
        const names = ENEMY_NAMES[enemyType] || ['Враг'];
        let availableNames = names.filter(name => !this.usedEnemyNames.has(name));

        if (availableNames.length === 0) {
            for (let i = 1; i <= 100; i++) {
                const numberedName = `${names[0]} ${i}`;
                if (!this.usedEnemyNames.has(numberedName)) {
                    availableNames.push(numberedName);
                    break;
                }
            }
        }

        if (availableNames.length === 0) {
            const uniqueName = `${names[0]} ${Date.now()}`;
            availableNames.push(uniqueName);
        }

        const selectedName = availableNames[Math.floor(Math.random() * availableNames.length)];
        this.usedEnemyNames.add(selectedName);

        return selectedName;
    }

    completeSpawnAnimation(spawnPoint) {
        const enemyType = this.getRandomEnemyType();
        const uniqueName = this.generateUniqueEnemyName(enemyType);

        const enemy = new Tank(spawnPoint.x, spawnPoint.y, 'enemy', this.level, enemyType);
        enemy.direction = DIRECTIONS.DOWN;
        enemy.username = uniqueName;

        this.enemies.push(enemy);
    }

    showSpawnNotification() {
        const notification = document.getElementById('spawnNotification');
        notification.style.display = 'block';
        setTimeout(() => {
            notification.style.display = 'none';
        }, 2000);
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
        const allTanks = [this.player, ...this.enemies];
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
            const bullet = this.player.shoot();
            if (bullet) {
                this.bullets.push(bullet);
                this.soundManager.play('playerShot');
            }
        }

        // ОБНОВЛЯЕМ дебаг информацию
        const bonusTanksCount = this.enemies.filter(enemy => enemy.hasBonus).length;
        this.debugInfo.textContent =
        `Уровень: ${this.level} | Уничтожено: ${this.enemiesDestroyed}/${TOTAL_ENEMIES_PER_LEVEL} | ` +
        `Осталось заспавнить: ${this.enemiesToSpawn} | Бонусы: ${this.bonuses.length} | ` +
        `Танки с бонусами: ${bonusTanksCount} | FPS: ${Math.round(1000 / this.deltaTime)}` +
        (this.gameOver ? ' | ИГРА ОКОНЧЕНА' : '') +
        (this.levelComplete ? ' | УРОВЕНЬ ПРОЙДЕН' : '') +
        (this.baseDestroyed ? ' | БАЗА УНИЧТОЖЕНА' : '');
    }

    updateBullets() {
        for (let i = this.bullets.length - 1; i >= 0; i--) {
            for (let j = this.bullets.length - 1; j > i; j--) {
                if (this.bullets[i].owner !== this.bullets[j].owner &&
                    this.bullets[i].getBounds().intersects(this.bullets[j].getBounds())) {
                    this.bulletExplosions.push(new BulletExplosion(this.bullets[i].position.x, this.bullets[i].position.y));
                this.bullets.splice(i, 1);
                this.bullets.splice(j, 1);
                this.soundManager.play('bulletCollision');
                break;
                    }
            }
        }

        for (let i = this.bullets.length - 1; i >= 0; i--) {
            const bullet = this.bullets[i];
            bullet.update();

            const destructionResult = this.map.checkBulletCollision(bullet);
            if (destructionResult) {
                if (destructionResult === 'base') {
                    this.explosions.push(new Explosion(bullet.position.x, bullet.position.y, 'base'));
                    this.screenShake = 30;
                    this.soundManager.play('baseExplosion');
                    if (!this.gameOver) {
                        this.gameOver = true;
                        this.baseDestroyed = true;
                        this.showGameOverScreen = true;
                        this.showGameOver();
                    }
                    this.bullets.splice(i, 1);
                }
                else if (destructionResult === 'concrete') {
                    this.bulletExplosions.push(new BulletExplosion(bullet.position.x, bullet.position.y));
                    this.bullets.splice(i, 1);
                    this.soundManager.play('bulletHit');
                }
                else if (destructionResult === 'brick') {
                    this.bulletExplosions.push(new BulletExplosion(bullet.position.x, bullet.position.y));
                    this.bullets.splice(i, 1);
                    this.soundManager.play('brickHit');
                }
                continue;
            }

            const bulletBounds = bullet.getBounds();

            if (bullet.owner === 'player') {
                for (let j = this.enemies.length - 1; j >= 0; j--) {
                    const enemy = this.enemies[j];
                    if (bulletBounds.intersects(enemy.getBounds())) {

                        const healthBefore = enemy.health;
                        const isHeavyTank = enemy.enemyType === 'HEAVY';

                        // НОВОЕ: Сохраняем информацию о бонусе до уничтожения
                        const hadBonus = enemy.hasBonus;
                        const bonusType = enemy.bonusType;

                        const destructionResult = enemy.takeDamage();

                        if (destructionResult === true || destructionResult === 'bonus') {
                            this.explosions.push(new Explosion(enemy.position.x, enemy.position.y, 'tank'));
                            this.screenShake = 10;
                            this.soundManager.play('tankExplosion');

                            // НОВОЕ: Если танк имел бонус - создаем его
                            if (hadBonus && bonusType) {
                                this.spawnBonusFromTank(enemy);
                            }

                            this.enemies.splice(j, 1);
                            this.enemiesDestroyed++;
                            this.score += 100;
                            this.updateUI();
                        } else {
                            if (isHeavyTank && enemy.health > 0) {
                                this.soundManager.play('heavyTankHit');
                            }
                        }

                        this.bullets.splice(i, 1);
                        break;
                    }
                }
            } else {
                if (!this.player.isDestroyed && bulletBounds.intersects(this.player.getBounds())) {
                    if (this.player.takeDamage()) {
                        this.explosions.push(new Explosion(this.player.position.x, this.player.position.y, 'tank'));
                        this.screenShake = 20;
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
                            this.player.activateShield();
                        }
                    }
                    this.bullets.splice(i, 1);
                }
            }

            if (!bullet.active) {
                this.bullets.splice(i, 1);
                this.soundManager.play('bulletHit');
            }
        }
    }

    findEnemyByBullet(bullet) {
        for (const enemy of this.enemies) {
            const distance = Math.sqrt(
                Math.pow(enemy.position.x - bullet.position.x, 2) +
                Math.pow(enemy.position.y - bullet.position.y, 2)
            );
            if (distance < 100) {
                return enemy;
            }
        }
        return null;
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

    updateEnemies() {
        const allFragments = this.getAllFragments();
        const allTanks = [this.player, ...this.enemies];

        this.enemies.forEach(enemy => {
            enemy.update();

            if (Math.random() < 0.02) {
                const directions = Object.values(DIRECTIONS);
                const randomDir = directions[Math.floor(Math.random() * directions.length)];
                enemy.direction = randomDir;
            }

            const otherTanksForEnemy = allTanks.filter(t => t !== enemy && !t.isDestroyed);
            enemy.move(enemy.direction, this.map, otherTanksForEnemy, allFragments);

            if (Math.random() < 0.015 && enemy.canShoot) {
                const bullet = enemy.shoot();
                if (bullet) {
                    this.bullets.push(bullet);
                    this.soundManager.playEnemyShot(enemy.enemyType);
                }
            }
        });

        for (let i = 0; i < this.enemies.length; i++) {
            for (let j = i + 1; j < this.enemies.length; j++) {
                if (this.enemies[i].getBounds().intersects(this.enemies[j].getBounds())) {
                    this.enemies[i].resolveTankCollision(this.enemies[j]);
                }
            }

            if (!this.player.isDestroyed && this.enemies[i].getBounds().intersects(this.player.getBounds())) {
                this.enemies[i].resolveTankCollision(this.player);
            }
        }
    }

    getAllFragments() {
        const allFragments = [];
        this.map.brickTiles.forEach(brick => {
            allFragments.push(...brick.fragments.filter(f => f.active && f.collisionEnabled));
        });
        return allFragments;
    }

    updateRespawns() {
        const completedAnimations = [];
        this.spawnAnimations.forEach((animation, index) => {
            animation.update(this.deltaTime);
            if (!animation.active) {
                completedAnimations.push(index);
            }
        });

        completedAnimations.reverse().forEach(index => {
            const spawnPoint = this.spawnAnimations[index].position;
            this.completeSpawnAnimation(spawnPoint);
            this.spawnAnimations.splice(index, 1);
        });

        const totalEnemiesOnScreen = this.enemies.length + this.spawnAnimations.length;
        if (totalEnemiesOnScreen < MAX_ENEMIES_ON_SCREEN && this.enemiesToSpawn > 0 && !this.levelComplete && !this.baseDestroyed) {
            const timeSinceLastRespawn = Date.now() - this.lastRespawnTime;
            if (timeSinceLastRespawn >= RESPAWN_DELAY) {
                this.spawnEnemy();
                this.lastRespawnTime = Date.now();
            }
        }

        if (this.enemiesDestroyed >= TOTAL_ENEMIES_PER_LEVEL &&
            this.enemies.length === 0 &&
            this.spawnAnimations.length === 0 &&
            !this.levelComplete) {
            this.levelComplete = true;
        this.showLevelCompleteScreen = true;
        this.showLevelComplete();
            }
    }

    updateShieldIndicator() {
        if (!this.player.isDestroyed && this.player.hasShield() && !this.baseDestroyed) {
            const remainingTime = this.player.shield.getRemainingTime();
            this.shieldTime.textContent = remainingTime.toFixed(1);
            this.shieldIndicator.style.display = 'block';
        } else {
            this.shieldIndicator.style.display = 'none';
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
        document.getElementById('tanksLeft').textContent =
        TOTAL_ENEMIES_PER_LEVEL - this.enemiesDestroyed;
    }

    updateExplosions() {
        for (let i = this.explosions.length - 1; i >= 0; i--) {
            this.explosions[i].update(this.deltaTime);
            if (!this.explosions[i].active) {
                this.explosions.splice(i, 1);
            }
        }

        for (let i = this.bulletExplosions.length - 1; i >= 0; i--) {
            this.bulletExplosions[i].update();
            if (!this.bulletExplosions[i].active) {
                this.bulletExplosions.splice(i, 1);
            }
        }
    }

    updateScreenShake() {
        if (this.screenShake > 0) {
            this.screenShake--;
            const shakeIntensity = this.screenShake * 0.5;
            const offsetX = (Math.random() - 0.5) * shakeIntensity;
            const offsetY = (Math.random() - 0.5) * shakeIntensity;
            this.canvas.style.transform = `translate(${offsetX}px, ${offsetY}px)`;
        } else {
            this.canvas.style.transform = 'translate(0, 0)';
        }
    }

    gameLoop(currentTime) {
        this.deltaTime = currentTime - this.lastTime;

        if (this.deltaTime >= FRAME_TIME) {
            this.lastTime = currentTime - (this.deltaTime % FRAME_TIME);

            this.handleInput();

            const allTanks = [this.player, ...this.enemies];

            if (!this.player.isDestroyed) {
                this.player.update();
            }
            this.updateEnemies();
            this.updateBullets();
            this.updateExplosions();
            this.updateRespawns();
            this.updateScreenShake();
            this.updateShieldIndicator();

            // НОВОЕ: Обновление бонусов
            this.updateBonuses();

            this.map.update(allTanks);

            this.render();
        }

        requestAnimationFrame((time) => this.gameLoop(time));
    }

    render() {
        this.ctx.fillStyle = '#000';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        this.map.draw(this.ctx);

        this.spawnAnimations.forEach(animation => animation.draw(this.ctx));

        // НОВОЕ: Рисуем бонусы
        this.bonuses.forEach(bonus => bonus.draw(this.ctx));

        if (!this.player.isDestroyed) {
            this.player.draw(this.ctx);
        }

        this.enemies.forEach(enemy => enemy.draw(this.ctx));
        this.bullets.forEach(bullet => bullet.draw(this.ctx));
        this.explosions.forEach(explosion => explosion.draw(this.ctx));
        this.bulletExplosions.forEach(explosion => explosion.draw(this.ctx));

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
