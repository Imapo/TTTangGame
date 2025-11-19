// === МЕНЕДЖЕР ВРАГОВ ===
class EnemyManager {
    constructor(game) {
        this.game = game;
        this.enemies = [];
        this.spawnAnimations = [];
        this.usedEnemyNames = new Set();
        this.currentSpawnIndex = 0;
        this.lastRespawnTime = Date.now();
        this.destroyedEnemiesStats = [];
    }

    showSpawnNotification() {
        const notification = document.getElementById('spawnNotification');
        if (notification) {
            notification.style.display = 'block';
            setTimeout(() => notification.style.display = 'none', 2000);
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

    completeSpawnAnimation(position) {
        const enemyType = this.getRandomEnemyType();
        const username = this.generateUniqueEnemyName(enemyType);
        const enemy = new Tank(position.x, position.y, "enemy", this.game.level, enemyType);

        enemy.direction = DIRECTIONS.DOWN;
        enemy.username = username;

        if (this.game?.currentRoundEnemies) {
            this.game.currentRoundEnemies.set(username, {
                enemy: enemy,
                spawnTime: Date.now(),
                                              destroyed: false,
                                              destroyTime: null,
                                              finalStats: null
            });
        }

        if (this.game.timeStopActive) {
            const remainingTime = this.game.timeStopDuration - (Date.now() - this.game.timeStopStartTime);
            if (remainingTime > 0) enemy.freeze(remainingTime);
        }

        this.enemies.push(enemy);
    }

    getRandomEnemyType() {
        const random = Math.random();
        let cumulativeChance = 0;

        for (const [type, config] of Object.entries(ENEMY_TYPES)) {
            cumulativeChance += config.chance;
            if (random <= cumulativeChance) return type;
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
            availableNames.push(`${names[0]} ${Date.now()}`);
        }

        const selectedName = availableNames[Math.floor(Math.random() * availableNames.length)];
        this.usedEnemyNames.add(selectedName);
        return selectedName;
    }

    update() {
        const allTanks = [this.game.player, ...this.enemies];
        const allFragments = this.game.getAllFragments();

        this.enemies.forEach(enemy => {
            enemy.update();
            enemy.updateEnemyAI(this.game.map, allTanks, allFragments, this.game.player);
        });

        // Сохраняем статистику уничтоженных врагов
        this.enemies.filter(enemy => enemy.isDestroyed).forEach(enemy => {
            if (enemy.levelStats?.totalScore > 0) {
                this.destroyedEnemiesStats.push({
                    enemy: enemy,
                    stats: {...enemy.levelStats}
                });
            }
        });

        this.enemies = this.enemies.filter(enemy => !enemy.isDestroyed);
        this.handleTankCollisions(allTanks);
    }

    getAllEnemiesStats() {
        const currentStats = this.enemies
        .filter(enemy => enemy.levelStats)
        .map(enemy => ({ enemy, stats: enemy.levelStats }));

        return [...currentStats, ...this.destroyedEnemiesStats];
    }

    clearStats() {
        this.destroyedEnemiesStats = [];
    }

    handleTankCollisions(allTanks) {
        for (let i = 0; i < this.enemies.length; i++) {
            for (let j = i + 1; j < this.enemies.length; j++) {
                if (this.enemies[i].getBounds().intersects(this.enemies[j].getBounds())) {
                    this.enemies[i].resolveTankCollision?.(this.enemies[j]);
                }
            }

            if (!this.game.player.isDestroyed &&
                this.enemies[i].getBounds().intersects(this.game.player.getBounds())) {
                this.enemies[i].resolveTankCollision?.(this.game.player);
                }
        }
    }

    updateRespawns() {
        // Удаляем завершенные анимации и создаем врагов
        this.spawnAnimations = this.spawnAnimations.filter((animation, index) => {
            animation.update(this.game.deltaTime);
            if (!animation.active) {
                this.completeSpawnAnimation(animation.position);
                return false;
            }
            return true;
        });

        // Спавним новых врагов при необходимости
        const totalEnemiesOnScreen = this.enemies.length + this.spawnAnimations.length;
        const canSpawn = totalEnemiesOnScreen < MAX_ENEMIES_ON_SCREEN &&
        this.game.enemiesToSpawn > 0 &&
        !this.game.levelComplete &&
        !this.game.baseDestroyed &&
        (Date.now() - this.lastRespawnTime >= RESPAWN_DELAY);

        if (canSpawn) {
            this.spawnEnemy();
            this.lastRespawnTime = Date.now();
        }
    }

    clear() {
        this.enemies = [];
        this.spawnAnimations = [];
        this.usedEnemyNames.clear();
        this.currentSpawnIndex = 0;
        this.lastRespawnTime = Date.now();
        this.destroyedEnemiesStats = [];
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
            this.bonuses.push(new Bonus(position.x, position.y, destroyedTank.bonusType, this.game));
        }
    }

    findFreeBonusPosition() {
        for (let i = 0; i < 30; i++) {
            const x = Math.floor(Math.random() * (24 - 4) + 2) * TILE_SIZE + TILE_SIZE/2;
            const y = Math.floor(Math.random() * (24 - 8) + 4) * TILE_SIZE + TILE_SIZE/2;

            const position = new Vector2(x, y);
            const bonusBounds = new Rectangle(x - TILE_SIZE/2, y - TILE_SIZE/2, TILE_SIZE, TILE_SIZE);

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
        return this.game.enemyManager.enemies.some(enemy => bounds.intersects(enemy.getBounds()));
    }

    checkBonusCollision(position) {
        return this.bonuses.some(bonus => {
            const distance = Math.sqrt(
                Math.pow(bonus.position.x - position.x, 2) +
                Math.pow(bonus.position.y - position.y, 2)
            );
            return distance < TILE_SIZE * 2;
        });
    }

    update() {
        this.bonuses = this.bonuses.filter(bonus => {
            if (!bonus.update()) return false;

            if (!this.game.player.isDestroyed && bonus.getBounds().intersects(this.game.player.getBounds())) {
                bonus.applyBonus();
                return false;
            }
            return true;
        });
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
        this.timeWaves = [];
    }

    addExplosion(x, y, type = 'tank') {
        this.explosions.push(new Explosion(x, y, type));
    }

    addBulletExplosion(x, y) {
        this.bulletExplosions.push(new BulletExplosion(x, y));
    }

    addTimeWave(x, y, duration) {
        this.timeWaves.push(new TimeWave(x, y, duration));
    }

    update() {
        this.explosions = this.explosions.filter(explosion => {
            explosion.update(this.game.deltaTime);
            return explosion.active;
        });

        this.bulletExplosions = this.bulletExplosions.filter(explosion => {
            explosion.update();
            return explosion.active;
        });

        this.timeWaves = this.timeWaves.filter(wave => {
            wave.update();
            return wave.active;
        });
    }

    draw(ctx) {
        this.bulletExplosions.forEach(explosion => explosion.draw(ctx));
        this.explosions.forEach(explosion => explosion.draw(ctx));
        this.timeWaves.forEach(wave => wave.draw(ctx));
    }

    clear() {
        this.explosions = [];
        this.bulletExplosions = [];
        this.timeWaves = [];
    }
}
