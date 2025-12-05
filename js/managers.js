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
        this.wrecks = [];

        // 🔥 ДОБАВЛЯЕМ ИНИЦИАЛИЗАЦИЮ СЧЕТЧИКА
        this.destroyedEnemies = 0;
        this.totalEnemies = 20; // Общее количество врагов на уровень
    }

    // 🔥 МЕТОД ДЛЯ ПРЕВРАЩЕНИЯ ТАНКА В ОГАРОК
    turnIntoWreck(enemy) {
        if (!enemy || enemy.isWreck) return;

        enemy.turnIntoWreck();

        // 🔥 ПЕРЕМЕЩАЕМ В МАССИВ ОГАРКОВ
        const index = this.enemies.indexOf(enemy);
        if (index !== -1) {
            this.enemies.splice(index, 1);
            this.wrecks.push(enemy);

            // 🔥 УВЕЛИЧИВАЕМ СЧЕТЧИК УНИЧТОЖЕННЫХ - ДОБАВЬТЕ ЭТУ СТРОКУ
            this.destroyedEnemies = (this.destroyedEnemies || 0) + 1;

            // 🔥 Также увеличиваем счётчик в игре
            if (this.game) {
                this.game.enemiesDestroyed = (this.game.enemiesDestroyed || 0) + 1;
                if (this.game.updateUI) {
                    this.game.updateUI();
                }
            }

        }
    }

    // Получаем количество обычных врагов (не зрителей)
    getRegularEnemiesCount() {
        return this.enemies.filter(enemy =>
        !enemy.isViewerTank && enemy.enemyType !== 'VIEWER'
        ).length;
    }

    // Получаем количество танков зрителей
    getViewerTanksCount() {
        return this.enemies.filter(enemy =>
        enemy.isViewerTank || enemy.enemyType === 'VIEWER'
        ).length;
    }

    // Получаем оставшееся количество обычных врагов
    getRemainingRegularEnemies() {
        const currentRegular = this.getRegularEnemiesCount();
        const destroyed = this.destroyedEnemies || 0;
        const total = this.totalEnemies || 20;

        return Math.max(0, total - destroyed - currentRegular);
    }

    // Получаем общее количество танков на поле (для экстренного лимита)
    getTotalTanksOnField() {
        return this.enemies.length;
    }

    // Получаем информацию о всех танках для дебага
    getTanksDebugInfo() {
        const regularEnemies = this.enemies.filter(enemy =>
        !enemy.isViewerTank && enemy.enemyType !== 'VIEWER'
        );
        const viewerTanks = this.enemies.filter(enemy =>
        enemy.isViewerTank || enemy.enemyType === 'VIEWER'
        );

        return {
            total: this.enemies.length,
            regular: regularEnemies.length,
            viewer: viewerTanks.length,
            regularNames: regularEnemies.map(e => e.username),
            viewerNames: viewerTanks.map(e => e.username)
        };
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
        // 🔥 ПРОВЕРЯЕМ СНАЧАЛА, МОЖНО ЛИ СПАВНИТЬ
        const activeEnemies = this.enemies.filter(enemy =>
        !enemy.isDestroyed || !enemy.isWreck
        ).length;

        const totalSpawned = (this.destroyedEnemies || 0) + activeEnemies;

        if (totalSpawned >= TOTAL_ENEMIES_PER_LEVEL) {
            return null;
        }

        if (activeEnemies >= MAX_ENEMIES_ON_SCREEN) {
            return null;
        }

        if (this.game.enemiesToSpawn <= 0) {
            return null;
        }

        const spawnPoint = this.getNextSpawnPoint();
        this.spawnAnimations.push(new SpawnAnimation(spawnPoint.x, spawnPoint.y));
        this.showSpawnNotification();

        return spawnPoint;
    }

    completeSpawnAnimation(position) {
        // 🔥 ПРАВИЛЬНЫЙ ПОДСЧЕТ АКТИВНЫХ ВРАГОВ (без огарков)
        const activeEnemies = this.enemies.filter(enemy =>
        !enemy.isDestroyed || !enemy.isWreck
        );

        const totalSpawnedSoFar = (this.destroyedEnemies || 0) + activeEnemies.length;

        // 🔥 ИСПОЛЬЗУЕМ КОНСТАНТЫ
        if (totalSpawnedSoFar >= TOTAL_ENEMIES_PER_LEVEL) {
            return;
        }

        // 🔥 ПРОВЕРКА ЛИМИТА ПОЛЯ
        if (activeEnemies.length >= MAX_ENEMIES_ON_SCREEN) {
            return;
        }

        const enemyType = this.getRandomEnemyType();
        const username = this.generateUniqueEnemyName(enemyType);
        const enemy = new Tank(position.x, position.y, "enemy", this.game.level, enemyType);

        // Направление к центру карты
        const centerX = CANVAS_WIDTH / 2;
        const centerY = CANVAS_HEIGHT / 2;
        const dx = centerX - position.x;
        const dy = centerY - position.y;

        if (Math.abs(dx) > Math.abs(dy)) {
            enemy.direction = dx > 0 ? DIRECTIONS.RIGHT : DIRECTIONS.LEFT;
        } else {
            enemy.direction = dy > 0 ? DIRECTIONS.DOWN : DIRECTIONS.UP;
        }
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

        // 🔥 ЗАМОРАЖИВАЕМ ПРИ СТОП-ВРЕМЕНИ
        if (this.game.timeStopActive) {
            const remainingTime = this.game.timeStopDuration - (Date.now() - this.game.timeStopStartTime);
            if (remainingTime > 0) {
                enemy.freeze(remainingTime);
            }
        }

        this.enemies.push(enemy);

        // 🔥 ОБНОВЛЯЕМ enemiesToSpawn В ИГРЕ
        if (this.game && this.game.enemiesToSpawn > 0) {
            this.game.enemiesToSpawn--;
            if (this.game.updateUI) {
                this.game.updateUI();
            }
        }
    }

    getActiveEnemiesCount() {
        return this.enemies.filter(enemy =>
        !enemy.isDestroyed || !enemy.isWreck
        ).length;
    }

    getRandomEnemyType() {
        const random = Math.random();
        let cumulativeChance = 0;

        // Исключаем VIEWER из случайного выбора
        const availableTypes = Object.entries(ENEMY_TYPES).filter(([type]) => type !== 'VIEWER');

        for (const [type, config] of availableTypes) {
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
        // 🔥 РАЗДЕЛЯЕМ ОБРАБОТКУ НА ДВА ЭТАПА

        // 1. ОБНОВЛЯЕМ ВСЕХ ВРАГОВ
        for (let i = this.enemies.length - 1; i >= 0; i--) {
            const enemy = this.enemies[i];

            // 🔥 ОГАРКИ - только update()
            if (enemy.isWreck && enemy.isDestroyed) {
                enemy.update();

                // 🔥 ПРОВЕРЯЕМ, НЕ ПОРА ЛИ УДАЛИТЬ ОГАРОК (полностью затух)
                if (enemy.infoBlockAlpha <= 0.01 && enemy.wreckAlpha <= 0.01) {
                    this.enemies.splice(i, 1);
                }
                continue;
            }

            // 🔥 ЖИВЫЕ ВРАГИ - полное обновление
            if (!enemy.isDestroyed) {
                enemy.update();
            }
        }

        // 2. СОЗДАЕМ СПИСОК АКТИВНЫХ ТАНКОВ ДЛЯ ИИ (без огарков)
        const activeEnemies = this.enemies.filter(e =>
        !e.isDestroyed || !e.isWreck
        );
        const activeTanks = [this.game.player, ...activeEnemies];
        const allFragments = this.game.getAllFragments();

        // 3. ОБНОВЛЯЕМ ИИ ТОЛЬКО ДЛЯ ЖИВЫХ ВРАГОВ
        for (const enemy of this.enemies) {
            if (!enemy.isDestroyed && !enemy.isWreck) {
                enemy.updateEnemyAI(this.game.map, activeTanks, allFragments, this.game.player);
            }
        }

        // 4. ОБРАБАТЫВАЕМ УНИЧТОЖЕНИЯ
        const enemiesToRemove = [];

        for (let i = this.enemies.length - 1; i >= 0; i--) {
            const enemy = this.enemies[i];

            // 🔥 УДАЛЯЕМ ТОЛЬКО НЕ-ОГАРКОВ
            if (enemy.isDestroyed && !enemy.isWreck) {
                // Сохраняем статистику
                if (enemy.levelStats?.totalScore > 0) {
                    this.destroyedEnemiesStats.push({
                        enemy: enemy,
                        stats: {...enemy.levelStats}
                    });
                }

                // 🔥 ВАЖНО: УВЕЛИЧИВАЕМ СЧЕТЧИК УНИЧТОЖЕННЫХ
                this.destroyedEnemies = (this.destroyedEnemies || 0) + 1;

                // 🔥 ОБНОВЛЯЕМ СЧЕТЧИК В ИГРЕ
                if (this.game) {
                    // Сообщаем игре об уничтожении
                    if (this.game.markEnemyDestroyed) {
                        this.game.markEnemyDestroyed(enemy);
                    }

                    // Увеличиваем счетчик уничтоженных в игре
                    this.game.enemiesDestroyed = (this.game.enemiesDestroyed || 0) + 1;

                    // Обновляем UI
                    if (this.game.updateUI) {
                        this.game.updateUI();
                    }
                }

                enemiesToRemove.push(i);
            }
        }

        // 🔥 УДАЛЯЕМ ПОМЕЧЕННЫХ ВРАГОВ
        for (const index of enemiesToRemove.sort((a, b) => b - a)) {
            this.enemies.splice(index, 1);
        }

        // 5. ОБРАБОТКА СТОЛКНОВЕНИЙ (только активные танки)
        this.handleTankCollisions(activeTanks);

        // 🔥 ДЕБАГ
        this.debugInfo();
    }

    debugInfo() {
        if (this.game?.frameCount % 120 !== 0) return;

        const active = this.enemies.filter(e => !e.isDestroyed || !e.isWreck).length;
        const wrecks = this.enemies.filter(e => e.isWreck).length;
        const total = active + wrecks;

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

    getTotalEnemiesOnScreen() {
        // 🔥 Считаем ТОЛЬКО живых врагов (не огарки, не уничтоженные)
        return this.enemies.filter(enemy =>
        !enemy.isDestroyed || (enemy.isWreck && enemy.isDestroyed)  // 🔥 ИСКЛЮЧАЕМ ОГАРКИ
        ).length;
    }

    updateRespawns() {
        // 🔥 ИСПРАВЛЕНИЕ: Считаем ТОЛЬКО живых врагов (не огарки, не уничтоженные)
        const aliveEnemies = this.getAliveEnemiesCount();
        const wrecksCount = this.getWrecksCount();

        const totalEnemiesOnScreen = aliveEnemies + this.spawnAnimations.length;
        // Удаляем завершенные анимации и создаем врагов
        this.spawnAnimations = this.spawnAnimations.filter((animation, index) => {
            if (!animation.isFrozen) {
                animation.update(this.game.deltaTime);
            }

            if (!animation.active) {
                this.completeSpawnAnimation(animation.position);
                return false;
            }
            return true;
        });

        // 🔥 ИСПРАВЛЕНИЕ: Используем aliveEnemies вместо this.enemies.length
        const canSpawn = aliveEnemies < MAX_ENEMIES_ON_SCREEN &&
        this.game.enemiesToSpawn > 0 &&
        !this.game.levelComplete &&
        !this.game.baseDestroyed &&
        (Date.now() - this.lastRespawnTime >= RESPAWN_DELAY);

        if (canSpawn) {
            // 🔥 ПРОВЕРЯЕМ: МОЖЕМ ЛИ СПАВНИТЬ ЗРИТЕЛЯ ВМЕСТО ОБЫЧНОГО ВРАГА?
            if (this.game.viewerSystem && this.shouldSpawnViewerInstead()) {
                const spawned = this.game.viewerSystem.trySpawnViewerTank();
                if (spawned) {
                    this.lastRespawnTime = Date.now();
                    this.game.enemiesToSpawn--;
                    this.game.updateUI();
                    return;
                }
            }

            // 🔥 ЕСЛИ НЕ ВЫШЛО СО ЗРИТЕЛЕМ - СПАВНИМ ОБЫЧНОГО ВРАГА
            this.spawnEnemy();
            this.lastRespawnTime = Date.now();
        }
    }

    getAliveEnemiesCount() {
        return this.enemies.filter(enemy =>
        !enemy.isDestroyed || (enemy.isWreck && enemy.isDestroyed)  // 🔥 ЭТО ОШИБКА!
        ).length;
    }

    // 🔥 ИСПРАВЛЕННЫЙ МЕТОД:
    getAliveEnemiesCount() {
        // Живые враги = НЕ уничтоженные И НЕ огарки
        return this.enemies.filter(enemy =>
        !enemy.isDestroyed && !enemy.isWreck
        ).length;
    }

    getWrecksCount() {
        // Огарки = уничтоженные И являются огарками
        return this.enemies.filter(enemy =>
        enemy.isDestroyed && enemy.isWreck
        ).length;
    }

    // 🔥 РЕШАЕМ: КОГДА СПАВНИТЬ ЗРИТЕЛЯ ВМЕСТО ОБЫЧНОГО ВРАГА
    shouldSpawnViewerInstead() {
        // 50% шанс заменить обычного врага на зрителя
        // return Math.random() < 0.5;
        return true;
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

// ★★★ КЛАСС ДЛЯ ВЗРЫВА ДРУЖЕСТВЕННОГО ОГНЯ ★★★
class FriendlyFireExplosion {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.radius = 15;
        this.maxRadius = 25;
        this.particles = [];
        this.life = 30;
        this.color = '#6666FF';
        this.active = true;

        // Создаем частицы
        for (let i = 0; i < 8; i++) {
            this.particles.push({
                x: x,
                y: y,
                vx: (Math.random() - 0.5) * 4,
                                vy: (Math.random() - 0.5) * 4,
                                life: 20 + Math.random() * 10,
                                size: 2 + Math.random() * 3
            });
        }
    }

    update(deltaTime) {
        // Обновляем радиус
        this.radius = Math.min(this.radius + 0.5, this.maxRadius);
        this.life--;

        // Обновляем частицы
        this.particles.forEach(particle => {
            if (particle.life > 0) {
                particle.x += particle.vx;
                particle.y += particle.vy;
                particle.life--;
            }
        });

        this.active = this.life > 0;
        return this.active;
    }

    draw(ctx) {
        ctx.save();

        // Полупрозрачное синее кольцо
        ctx.strokeStyle = `rgba(100, 100, 255, ${this.life / 30})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.stroke();

        // Частицы
        this.particles.forEach(particle => {
            if (particle.life > 0) {
                ctx.fillStyle = `rgba(136, 136, 255, ${particle.life / 30})`;
                ctx.beginPath();
                ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
                ctx.fill();
            }
        });

        ctx.restore();
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

    addFriendlyFireEffect(x, y) {
        this.explosions.push(new FriendlyFireExplosion(x, y));
    }

    addExplosion(x, y, type = 'tank') {
        this.explosions.push(new Explosion(x, y, type));
    }

    addBulletExplosion(x, y, type = 'normal') {
        if (type === 'friendly_fire') {
            this.addFriendlyFireEffect(x, y);
            return;
        }
        this.bulletExplosions.push(new BulletExplosion(x, y));
    }

    addTimeWave(x, y, duration) {
        this.timeWaves.push(new TimeWave(x, y, duration));
    }

    update() {
        // Теперь все взрывы имеют метод update()
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

    addHitEffect(x, y) {
        // Создаем небольшой эффект искр при попадании
        for (let i = 0; i < 5; i++) {
            this.bulletExplosions.push(new BulletExplosion(
                x + (Math.random() - 0.5) * 10,
                                                           y + (Math.random() - 0.5) * 10,
                                                           0.3
            ));
        }
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
