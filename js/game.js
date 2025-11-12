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
        this.screenShake = 0;

        this.currentSpawnIndex = 0;

        this.soundManager = new SoundManager();
        this.isPlayerMoving = false;
        this.lastPlayerPosition = new Vector2(0, 0);
        this.leaderboard = this.loadLeaderboard(); // Загружаем из localStorage
        console.log('Загружена таблица при старте:', this.leaderboard);
        this.showFullLeaderboard = false; // Флаг для отображения полной таблицы
        this.updateLeaderboardUI();

        this.initLevel();
        this.setupEventListeners();
        this.gameLoop(0);
    }

    initLevel() {
        this.map = new GameMap(this.level);
        // Спавн игрока слева от базы (координаты 224, 750)
        this.player = new Tank(224, 750);
        this.enemies = [];
        this.bullets = [];
        this.explosions = [];
        this.bulletExplosions = [];
        this.spawnAnimations = [];
        this.screenShake = 0;

        this.enemiesDestroyed = 0;
        this.enemiesToSpawn = TOTAL_ENEMIES_PER_LEVEL;
        this.lastRespawnTime = Date.now();
        this.levelComplete = false;
        this.gameOver = false;
        this.showGameOverScreen = false;
        this.showLevelCompleteScreen = false;
        this.baseDestroyed = false;

        // Сбрасываем индекс спавна
        this.currentSpawnIndex = 0;

        this.updateUI();
        this.updateShieldIndicator();
        this.soundManager.updateEngineSound(false, true); // Сброс звука двигателя

        document.getElementById('levelComplete').style.display = 'none';
        document.getElementById('gameOver').style.display = 'none';
    }

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

        return 'BASIC'; // fallback
    }

    completeSpawnAnimation(spawnPoint) {
        const enemyType = this.getRandomEnemyType();
        const enemy = new Tank(spawnPoint.x, spawnPoint.y, 'enemy', this.level, enemyType);
        enemy.direction = DIRECTIONS.DOWN;
        this.enemies.push(enemy);

        console.log(`Появился враг: ${enemy.username} (${enemyType})`);
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

    // Метод сброса таблицы лидеров
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

        // Проверяем, двигается ли игрок
        const wasMoving = this.isPlayerMoving;
        this.isPlayerMoving = false;

        if (currentDirection && !this.player.isDestroyed && !this.baseDestroyed) {
            if (this.player.move(currentDirection, this.map, allTanks, allFragments)) {
                this.isPlayerMoving = true;
            }
        }

        // Обновляем звук двигателя если состояние изменилось
        if (wasMoving !== this.isPlayerMoving) {
            this.soundManager.updateEngineSound(this.isPlayerMoving, !this.player.isDestroyed);
        }

        if ((this.keys['Space'] || this.keys['Enter']) && this.player.canShoot && !this.player.isDestroyed && !this.baseDestroyed) {
            const bullet = this.player.shoot();
            if (bullet) {
                this.bullets.push(bullet);
                this.soundManager.play('playerShot'); // Звук выстрела игрока
            }
        }

        this.debugInfo.textContent =
        `Уровень: ${this.level} | Уничтожено: ${this.enemiesDestroyed}/${TOTAL_ENEMIES_PER_LEVEL} | ` +
        `Осталось заспавнить: ${this.enemiesToSpawn} | FPS: ${Math.round(1000 / this.deltaTime)}` +
        (this.gameOver ? ' | ИГРА ОКОНЧЕНА' : '') +
        (this.levelComplete ? ' | УРОВЕНЬ ПРОЙДЕН' : '') +
        (this.baseDestroyed ? ' | БАЗА УНИЧТОЖЕНА' : '');
    }

    updateBullets() {
        // Проверка столкновений пуль друг с другом
        for (let i = this.bullets.length - 1; i >= 0; i--) {
            for (let j = this.bullets.length - 1; j > i; j--) {
                if (this.bullets[i].owner !== this.bullets[j].owner &&
                    this.bullets[i].getBounds().intersects(this.bullets[j].getBounds())) {
                    this.bulletExplosions.push(new BulletExplosion(this.bullets[i].position.x, this.bullets[i].position.y));
                this.bullets.splice(i, 1);
                this.bullets.splice(j, 1);
                this.soundManager.play('bulletCollision'); // Звук столкновения пуль
                break;
                    }
            }
        }

        // Обновление пуль и проверка столкновений
        for (let i = this.bullets.length - 1; i >= 0; i--) {
            const bullet = this.bullets[i];
            bullet.update();

            const destructionResult = this.map.checkBulletCollision(bullet);
            if (destructionResult) {
                if (destructionResult === 'base') {
                    this.explosions.push(new Explosion(bullet.position.x, bullet.position.y, 'base'));
                    this.screenShake = 30;
                    this.soundManager.play('baseExplosion'); // Звук взрыва базы
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
                    this.soundManager.play('bulletHit'); // Звук попадания в бетон/границу
                }
                else if (destructionResult === 'brick') {
                    this.bulletExplosions.push(new BulletExplosion(bullet.position.x, bullet.position.y));
                    this.bullets.splice(i, 1);
                    this.soundManager.play('brickHit'); // Звук попадания по кирпичу
                }
                continue;
            }

            const bulletBounds = bullet.getBounds();

            // В методе updateBullets() в game.js:
            if (bullet.owner === 'player') {
                for (let j = this.enemies.length - 1; j >= 0; j--) {
                    const enemy = this.enemies[j];
                    if (bulletBounds.intersects(enemy.getBounds())) {
                        if (enemy.takeDamage()) {
                            this.explosions.push(new Explosion(enemy.position.x, enemy.position.y, 'tank'));
                            this.screenShake = 10;
                            this.soundManager.play('tankExplosion');

                            // ЗАПОМИНАЕМ УБИТОГО ВРАГА ПЕРЕД УДАЛЕНИЕМ
                            const killedEnemy = enemy;

                            this.enemies.splice(j, 1);
                            this.enemiesDestroyed++;
                            this.score += 100;
                            this.updateUI();
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

                        // ИСПОЛЬЗУЕМ НАСТОЯЩЕГО СТРЕЛЯВШЕГО ИЗ ПУЛИ
                        if (bullet.shooter && bullet.owner === 'enemy') {
                            console.log('Настоящий убийца:', bullet.shooter.username, bullet.shooter.enemyType);
                            this.addToLeaderboard(bullet.shooter);
                        } else {
                            console.log('Не удалось определить убийцу, bullet:', bullet);
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
                this.soundManager.play('bulletHit'); // Звук вылета пули за границы
            }
        }
    }

    // Находим врага, который выстрелил пулю
    findEnemyByBullet(bullet) {
        for (const enemy of this.enemies) {
            // Простая проверка - враг находится рядом с траекторией пули
            const distance = Math.sqrt(
                Math.pow(enemy.position.x - bullet.position.x, 2) +
                Math.pow(enemy.position.y - bullet.position.y, 2)
            );
            if (distance < 100) { // Если враг близко к пуле
                return enemy;
            }
        }
        return null;
    }

    // Загрузка таблицы лидеров из localStorage
    loadLeaderboard() {
        try {
            const saved = localStorage.getItem('tankGame_leaderboard');
            if (saved) {
                const parsed = JSON.parse(saved);
                console.log('Успешно загружено из localStorage:', parsed);
                return parsed;
            }
        } catch (error) {
            console.error('Ошибка загрузки:', error);
        }
        console.log('Нет сохраненных данных, возвращаем пустой массив');
        return [];
    }

    // Сохранение таблицы лидеров в localStorage
    saveLeaderboard() {
        try {
            console.log('Сохранение в localStorage:', this.leaderboard);
            localStorage.setItem('tankGame_leaderboard', JSON.stringify(this.leaderboard));
        } catch (error) {
            console.error('Ошибка сохранения:', error);
        }
    }

    addToLeaderboard(enemy) {
        if (!enemy || !enemy.username) {
            console.log('Некорректный враг для таблицы лидеров:', enemy);
            return;
        }

        console.log('=== ДОБАВЛЕНИЕ В ТАБЛИЦУ ===');
        console.log('Враг:', enemy.username, 'Тип:', enemy.enemyType);
        console.log('Текущая таблица:', this.leaderboard);

        // Ищем существующую запись
        const existingIndex = this.leaderboard.findIndex(entry =>
        entry.name === enemy.username && entry.type === enemy.enemyType
        );

        if (existingIndex !== -1) {
            // Обновляем существующую запись
            this.leaderboard[existingIndex].score += 100;
            this.leaderboard[existingIndex].level = this.level;
            console.log('Обновили запись:', this.leaderboard[existingIndex]);
        } else {
            // Добавляем новую запись
            const newEntry = {
                name: enemy.username,
                type: enemy.enemyType,
                score: 100,
                level: this.level
            };
            this.leaderboard.push(newEntry);
            console.log('Добавили новую запись:', newEntry);
        }

        // Сортируем по очкам
        this.leaderboard.sort((a, b) => b.score - a.score);

        console.log('Таблица после обновления:', this.leaderboard);

        // Сохраняем и обновляем UI
        this.saveLeaderboard();
        this.updateLeaderboardUI();
    }

    // Обновленный метод отображения
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

        // РЕШАЕМ СКОЛЬКО ЗАПИСЕЙ ПОКАЗЫВАТЬ
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

        // Обновляем заголовок
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
                    // Используем новый метод для разных звуков
                    this.soundManager.playEnemyShot(enemy.enemyType);
                }
            }
        });

        // Разрешаем столкновения между танками после движения
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
        // Прекращаем спавн врагов если база уничтожена
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
        // ОСТАНАВЛИВАЕМ ЗВУК ДВИГАТЕЛЯ
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
        this.soundManager.stopAll(); // Останавливаем все звуки
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

            // Собираем все танки для проверки коллизий
            const allTanks = [this.player, ...this.enemies];

            // Игра продолжает обновляться даже после завершения
            if (!this.player.isDestroyed) {
                this.player.update();
            }
            this.updateEnemies();
            this.updateBullets();
            this.updateExplosions();
            this.updateRespawns();
            this.updateScreenShake();
            this.updateShieldIndicator();
            this.map.update(allTanks); // Передаем танки для обработки коллизий

            this.render();
        }

        requestAnimationFrame((time) => this.gameLoop(time));
    }

    render() {
        this.ctx.fillStyle = '#000';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        this.map.draw(this.ctx);

        this.spawnAnimations.forEach(animation => animation.draw(this.ctx));

        // Рисуем игрока только если он не уничтожен
        if (!this.player.isDestroyed) {
            this.player.draw(this.ctx);
        }

        this.enemies.forEach(enemy => enemy.draw(this.ctx));
        this.bullets.forEach(bullet => bullet.draw(this.ctx));
        this.explosions.forEach(explosion => explosion.draw(this.ctx));
        this.bulletExplosions.forEach(explosion => explosion.draw(this.ctx));

        // Затемнение экрана при завершении
        if (this.showGameOverScreen || this.showLevelCompleteScreen) {
            this.ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        }

        // Сообщение об уничтожении базы
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
