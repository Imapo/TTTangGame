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
        this.enemyType = enemyType; // Сохраняем тип врага
        this.size = TILE_SIZE - 8;
        this.canShoot = true;
        this.username = type === 'enemy' ? this.generateEnemyName(enemyType) : '';
        this.spawnProtection = type === 'enemy' ? 60 : 0;
        this.shield = null;
        this.isDestroyed = false;
        this.stuckTimer = 0;
    }

    // Генерация имени в зависимости от типа врага
    generateEnemyName(enemyType) {
        const names = {
            'BASIC': ['Солдат', 'Рядовой', 'Боец'],
            'FAST': ['Скаут', 'Гонщик', 'Стремительный'],
            'HEAVY': ['Тяжёлый', 'Броня', 'Танк'],
            'SNIPER': ['Снайпер', 'Меткий', 'Прицел'] // Добавляем имена для снайперов
        };
        const typeNames = names[enemyType] || ['Враг'];
        return typeNames[Math.floor(Math.random() * typeNames.length)];
    }

    // Остальные методы остаются без изменений...
    takeDamage() {
        if (this.hasShield()) return false;

        this.health--;
        if (this.health <= 0) {
            this.isDestroyed = true;
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
    }

    // Новый метод для разрешения столкновений между танками
    resolveTankCollision(otherTank) {
        const dx = this.position.x - otherTank.position.x;
        const dy = this.position.y - otherTank.position.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance === 0) return; // Избегаем деления на ноль

        // Минимальное расстояние между танками
        const minDistance = this.size;
        const overlap = minDistance - distance;

        if (overlap > 0) {
            // Вычисляем направление отталкивания
            const pushX = (dx / distance) * overlap * 0.5;
            const pushY = (dy / distance) * overlap * 0.5;

            // Толкаем оба танка в противоположные стороны
            this.position = this.position.add(new Vector2(pushX, pushY));
            otherTank.position = otherTank.position.add(new Vector2(-pushX, -pushY));

            // Сбрасываем таймеры застревания
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

        // Упрощенная проверка - сначала пытаемся двигаться с полной скоростью
        const newPos = this.position.add(directionVector.multiply(currentSpeed));
        const tankBounds = new Rectangle(
            newPos.x - this.size/2 + 2,
            newPos.y - this.size/2 + 2,
            this.size - 4,
            this.size - 4
        );

        // Проверка границ игрового поля
        if (newPos.x < TILE_SIZE + this.size/2 || newPos.x > CANVAS_WIDTH - TILE_SIZE - this.size/2 ||
            newPos.y < TILE_SIZE + this.size/2 || newPos.y > CANVAS_HEIGHT - TILE_SIZE - this.size/2) {
            return false;
            }

            // Проверка столкновения с картой
            if (map.checkCollision(tankBounds)) {
                return false;
            }

            // Проверка столкновения с другими танками
            for (const otherTank of otherTanks) {
                if (otherTank !== this && !otherTank.isDestroyed && tankBounds.intersects(otherTank.getBounds())) {
                    return false;
                }
            }

            // УПРОЩЕННАЯ проверка столкновения с осколками
            let fragmentCollision = false;
            for (const fragment of brickFragments) {
                if (fragment.collisionEnabled && fragment.active && tankBounds.intersects(fragment.getBounds())) {
                    fragmentCollision = true;
                    break;
                }
            }

            // Если есть столкновение с осколками, применяем замедление
            if (fragmentCollision) {
                let speedMultiplier;
                if (this.type === 'player') {
                    speedMultiplier = 0.6; // Игрок замедляется до 60% скорости
                } else {
                    speedMultiplier = 0.8; // Враги замедляются до 80% скорости
                }

                const adjustedSpeed = currentSpeed * speedMultiplier;
                const adjustedPos = this.position.add(directionVector.multiply(adjustedSpeed));
                const adjustedBounds = new Rectangle(
                    adjustedPos.x - this.size/2 + 2,
                    adjustedPos.y - this.size/2 + 2,
                    this.size - 4,
                    this.size - 4
                );

                // Простая проверка для замедленного движения
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
                // Нет столкновений - двигаемся с полной скоростью
                this.position = newPos;
                return true;
            }
    }

    shoot() {
        if (this.isDestroyed || !this.canShoot) return null;

        this.canShoot = false;
        this.reloadTime = this.type === 'player' ? 20 : 40;

        const directionVector = new Vector2(this.direction.x, this.direction.y);
        const offset = directionVector.multiply(this.size / 2 + 5);
        const bulletX = this.position.x + offset.x;
        const bulletY = this.position.y + offset.y;

        return new Bullet(bulletX, bulletY, this.direction, this.type);
    }

    takeDamage() {
        // Если есть щит - неуязвим
        if (this.hasShield()) {
            return false;
        }

        this.health--;
        if (this.health <= 0) {
            this.isDestroyed = true; // Помечаем танк как уничтоженный
            return true;
        }
        return false;
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

        // Детали корпуса
        ctx.fillStyle = this.type === 'player' ? '#388E3C' : '#CC3333';
        ctx.fillRect(-this.size/4, -this.size/4, this.size/2, this.size/2);

        // Дуло
        ctx.fillStyle = '#333';
        const barrelLength = this.size * 0.8;
        const barrelWidth = this.size * 0.25;
        ctx.fillRect(-barrelWidth/2, -barrelLength - 2, barrelWidth, barrelLength);

        ctx.restore();

        // Рисуем щит поверх танка
        if (this.shield) {
            this.shield.draw(ctx);
        }

        if (this.type === 'enemy' && this.username) {
            ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
            const textWidth = ctx.measureText(this.username).width;
            ctx.fillRect(
                this.position.x - textWidth/2 - 2,
                this.position.y - this.size - 22,
                textWidth + 4,
                16
            );

            ctx.fillStyle = '#FFF';
            ctx.font = '10px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(this.username, this.position.x, this.position.y - this.size - 10);
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
