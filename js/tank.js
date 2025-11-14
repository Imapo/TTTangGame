// === КЛАСС ТАНКА ===
class Tank {
    constructor(x, y, type = 'player', level = 1, enemyType = 'BASIC') {
        this.position = new Vector2(x, y);
        this.direction = DIRECTIONS.UP;

        // НОВОЕ: Система прокачки для игрока
        if (type === 'player') {
            this.playerLevel = 1;
            this.experience = 0;
            this.upgrade = PLAYER_UPGRADES.LEVEL_1;

            this.speed = this.upgrade.speed;
            this.color = this.upgrade.color;
            this.health = this.upgrade.health;
            this.bulletSpeed = this.upgrade.bulletSpeed;
            this.reloadTime = this.upgrade.reloadTime;
            this.bulletPower = this.upgrade.bulletPower;
            this.canDestroyConcrete = this.upgrade.canDestroyConcrete;
        } else {
            // Характеристики врагов в зависимости от типа и уровня
            const enemyConfig = ENEMY_TYPES[enemyType];
            const levelMultiplier = level === 1 ? 1 : 1.2;

            this.speed = enemyConfig.speed * TANK_SPEED * levelMultiplier;
            this.color = enemyConfig.color;
            this.health = enemyConfig.health;
            this.bulletSpeed = enemyConfig.bulletSpeed;
            this.reloadTime = enemyConfig.reloadTime;
            this.bulletPower = 1;
            this.canDestroyConcrete = false;
        }

        this.type = type;
        this.enemyType = enemyType;
        this.size = TILE_SIZE - 8;
        this.canShoot = true;
        this.username = type === 'enemy' ? this.generateEnemyName(enemyType) : '';
        this.spawnProtection = 0;
        this.shield = null;
        this.isDestroyed = false;
        this.stuckTimer = 0;

        // Свойства для танков с бонусами
        this.hasBonus = false;
        this.bonusType = null;
        this.blinkTimer = 0;
        this.blinkAlpha = 1.0;
        this.blinkDirection = -1;

        // Свойства для неуязвимости
        this.isInvincible = false;
        this.invincibilityTimer = 0;
        this.invincibilityDuration = 0;
        this.invincibilityBlink = 0;

        // Свойства для автонаведения
        this.hasAutoAim = false;
        this.autoAimTimer = 0;
        this.autoAimDuration = 0;
        this.autoAimBlink = 0;

        // Добавляем свойство заморозки
        this.isFrozen = false;
        this.freezeProgress = 0;
        this.freezeStartTime = 0;
        this.freezeDuration = 0;
        this.iceCrystals = [];

        // Для врагов определяем, есть ли бонус
        if (type === 'enemy') {
            this.determineBonus();
        }
    }

    // ОБНОВЛЯЕМ метод addExperience
    addExperience(enemyType) {
        if (this.type !== 'player') return;

        const expGained = EXP_PER_KILL[enemyType] || 10;
        this.experience += expGained;

        console.log(`🎯 +${expGained} опыта за уничтожение ${enemyType} танка. Всего: ${this.experience}`);

        // Проверяем возможность апгрейда
        this.checkLevelUp();
    }

    // ОБНОВЛЯЕМ метод checkLevelUp
    checkLevelUp() {
        const nextLevel = this.playerLevel + 1;
        const expRequired = EXP_REQUIREMENTS[nextLevel];

        if (expRequired && this.experience >= expRequired) {
            this.upgradeToLevel(nextLevel);
            // После апгрейда снова проверяем, не можем ли мы подняться еще
            this.checkLevelUp();
        }
    }

