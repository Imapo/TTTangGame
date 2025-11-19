// === КЛАСС ПУЛИ ===
class Bullet {
    constructor(x, y, direction, ownerType, shooter, hasAutoAim = false, target = null, power = 1, speed = 1) {
        this.position = new Vector2(x, y);
        this.direction = direction;
        this.currentDirection = new Vector2(direction.x, direction.y);
        this.speed = speed;
        this.size = 4;
        this.active = true;
        this.owner = ownerType;
        this.shooter = shooter;
        this.hasAutoAim = hasAutoAim;
        this.target = target;
        this.turnRate = 0.1;
        this.power = power;

        // Автонаведение
        this.autoAimDelay = 100;
        this.autoAimTimer = 0;
        this.autoAimActive = false;

        // Трейл
        this.trail = [];
        this.maxTrailLength = 8 + Math.floor(this.speed / 2);
    }

    update() {
        // Обновление автонаведения
        if (this.hasAutoAim && this.target && !this.target.isDestroyed && !this.autoAimActive) {
            this.autoAimTimer += 16;
            if (this.autoAimTimer >= this.autoAimDelay) {
                this.autoAimActive = true;
                this.adjustDirectionToTarget();
            }
        }

        // Автонаведение после задержки
        if (this.autoAimActive && this.target && !this.target.isDestroyed) {
            this.updateAutoAim();
        }

        // Движение
        const directionVector = this.autoAimActive ? this.currentDirection :
        new Vector2(this.direction.x, this.direction.y);
        this.position = this.position.add(directionVector.multiply(this.speed));

        // Обновление трейла
        this.trail.push({ x: this.position.x, y: this.position.y });
        if (this.trail.length > this.maxTrailLength) {
            this.trail.shift();
        }

        // Проверка границ
        if (this.position.x < TILE_SIZE || this.position.x > CANVAS_WIDTH - TILE_SIZE ||
            this.position.y < TILE_SIZE || this.position.y > CANVAS_HEIGHT - TILE_SIZE) {
            this.active = false;
            }
    }

    adjustDirectionToTarget() {
        if (!this.target) return;

        const dx = this.target.position.x - this.position.x;
        const dy = this.target.position.y - this.position.y;

        if (Math.abs(dx) > Math.abs(dy)) {
            this.direction = dx > 0 ? DIRECTIONS.RIGHT : DIRECTIONS.LEFT;
            this.currentDirection = new Vector2(dx > 0 ? 1 : -1, 0);
        } else {
            this.direction = dy > 0 ? DIRECTIONS.DOWN : DIRECTIONS.UP;
            this.currentDirection = new Vector2(0, dy > 0 ? 1 : -1);
        }
    }

    updateAutoAim() {
        const dx = this.target.position.x - this.position.x;
        const dy = this.target.position.y - this.position.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < 10) return;

        // Плавный поворот к цели
        const targetDirection = new Vector2(dx / distance, dy / distance);
        this.currentDirection.x += (targetDirection.x - this.currentDirection.x) * this.turnRate;
        this.currentDirection.y += (targetDirection.y - this.currentDirection.y) * this.turnRate;

        // Нормализация
        const currentLength = Math.sqrt(this.currentDirection.x ** 2 + this.currentDirection.y ** 2);
        if (currentLength > 0) {
            this.currentDirection.x /= currentLength;
            this.currentDirection.y /= currentLength;
        }

        // Обновление основного направления
        if (Math.abs(this.currentDirection.x) > Math.abs(this.currentDirection.y)) {
            this.direction = this.currentDirection.x > 0 ? DIRECTIONS.RIGHT : DIRECTIONS.LEFT;
        } else {
            this.direction = this.currentDirection.y > 0 ? DIRECTIONS.DOWN : DIRECTIONS.UP;
        }
    }

    draw(ctx) {
        // Отрисовка трейла
        if (this.trail.length > 1) {
            ctx.strokeStyle = this.owner === 'player' ? 'rgba(255,255,0,0.3)' : 'rgba(255,0,0,0.3)';
            ctx.lineWidth = this.size / 2;
            ctx.beginPath();
            ctx.moveTo(this.trail[0].x, this.trail[0].y);
            for (let i = 1; i < this.trail.length; i++) {
                ctx.lineTo(this.trail[i].x, this.trail[i].y);
            }
            ctx.stroke();
        }

        // Основная пуля
        const bulletSize = this.size + (this.power - 1) * 2;
        ctx.fillStyle = this.getBulletColor();

        ctx.beginPath();
        ctx.arc(this.position.x, this.position.y, bulletSize / 2, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = '#000';
        ctx.lineWidth = 1;
        ctx.stroke();

        // Индикаторы
        this.drawIndicators(ctx, bulletSize);
    }

    getBulletColor() {
        if (this.owner === 'player') return '#FFFFFF';

        // Цвет вражеской пули в зависимости от скорости
        if (this.speed >= 8) return '#00FFFF';
        if (this.speed >= 6) return '#FF4444';
        if (this.speed >= 4) return '#FF8800';
        return '#880000';
    }

    drawIndicators(ctx, bulletSize) {
        // Индикатор автонаведения
        if (this.hasAutoAim) {
            if (this.autoAimActive) {
                ctx.strokeStyle = 'rgba(156, 39, 176, 0.7)';
            } else {
                const progress = this.autoAimTimer / this.autoAimDelay;
                ctx.strokeStyle = `rgba(33, 150, 243, ${0.3 + progress * 0.4})`;
            }
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(this.position.x, this.position.y, bulletSize / 2 + 2, 0, Math.PI * 2);
            ctx.stroke();
        }

        // Индикатор мощности
        if (this.power > 1) {
            ctx.strokeStyle = '#FFA500';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.arc(this.position.x, this.position.y, bulletSize / 2 + 4, 0, Math.PI * 2);
            ctx.stroke();
        }
    }

    getBounds() {
        const halfSize = this.size / 2;
        return new Rectangle(
            this.position.x - halfSize,
            this.position.y - halfSize,
            this.size,
            this.size
        );
    }
}
