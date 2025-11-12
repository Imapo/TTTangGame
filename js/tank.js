// === КЛАСС ТАНКА ===
class Tank {
    constructor(x, y, type = 'player', level = 1, enemyType = 'BASIC') {
        this.position = new Vector2(x, y);
        this.direction = DIRECTIONS.UP;

        // Определяем характеристики в зависимости от типа
        if (type === 'player') {
            this.speed = TANK_SPEED;
            this.color = '#4CAF50';
            this.health = 1;
            this.bulletSpeed = 5;
            this.reloadTime = 20;
        } else {
            // Характеристики врагов в зависимости от типа и уровня
            const enemyConfig = ENEMY_TYPES[enemyType];
            const levelMultiplier = level === 1 ? 1 : 1.2;

            this.speed = enemyConfig.speed * TANK_SPEED * levelMultiplier;
            this.color = enemyConfig.color;
            this.health = enemyConfig.health;
            this.bulletSpeed = enemyConfig.bulletSpeed;
            this.reloadTime = enemyConfig.reloadTime;
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

        // НОВОЕ: Свойства для танков с бонусами
        this.hasBonus = false;
        this.bonusType = null;
        this.blinkTimer = 0;
        this.blinkAlpha = 1.0;
        this.blinkDirection = -1;

        // Для врагов определяем, есть ли бонус
        if (type === 'enemy') {
            this.determineBonus();
        }
    }

    // НОВЫЙ МЕТОД: Определяем, будет ли у танка бонус
    determineBonus() {
        if (Math.random() < (typeof BONUS_TANK_CHANCE !== 'undefined' ? BONUS_TANK_CHANCE : 0.2)) {
            this.hasBonus = true;
            const bonusTypes = Object.values(BONUS_TYPES || { LIFE: { id: 'LIFE', symbol: '❤️', color: '#FF4081' } });
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

    takeDamage() {
        if (this.hasShield()) return false;

        this.health--;
        if (this.health <= 0) {
            this.isDestroyed = true;

            // НОВОЕ: Если танк имел бонус - возвращаем специальный флаг
            if (this.hasBonus) {
                return 'bonus';
            }
            return true;
        }
        return false;
    }

    update() {
        if (this.isDestroyed) return;

        if (this.spawnProtection > 0) {
            this.spawnProtection--;
        }

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

        // НОВОЕ: Обновление плавного мигания
        if (this.hasBonus && this.type === 'enemy') {
            this.updateBlink();
        }
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

    activateShield() {
        this.shield = new ShieldEffect(this);
    }

    hasShield() {
        return this.shield !== null && this.shield.active;
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

    shoot() {
        if (this.isDestroyed || !this.canShoot) return null;

        this.canShoot = false;
        this.reloadTime = this.type === 'player' ? 20 :
        this.enemyType === 'FAST' ? 25 :
        this.enemyType === 'HEAVY' ? 60 : 40;

        const directionVector = new Vector2(this.direction.x, this.direction.y);
        const offset = directionVector.multiply(this.size / 2 + 5);
        const bulletX = this.position.x + offset.x;
        const bulletY = this.position.y + offset.y;

        const bullet = new Bullet(bulletX, bulletY, this.direction, this.type, this);

        if (this.type === 'enemy' && typeof game !== 'undefined') {
            game.soundManager.playEnemyShot(this.enemyType);
        }

        return bullet;
    }

    draw(ctx) {
        if (this.isDestroyed) return;

        ctx.save();
        ctx.translate(this.position.x, this.position.y);

        let angle = 0;
        if (this.direction === DIRECTIONS.RIGHT) angle = Math.PI / 2;
        else if (this.direction === DIRECTIONS.DOWN) angle = Math.PI;
        else if (this.direction === DIRECTIONS.LEFT) angle = -Math.PI / 2;

        ctx.rotate(angle);

        if (this.spawnProtection > 0 && this.spawnProtection % 10 < 5) {
            ctx.globalAlpha = 0.5;
        }

        // Корпус танка
        ctx.fillStyle = this.color;
        ctx.fillRect(-this.size/2, -this.size/2, this.size, this.size);

        // НОВОЕ: Особое оформление для танков с бонусами
        if (this.hasBonus) {
            // Мигающая белая рамка
            ctx.strokeStyle = `rgba(255, 255, 255, ${this.blinkAlpha})`;
            ctx.lineWidth = 3;
            ctx.strokeRect(-this.size/2, -this.size/2, this.size, this.size);

            // Мигающее свечение
            ctx.shadowColor = '#FFFFFF';
            ctx.shadowBlur = 10 * this.blinkAlpha;
        }

        // Детали корпуса
        ctx.fillStyle = this.type === 'player' ? '#388E3C' : '#CC3333';
        ctx.fillRect(-this.size/4, -this.size/4, this.size/2, this.size/2);

        // Дуло
        ctx.fillStyle = '#333';
        const barrelLength = this.size * 0.8;
        const barrelWidth = this.size * 0.25;
        ctx.fillRect(-barrelWidth/2, -barrelLength - 2, barrelWidth, barrelLength);

        // Сброс тени
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1.0;

        ctx.restore();

        // Рисуем щит поверх танка
        if (this.shield) {
            this.shield.draw(ctx);
        }

        // НОВОЕ: Отображаем иконку бонуса над танком
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