    // УПРОЩАЕМ метод upgradeToLevel
    upgradeToLevel(newLevel) {
        const upgradeKey = `LEVEL_${newLevel}`;
        const newUpgrade = PLAYER_UPGRADES[upgradeKey];

        if (!newUpgrade) return;

        this.playerLevel = newLevel;
        this.upgrade = newUpgrade;

        // Обновляем характеристики
        this.speed = newUpgrade.speed;
        this.color = newUpgrade.color;
        this.bulletSpeed = newUpgrade.bulletSpeed;
        this.reloadTime = newUpgrade.reloadTime;
        this.bulletPower = newUpgrade.bulletPower;
        this.canDestroyConcrete = newUpgrade.canDestroyConcrete;

        // Добавляем здоровье если есть бонус
        if (newUpgrade.health > this.health) {
            this.health = newUpgrade.health;
        }

        console.log(`🚀 Апгрейд до ${newUpgrade.name}! Уровень ${newLevel}`);

        // Визуальный эффект апгрейда
        this.showUpgradeEffect();
    }

    // НОВЫЙ МЕТОД: Визуальный эффект при апгрейде
    showUpgradeEffect() {
        if (typeof game !== 'undefined') {
            // Создаем взрыв для эффекта
            game.effectManager.addExplosion(this.position.x, this.position.y, 'bonus');
            game.screenShake = 15;

            // Показываем сообщение
            this.showUpgradeMessage();
        }
    }

    // НОВЫЙ МЕТОД: Показ сообщения об апгрейде
    showUpgradeMessage() {
        const message = `🚀 ${this.upgrade.name}! Уровень ${this.playerLevel}`;
        console.log(message);

        // Можно добавить всплывающее сообщение в UI
        if (typeof game !== 'undefined' && game.showUpgradeNotification) {
            game.showUpgradeNotification(message);
        }
    }

    // НОВЫЙ МЕТОД: Активация автонаведения
    activateAutoAim(duration) {
        if (this.type !== 'player') return; // Только для игрока

        this.hasAutoAim = true;
        this.autoAimDuration = duration;
        this.autoAimTimer = 0;
        this.autoAimBlink = 0;
        console.log(`🎯 Активировано автонаведение на ${duration/1000}сек`);
    }

    // НОВЫЙ МЕТОД: Обновление автонаведения
    updateAutoAim() {
        if (this.hasAutoAim) {
            this.autoAimTimer += 16; // примерно 60 FPS
            this.autoAimBlink++;

            if (this.autoAimTimer >= this.autoAimDuration) {
                this.hasAutoAim = false;
                console.log('🎯 Автонаведение закончилось');
            }
        }
    }

    // НОВЫЙ МЕТОД: Определяем, будет ли у танка бонус
    determineBonus() {
        if (Math.random() < (typeof BONUS_TANK_CHANCE !== 'undefined' ? BONUS_TANK_CHANCE : 0.2)) {
            this.hasBonus = true;
            const bonusTypes = Object.values(BONUS_TYPES || {
                LIFE: { id: 'LIFE', symbol: '❤️', color: '#FF4081' },
                SHIELD: { id: 'SHIELD', symbol: '🛡️', color: '#00BFFF' },
                TIME_STOP: { id: 'TIME_STOP', symbol: '⏰', color: '#00FFFF' }
            });
            this.bonusType = bonusTypes[Math.floor(Math.random() * bonusTypes.length)];
            console.log(`🎯 Танк ${this.username} несет бонус: ${this.bonusType.id}`);
        }
    }

    // НОВЫЙ МЕТОД: Плавное мигание
    updateBlink() {
        if (this.hasBonus && this.type === 'enemy') {
            this.blinkTimer++;

            // Изменяем прозрачность плавно
            const blinkSpeed = 0.08;
            this.blinkAlpha += this.blinkDirection * blinkSpeed;

            // Ограничиваем прозрачность от 0.5 до 1.0
            if (this.blinkAlpha <= 0.5) {
                this.blinkAlpha = 0.5;
                this.blinkDirection = 1;
            } else if (this.blinkAlpha >= 1.0) {
                this.blinkAlpha = 1.0;
                this.blinkDirection = -1;
            }
        }
    }

    // Генерация имени в зависимости от типа врага
    generateEnemyName(enemyType) {
        const typeNames = ENEMY_NAMES[enemyType] || ['Враг'];
        return typeNames[Math.floor(Math.random() * typeNames.length)];
    }

