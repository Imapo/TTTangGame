// === МЕНЕДЖЕР ВРАГОВ ===
class EnemyManager {
    constructor(game) {
        this.game = game;
        this.enemies = [];
        this.spawnAnimations = [];
        this.usedEnemyNames = new Set();
        this.currentSpawnIndex = 0;
        this.lastRespawnTime = Date.now();
    }

    showSpawnNotification() {
        const notification = document.getElementById('spawnNotification');
        if (notification) {
            notification.style.display = 'block';
            setTimeout(() => {
                notification.style.display = 'none';
            }, 2000);
        }
    }

    getNextSpawnPoint() {
        const point = SPAWN_POINTS[this.currentSpawnIndex];
        this.currentSpawnIndex = (this.currentSpawnIndex + 1) % SPAWN_POINTS.length;
        return point;
    }

    spawnEnemy() {
        if (this.game.enemiesToSpawn <= 0) return null;

        const spawnPoint = this.getNextSpawnPoint();
        this.spawnAnimations.push(new SpawnAnimation(spawnPoint.x, spawnPoint.y));
        this.showSpawnNotification();

        this.game.enemiesToSpawn--;
        this.game.updateUI();

        return spawnPoint;
    }

    completeSpawnAnimation(spawnPoint) {
        const enemyType = this.getRandomEnemyType();
        const uniqueName = this.generateUniqueEnemyName(enemyType);

        const enemy = new Tank(spawnPoint.x, spawnPoint.y, 'enemy', this.game.level, enemyType);
        enemy.direction = DIRECTIONS.DOWN;
        enemy.username = uniqueName;

        // Замораживаем новый танк если активно остановка времени
        if (this.game.timeStopActive) {
            const remainingTime = this.game.timeStopDuration - (Date.now() - this.game.timeStopStartTime);
            if (remainingTime > 0) {
                enemy.freeze(remainingTime);
            }
        }

        this.enemies.push(enemy);
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

    update() {
        const allTanks = [this.game.player, ...this.enemies];
        const allFragments = this.game.getAllFragments();

        // Обновляем существующих врагов
        this.enemies.forEach(enemy => {
            enemy.update();

            // ВЫЗЫВАЕМ новый ИИ вместо старого случайного поведения
            enemy.updateEnemyAI(this.game.map, allTanks, allFragments, this.game.player);

            // НОВОЕ: Проверяем не вышел ли враг за границы
            if (!enemy.isPositionInBounds(enemy.position.x, enemy.position.y)) {
                console.log(`⚠️ Враг ${enemy.username} вышел за границы! Спасаем...`);
                enemy.attemptEscape();
            }
        });

        // Обрабатываем столкновения между танками
        this.handleTankCollisions(allTanks);

        // НОВОЕ: Удаляем уничтоженных врагов (включая застрявших)
        this.enemies = this.enemies.filter(enemy => !enemy.isDestroyed);
    }

    handleTankCollisions(allTanks) {
        for (let i = 0; i < this.enemies.length; i++) {
            for (let j = i + 1; j < this.enemies.length; j++) {
                if (this.enemies[i].getBounds().intersects(this.enemies[j].getBounds())) {
                    this.enemies[i].resolveTankCollision(this.enemies[j]);
                }
            }

            if (!this.game.player.isDestroyed && this.enemies[i].getBounds().intersects(this.game.player.getBounds())) {
                this.enemies[i].resolveTankCollision(this.game.player);
            }
        }
    }

    updateRespawns() {
        const completedAnimations = [];
        this.spawnAnimations.forEach((animation, index) => {
            animation.update(this.game.deltaTime);
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
        if (totalEnemiesOnScreen < MAX_ENEMIES_ON_SCREEN &&
            this.game.enemiesToSpawn > 0 &&
            !this.game.levelComplete &&
            !this.game.baseDestroyed) {

            const timeSinceLastRespawn = Date.now() - this.lastRespawnTime;
        if (timeSinceLastRespawn >= RESPAWN_DELAY) {
            this.spawnEnemy();
            this.lastRespawnTime = Date.now();
        }
            }
    }

    clear() {
        this.enemies = [];
        this.spawnAnimations = [];
        this.usedEnemyNames.clear();
        this.currentSpawnIndex = 0;
    }

}

// === МЕНЕДЖЕР БОНУСОВ ===
class BonusManager {
    constructor(game) {
        this.game = game;
        this.bonuses = [];
    }

    spawnBonusFromTank(destroyedTank) {
        if (!destroyedTank.hasBonus || !destroyedTank.bonusType) return;

        const position = this.findFreeBonusPosition();
        if (position) {
            console.log(`🎁 Создаем бонус ${destroyedTank.bonusType.id} из танка ${destroyedTank.username}`);
            // ИСПРАВЛЕНИЕ: Добавляем this.game как четвертый параметр
            this.bonuses.push(new Bonus(position.x, position.y, destroyedTank.bonusType, this.game));
        }
    }

    applyTimeStopBonus() {
        // Используем глобальную активацию остановки времени
        this.game.activateTimeStop(this.type.duration);

        // Визуальный эффект
        this.createExplosionEffect();

        // Тряска экрана
        this.game.screenShake = 25;
    }

    findFreeBonusPosition() {
        const attempts = 30;

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

            if (!this.game.map.checkCollision(bonusBounds) &&
                !this.checkTankCollision(bonusBounds) &&
                !this.checkBonusCollision(position)) {
                return position;
                }
        }
        return null;
    }

    checkTankCollision(bounds) {
        if (!this.game.player.isDestroyed && bounds.intersects(this.game.player.getBounds())) {
            return true;
        }

        for (const enemy of this.game.enemyManager.enemies) {
            if (bounds.intersects(enemy.getBounds())) {
                return true;
            }
        }
        return false;
    }

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

    update() {
        for (let i = this.bonuses.length - 1; i >= 0; i--) {
            const bonus = this.bonuses[i];

            if (!bonus.update()) {
                this.bonuses.splice(i, 1);
                continue;
            }

            // Проверка подбора игроком
            if (!this.game.player.isDestroyed &&
                bonus.getBounds().intersects(this.game.player.getBounds())) {
                // ИСПРАВЛЕНИЕ: Убираем параметр game, так как он теперь передается в конструкторе
                bonus.applyBonus();
            this.bonuses.splice(i, 1);
                }
        }
    }

    clear() {
        this.bonuses = [];
    }
}

// === МЕНЕДЖЕР ЭФФЕКТОВ ===
class EffectManager {
    constructor(game) {
        this.game = game;
        this.explosions = [];
        this.bulletExplosions = [];
        this.timeWaves = []; // Добавляем массив для волн времени
    }

    addExplosion(x, y, type = 'tank') {
        this.explosions.push(new Explosion(x, y, type));
    }

    addBulletExplosion(x, y) {
        this.bulletExplosions.push(new BulletExplosion(x, y));
    }

    addTimeWave(x, y, duration) {
        console.log(`🌀 Создаем волну времени в (${x}, ${y})`);
        this.timeWaves.push(new TimeWave(x, y, duration));
    }

    update() {
        // Обновляем взрывы
        for (let i = this.explosions.length - 1; i >= 0; i--) {
            this.explosions[i].update(this.game.deltaTime);
            if (!this.explosions[i].active) {
                this.explosions.splice(i, 1);
            }
        }

        // Обновляем взрывы пуль
        for (let i = this.bulletExplosions.length - 1; i >= 0; i--) {
            this.bulletExplosions[i].update();
            if (!this.bulletExplosions[i].active) {
                this.bulletExplosions.splice(i, 1);
            }
        }

        // Обновляем волны времени
        for (let i = this.timeWaves.length - 1; i >= 0; i--) {
            this.timeWaves[i].update();
            if (!this.timeWaves[i].active) {
                this.timeWaves.splice(i, 1);
            }
        }
    }

    draw(ctx) {
        // Затем взрывы пуль
        this.bulletExplosions.forEach(explosion => explosion.draw(ctx));

        // Затем основные взрывы
        this.explosions.forEach(explosion => explosion.draw(ctx));

        // ВОЛНЫ ВРЕМЕНИ РИСУЕМ ПОСЛЕДНИМИ - ПОВЕРХ ВСЕГО
        this.timeWaves.forEach(wave => {
            wave.draw(ctx);
        });
    }

    clear() {
        this.explosions = [];
        this.bulletExplosions = [];
        this.timeWaves = []; // Очищаем и волны времени
    }
}
