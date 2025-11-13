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

            if (Math.random() < 0.02) {
                const directions = Object.values(DIRECTIONS);
                const randomDir = directions[Math.floor(Math.random() * directions.length)];
                enemy.direction = randomDir;
            }

            const otherTanksForEnemy = allTanks.filter(t => t !== enemy && !t.isDestroyed);
            enemy.move(enemy.direction, this.game.map, otherTanksForEnemy, allFragments);

            if (Math.random() < 0.015 && enemy.canShoot) {
                const bullet = enemy.shoot();
                if (bullet) {
                    this.game.bullets.push(bullet);
                    this.game.soundManager.playEnemyShot(enemy.enemyType);
                }
            }
        });

        // Обрабатываем столкновения между танками
        this.handleTankCollisions(allTanks);
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
    }

    addExplosion(x, y, type = 'tank') {
        this.explosions.push(new Explosion(x, y, type));
    }

    addBulletExplosion(x, y) {
        this.bulletExplosions.push(new BulletExplosion(x, y));
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
    }

    clear() {
        this.explosions = [];
        this.bulletExplosions = [];
    }
}