    // НОВЫЙ МЕТОД: Активация неуязвимости
    activateInvincibility(duration) {
        this.isInvincible = true;
        this.invincibilityDuration = duration;
        this.invincibilityTimer = 0;
        this.invincibilityBlink = 0;
        console.log(`🛡️ Активирована неуязвимость на ${duration/1000}сек`);
    }

    // НОВЫЙ МЕТОД: Обновление неуязвимости
    updateInvincibility() {
        if (this.isInvincible) {
            this.invincibilityTimer += 16; // примерно 60 FPS
            this.invincibilityBlink++;

            if (this.invincibilityTimer >= this.invincibilityDuration) {
                this.isInvincible = false;
                console.log('🛡️ Неуязвимость закончилась');
            }
        }
    }

    // ОБНОВЛЯЕМ метод takeDamage для учета дополнительного здоровья
    takeDamage() {
        if (this.hasShield() || this.isInvincible) {
            console.log('🛡️ Урон заблокирован щитом/неуязвимостью');
            return false;
        }

        this.health--;
        if (this.health <= 0) {
            this.isDestroyed = true;
            if (this.hasBonus) {
                return 'bonus';
            }
            return true;
        } else {
            console.log(`❤️ Осталось здоровья: ${this.health}`);
            return false;
        }
    }

    // ОБНОВЛЯЕМ метод update
    update() {
        if (this.isDestroyed) return;

        // Обновляем эффект заморозки
        if (this.isFrozen) {
            const elapsed = Date.now() - this.freezeStartTime;
            const progress = elapsed / this.freezeDuration;

            if (progress >= 1) {
                // Размораживаем
                this.isFrozen = false;
                this.speed = this.originalSpeed;
                this.canShoot = this.originalCanShoot;
                this.iceCrystals = [];
                console.log('❄️ Танк разморожен');
            } else {
                // Обновляем прогресс заморозки/таяния
                if (progress < 0.1) {
                    // Быстрое замерзание (1.2 секунды)
                    this.freezeProgress = progress * 10;
                } else if (progress > 0.92) {
                    // Медленное таяние (1 секунда) - синхронизируем со звуком
                    this.freezeProgress = 1 - ((progress - 0.92) * 12.5);
                } else {
                    // Полная заморозка
                    this.freezeProgress = 1;
                }

                // Обновляем кристаллы
                this.updateIceCrystals();
            }
            return;
        }


        // Обновляем неуязвимость
        this.updateInvincibility();

        // Обновляем автонаведение
        this.updateAutoAim();

        if (this.spawnProtection > 0) {
            this.spawnProtection--;
        }

        // Обновляем щит
        if (this.shield) {
            if (!this.shield.update()) {
                this.shield = null;
            }
        }

        if (!this.canShoot) {
            this.reloadTime--;
            if (this.reloadTime <= 0) {
                this.canShoot = true;
            }
        }

        if (this.stuckTimer < 100) {
            this.stuckTimer++;
        }

        if (this.hasBonus && this.type === 'enemy') {
            this.updateBlink();
        }
    }

    updateIceCrystals() {
        this.iceCrystals.forEach(crystal => {
            crystal.rotation += 0.02;
            crystal.pulse += 0.1;
            crystal.growth = Math.min(1, crystal.growth + 0.1);
            crystal.alpha = this.freezeProgress;
        });
    }

    // НОВЫЙ МЕТОД: Поиск ближайшего врага для автонаведения
    findNearestTarget(enemies, map) {
        if (!this.hasAutoAim || enemies.length === 0) return null;

        let nearestEnemy = null;
        let nearestDistance = Infinity;

        enemies.forEach(enemy => {
            if (enemy.isDestroyed) return;

            const distance = Math.sqrt(
                Math.pow(this.position.x - enemy.position.x, 2) +
                Math.pow(this.position.y - enemy.position.y, 2)
            );

            // Проверяем прямую видимость (упрощенно)
            if (this.hasLineOfSight(enemy, map) && distance < nearestDistance) {
                nearestDistance = distance;
                nearestEnemy = enemy;
            }
        });

        return nearestEnemy;
    }

    // НОВЫЙ МЕТОД: Проверка прямой видимости (упрощенная)
    hasLineOfSight(target, map) {
        // Упрощенная проверка - только расстояние
        // Можно улучшить проверкой коллизий с картой
        const distance = Math.sqrt(
            Math.pow(this.position.x - target.position.x, 2) +
            Math.pow(this.position.y - target.position.y, 2)
        );

        return distance < 400; // Максимальная дальность автонаведения
    }

    // Новый метод для разрешения столкновений между танками
    resolveTankCollision(otherTank) {
        const dx = this.position.x - otherTank.position.x;
        const dy = this.position.y - otherTank.position.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance === 0) return;

        const minDistance = this.size;
        const overlap = minDistance - distance;

        if (overlap > 0) {
            const pushX = (dx / distance) * overlap * 0.5;
            const pushY = (dy / distance) * overlap * 0.5;

            this.position = this.position.add(new Vector2(pushX, pushY));
            otherTank.position = otherTank.position.add(new Vector2(-pushX, -pushY));

            this.stuckTimer = 0;
            otherTank.stuckTimer = 0;
        }
    }

    // НОВЫЕ МЕТОДЫ ДЛЯ АКТИВАЦИИ БОНУСОВ
    activateShield(duration = 5000) { // duration в миллисекундах
        this.shield = new ShieldEffect(this);
        this.shield.duration = duration; // Устанавливаем нужную длительность
        console.log(`🛡️ Активирован щит на ${duration/1000}сек`);
    }

    activateInvincibility() {
        this.isInvincible = true;
        this.invincibilityTimer = 0;
        this.invincibilityDuration = 10000; // 10 секунд
        console.log('⭐ Активирована неуязвимость!');
    }

    activateAutoAim() {
        this.hasAutoAim = true;
        this.autoAimTimer = 0;
        this.autoAimDuration = 20000; // 20 секунд
        console.log('🎯 Активировано автонаведение!');
    }

    // Добавляем метод заморозки
    freeze(duration) {
        if (this.type !== 'enemy') return;

        this.isFrozen = true;
        this.freezeStartTime = Date.now();
        this.freezeDuration = duration;
        this.originalSpeed = this.speed;
        this.originalCanShoot = this.canShoot;
        this.speed = 0;
        this.canShoot = false;

        // Создаем кристаллы льда
        this.createIceCrystals();

        console.log(`❄️ Танк ${this.username} заморожен на ${duration/1000}сек`);
    }

    createIceCrystals() {
        this.iceCrystals = [];
        const crystalCount = 8 + Math.floor(Math.random() * 8);

        for (let i = 0; i < crystalCount; i++) {
            this.iceCrystals.push({
                x: (Math.random() - 0.5) * this.size * 1.5,
                                  y: (Math.random() - 0.5) * this.size * 1.5,
                                  size: 3 + Math.random() * 6,
                                  rotation: Math.random() * Math.PI * 2,
                                  growth: 0,
                                  alpha: 1,
                                  pulse: Math.random() * Math.PI * 2
            });
        }
    }

    hasShield() {
        return this.shield && this.shield.active;
    }

    move(newDirection, map, otherTanks = [], brickFragments = []) {
        if (this.isDestroyed) return false;

        const oldDirection = this.direction;
        this.direction = newDirection;

        const directionVector = new Vector2(this.direction.x, this.direction.y);
        let currentSpeed = this.speed;

        const newPos = this.position.add(directionVector.multiply(currentSpeed));
        const tankBounds = new Rectangle(
            newPos.x - this.size/2 + 2,
            newPos.y - this.size/2 + 2,
            this.size - 4,
            this.size - 4
        );

        if (newPos.x < TILE_SIZE + this.size/2 || newPos.x > CANVAS_WIDTH - TILE_SIZE - this.size/2 ||
            newPos.y < TILE_SIZE + this.size/2 || newPos.y > CANVAS_HEIGHT - TILE_SIZE - this.size/2) {
            return false;
            }

            if (map.checkCollision(tankBounds)) {
                return false;
            }

            for (const otherTank of otherTanks) {
                if (otherTank !== this && !otherTank.isDestroyed && tankBounds.intersects(otherTank.getBounds())) {
                    return false;
                }
            }

            let fragmentCollision = false;
            for (const fragment of brickFragments) {
                if (fragment.collisionEnabled && fragment.active && tankBounds.intersects(fragment.getBounds())) {
                    fragmentCollision = true;
                    break;
                }
            }

            if (fragmentCollision) {
                let speedMultiplier;
                if (this.type === 'player') {
                    speedMultiplier = 0.6;
                } else {
                    speedMultiplier = 0.8;
                }

                const adjustedSpeed = currentSpeed * speedMultiplier;
                const adjustedPos = this.position.add(directionVector.multiply(adjustedSpeed));
                const adjustedBounds = new Rectangle(
                    adjustedPos.x - this.size/2 + 2,
                    adjustedPos.y - this.size/2 + 2,
                    this.size - 4,
                    this.size - 4
                );

                if (!map.checkCollision(adjustedBounds)) {
                    let tankCollision = false;
                    for (const otherTank of otherTanks) {
                        if (otherTank !== this && !otherTank.isDestroyed && adjustedBounds.intersects(otherTank.getBounds())) {
                            tankCollision = true;
                            break;
                        }
                    }

                    if (!tankCollision) {
                        this.position = adjustedPos;
                        return true;
                    }
                }

                return false;
            } else {
                this.position = newPos;
                return true;
            }
    }

    // ОБНОВЛЯЕМ метод shoot для учета улучшенных пуль
    shoot(nearestEnemy = null) {
        if (this.isDestroyed || !this.canShoot) return null;

        this.canShoot = false;
        this.reloadTime = this.type === 'player' ? this.upgrade.reloadTime :
        this.enemyType === 'FAST' ? 25 :
        this.enemyType === 'HEAVY' ? 60 : 40;

        let direction = this.direction;

        // Автонаведение для игрока
        if (this.type === 'player' && this.hasAutoAim && nearestEnemy) {
            const dx = nearestEnemy.position.x - this.position.x;
            const dy = nearestEnemy.position.y - this.position.y;

            if (Math.abs(dx) > Math.abs(dy)) {
                direction = dx > 0 ? DIRECTIONS.RIGHT : DIRECTIONS.LEFT;
            } else {
                direction = dy > 0 ? DIRECTIONS.DOWN : DIRECTIONS.UP;
            }
        }

        const directionVector = new Vector2(this.direction.x, this.direction.y);
        const offset = directionVector.multiply(this.size / 2 + 5);
        const bulletX = this.position.x + offset.x;
        const bulletY = this.position.y + offset.y;

        // НОВОЕ: Передаем мощность пули
        const bullet = new Bullet(bulletX, bulletY, direction, this.type, this,
                                  this.hasAutoAim, nearestEnemy, this.bulletPower);

        if (this.type === 'enemy' && typeof game !== 'undefined') {
            game.soundManager.playEnemyShot(this.enemyType);
        }

        return bullet;
    }

    // ОБНОВЛЯЕМ метод draw для добавления башни
    draw(ctx) {
        if (this.isDestroyed) return;

        ctx.save();
        ctx.translate(this.position.x, this.position.y);

        let angle = 0;
        if (this.direction === DIRECTIONS.RIGHT) angle = Math.PI / 2;
        else if (this.direction === DIRECTIONS.DOWN) angle = Math.PI;
        else if (this.direction === DIRECTIONS.LEFT) angle = -Math.PI / 2;

        ctx.rotate(angle);

        // Эффект неуязвимости (мигание)
        if (this.isInvincible) {
            const blinkVisible = Math.floor(this.invincibilityBlink / 5) % 2 === 0;
            if (!blinkVisible) {
                ctx.globalAlpha = 0.3;
            }
        }
        else if (this.spawnProtection > 0 && this.spawnProtection % 10 < 5) {
            ctx.globalAlpha = 0.5;
        }

        // Корпус танка (цвет теперь зависит от уровня)
        ctx.fillStyle = this.color;
        ctx.fillRect(-this.size/2, -this.size/2, this.size, this.size);

        // НОВОЕ: Башня танка (круглая)
        this.drawTurret(ctx);

        // Индикатор уровня на корпусе
        if (this.type === 'player' && this.playerLevel > 1) {
            this.drawLevelIndicator(ctx);
        }

        // Особое оформление для танков с бонусами
        if (this.hasBonus) {
            ctx.strokeStyle = `rgba(255, 255, 255, ${this.blinkAlpha})`;
            ctx.lineWidth = 3;
            ctx.strokeRect(-this.size/2, -this.size/2, this.size, this.size);
            ctx.shadowColor = '#FFFFFF';
            ctx.shadowBlur = 10 * this.blinkAlpha;
        }

        // Детали корпуса (убираем старый квадрат, теперь есть башня)
        ctx.fillStyle = this.type === 'player' ? this.getDarkColor(this.color) : '#CC3333';

        // Рисуем люк на башне вместо квадрата на корпусе
        ctx.fillStyle = '#2C3E50'; // Темно-серый для люка
        ctx.beginPath();
        ctx.arc(0, 0, this.size/6, 0, Math.PI * 2);
        ctx.fill();

        // Дуло (толще для высоких уровней)
        const barrelWidth = this.size * (this.type === 'player' ?
        0.15 + (this.playerLevel * 0.015) : 0.2);
        const barrelLength = this.size * 0.8;

        ctx.fillStyle = '#333';
        ctx.fillRect(-barrelWidth/2, -barrelLength - 2, barrelWidth, barrelLength);

        // Сброс тени
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1.0;

        // Рисуем электронный блок автонаведения
        if (this.hasAutoAim && this.type === 'player') {
            this.drawAutoAimDevice(ctx);
        }

        ctx.restore();

        // Рисуем щит поверх танка
        if (this.shield) {
            this.shield.draw(ctx);
        }

        // Визуальный эффект неуязвимости
        if (this.isInvincible) {
            this.drawInvincibilityEffect(ctx);
        }

        // Отображаем иконку бонуса над танком
        if (this.hasBonus) {
            const iconAlpha = 0.3 + (this.blinkAlpha * 0.7);
            ctx.fillStyle = `rgba(0, 0, 0, ${0.7 * iconAlpha})`;
            const textWidth = ctx.measureText(this.bonusType.symbol).width + 8;
            ctx.fillRect(
                this.position.x - textWidth/2,
                this.position.y - this.size - 25,
                textWidth,
                20
            );
            ctx.fillStyle = this.bonusType.color;
            ctx.globalAlpha = iconAlpha;
            ctx.font = 'bold 14px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(this.bonusType.symbol, this.position.x, this.position.y - this.size - 12);
            ctx.globalAlpha = 1.0;
        }

        // Отображаем уровень игрока над танком
        if (this.type === 'player') {
            this.drawPlayerLevel(ctx);
        }

        if (this.type === 'enemy' && this.username) {
            ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
            const textWidth = ctx.measureText(this.username).width;
            ctx.fillRect(
                this.position.x - textWidth/2 - 2,
                this.position.y - this.size - (this.hasBonus ? 45 : 22),
                         textWidth + 4,
                         16
            );
            ctx.fillStyle = '#FFF';
            ctx.font = '10px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(this.username, this.position.x, this.position.y - this.size - (this.hasBonus ? 35 : 10));
        }

        // Рисуем эффект заморозки поверх танка
        if (this.isFrozen && this.freezeProgress > 0) {
            this.drawFreezeEffect(ctx);
        }
    }

    // НОВЫЙ МЕТОД: Отрисовка башни танка
    drawTurret(ctx) {
        const turretRadius = this.size / 3;

        // Основная башня
        ctx.fillStyle = this.type === 'player' ? this.getDarkColor(this.color) : '#AA3333';
        ctx.beginPath();
        ctx.arc(0, 0, turretRadius, 0, Math.PI * 2);
        ctx.fill();

        // Обводка башни
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 1;
        ctx.stroke();

        // Детали на башне (люк)
        ctx.fillStyle = '#2C3E50';
        ctx.beginPath();
        ctx.arc(0, 0, turretRadius / 2, 0, Math.PI * 2);
        ctx.fill();

        // Блики на башне для объема
        ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.beginPath();
        ctx.arc(-turretRadius/3, -turretRadius/3, turretRadius/4, 0, Math.PI * 2);
        ctx.fill();
    }

    // НОВЫЙ МЕТОД: Отрисовка индикатора уровня на башне (вместо корпуса)
    drawLevelIndicator(ctx) {
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 9px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(this.playerLevel.toString(), 0, 0);
    }

    // НОВЫЙ МЕТОД: Отрисовка уровня над танком
    drawPlayerLevel(ctx) {
        const levelText = `Ур.${this.playerLevel}`;
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        const textWidth = ctx.measureText(levelText).width;
        ctx.fillRect(
            this.position.x - textWidth/2 - 3,
            this.position.y - this.size - 42,
            textWidth + 6,
            14
        );

        ctx.fillStyle = this.color;
        ctx.font = 'bold 10px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(levelText, this.position.x, this.position.y - this.size - 32);
    }

    // НОВЫЙ МЕТОД: Получение темного цвета для деталей
    getDarkColor(baseColor) {
        // Простое затемнение цвета
        return baseColor.replace(')', ', 0.7)').replace('rgb', 'rgba');
    }

    // НОВЫЙ МЕТОД: Эффект неуязвимости
    drawInvincibilityEffect(ctx) {
        ctx.save();
        ctx.translate(this.position.x, this.position.y);

        const time = Date.now() * 0.01;
        const pulse = Math.sin(time) * 0.3 + 0.7;

        // Синее сияние
        const gradient = ctx.createRadialGradient(0, 0, this.size * 0.5, 0, 0, this.size * 1.5);
        gradient.addColorStop(0, 'rgba(100, 200, 255, 0.8)');
        gradient.addColorStop(1, 'rgba(100, 200, 255, 0)');

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(0, 0, this.size * 1.5 * pulse, 0, Math.PI * 2);
        ctx.fill();

        // Вращающиеся частицы
        ctx.strokeStyle = `rgba(255, 255, 255, ${pulse})`;
        ctx.lineWidth = 2;
        for (let i = 0; i < 8; i++) {
            const angle = (i / 8) * Math.PI * 2 + time * 0.5;
            const innerRadius = this.size * 0.8;
            const outerRadius = this.size * 1.8;

            const x1 = Math.cos(angle) * innerRadius;
            const y1 = Math.sin(angle) * innerRadius;
            const x2 = Math.cos(angle) * outerRadius;
            const y2 = Math.sin(angle) * outerRadius;

            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.stroke();
        }

        ctx.restore();
    }

    // НОВЫЙ МЕТОД: Отрисовка электронного блока автонаведения
    drawAutoAimDevice(ctx) {
        ctx.save();

        // Позиция на ЛЕВОЙ стороне кормы танка
        const blockWidth = this.size * 0.3;  // Высота блока (теперь по вертикали)
        const blockHeight = this.size * 0.3; // Ширина блока (теперь по горизонтали)
        const blockX = -this.size/2 - blockHeight + 10; // Слева от танка
        const blockY = -blockWidth/2 - 6; // По центру по вертикали

        // Поворачиваем блок на 90 градусов
        ctx.rotate(-Math.PI / 2);

        // Основа блока
        ctx.fillStyle = '#2C3E50';
        ctx.fillRect(blockX, blockY, blockHeight, blockWidth);

        // Обводка
        ctx.strokeStyle = '#34495E';
        ctx.lineWidth = 1;
        ctx.strokeRect(blockX, blockY, blockHeight, blockWidth);

        // Мигающие индикаторы (теперь вертикальное расположение)
        const time = Date.now() * 0.001;
        const ledSize = blockWidth * 0.15;

        // Синий индикатор (мигает быстро) - ВЕРХНИЙ
        const blueAlpha = 0.3 + Math.sin(time * 8) * 0.3;
        ctx.fillStyle = `rgba(0, 150, 255, ${blueAlpha})`;
        ctx.fillRect(blockX + blockHeight * 0.3, blockY + blockWidth * 0.2, ledSize, ledSize);

        // Зеленый индикатор (мигает средне) - СРЕДНИЙ
        const greenAlpha = 0.3 + Math.sin(time * 5 + 1) * 0.3;
        ctx.fillStyle = `rgba(0, 255, 100, ${greenAlpha})`;
        ctx.fillRect(blockX + blockHeight * 0.3, blockY + blockWidth * 0.5, ledSize, ledSize);

        // Красный индикатор (мигает медленно) - НИЖНИЙ
        const redAlpha = 0.3 + Math.sin(time * 3 + 2) * 0.3;
        ctx.fillStyle = `rgba(255, 50, 50, ${redAlpha})`;
        ctx.fillRect(blockX + blockHeight * 0.3, blockY + blockWidth * 0.8, ledSize, ledSize);

        // Свечение
        ctx.shadowColor = '#9C27B0';
        ctx.shadowBlur = 5;
        ctx.strokeStyle = `rgba(156, 39, 176, 0.3)`;
        ctx.lineWidth = 2;
        ctx.strokeRect(blockX - 1, blockY - 1, blockHeight + 2, blockWidth + 2);
        ctx.shadowBlur = 0;

        ctx.restore();
    }

    drawFreezeEffect(ctx) {
        ctx.save();
        ctx.translate(this.position.x, this.position.y);

        // Голубое свечение вокруг замороженного танка
        const glowIntensity = this.freezeProgress * 0.3;
        const gradient = ctx.createRadialGradient(0, 0, this.size * 0.5, 0, 0, this.size * 1.2);
        gradient.addColorStop(0, `rgba(100, 200, 255, ${glowIntensity})`);
        gradient.addColorStop(1, 'rgba(100, 200, 255, 0)');

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(0, 0, this.size * 1.2, 0, Math.PI * 2);
        ctx.fill();

        // Ледяная корка на танке
        ctx.fillStyle = `rgba(200, 230, 255, ${this.freezeProgress * 0.3})`;
        ctx.fillRect(-this.size/2, -this.size/2, this.size, this.size);

        // Кристаллы льда
        this.iceCrystals.forEach(crystal => {
            if (crystal.growth > 0) {
                ctx.save();
                ctx.translate(crystal.x, crystal.y);
                ctx.rotate(crystal.rotation);

                const pulse = Math.sin(crystal.pulse) * 0.2 + 0.8;
                const alpha = crystal.alpha * crystal.growth * pulse;

                // Блестящие кристаллы
                ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
                ctx.strokeStyle = `rgba(200, 230, 255, ${alpha})`;
                ctx.lineWidth = 1;

                // Рисуем кристалл (шестиугольник)
                ctx.beginPath();
                for (let i = 0; i < 6; i++) {
                    const angle = (i / 6) * Math.PI * 2;
                    const x = Math.cos(angle) * crystal.size;
                    const y = Math.sin(angle) * crystal.size;
                    if (i === 0) ctx.moveTo(x, y);
                    else ctx.lineTo(x, y);
                }
                ctx.closePath();
                ctx.fill();
                ctx.stroke();

                // Блики на кристаллах
                ctx.fillStyle = `rgba(255, 255, 255, ${alpha * 0.8})`;
                ctx.beginPath();
                ctx.arc(crystal.size * 0.3, -crystal.size * 0.3, crystal.size * 0.2, 0, Math.PI * 2);
                ctx.fill();

                ctx.restore();
            }
        });

        // Иней по краям танка
        ctx.strokeStyle = `rgba(255, 255, 255, ${this.freezeProgress * 0.6})`;
        ctx.lineWidth = 2;
        ctx.strokeRect(-this.size/2, -this.size/2, this.size, this.size);

        ctx.restore();
    }

    getBounds() {
        return new Rectangle(
            this.position.x - this.size/2,
            this.position.y - this.size/2,
            this.size,
            this.size
        );
    }
}
