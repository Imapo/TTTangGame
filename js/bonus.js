// === ОПТИМИЗИРОВАННАЯ СИСТЕМА БОНУСОВ ===

class Bonus {
    constructor(x, y, type, game) {
        this.position = new Vector2(x, y);
        this.type = type;
        this.active = true;
        this.spawnTime = Date.now();
        this.lifetime = typeof BONUS_LIFETIME !== 'undefined' ? BONUS_LIFETIME : 10000;
        this.size = TILE_SIZE - 8;
        this.blinkTimer = 0;
        this.animationPhase = 0;
        this.pulsePhase = 0;
        this.game = game;

        // Предварительные вычисления
        this.halfSize = this.size / 2;
        this.bounds = new Rectangle(
            this.position.x - this.halfSize,
            this.position.y - this.halfSize,
            this.size,
            this.size
        );

        // Кэширование конфигурации отрисовки
        this.drawConfig = {
            borderRadius: 5,
            fontSize: 18,
            timerHeight: 3,
            timerMargin: 2
        };
    }

    update() {
        if (!this.active) return false;

        const elapsed = Date.now() - this.spawnTime;
        if (elapsed >= this.lifetime) {
            this.active = false;
            return false;
        }

        this.blinkTimer++;
        this.animationPhase = (this.animationPhase + 0.05) % (Math.PI * 2);
        this.pulsePhase = (this.pulsePhase + 0.1) % (Math.PI * 2);

        return true;
    }

    draw(ctx) {
        if (!this.active) return;

        const timeLeft = this.lifetime - (Date.now() - this.spawnTime);

        // Быстрая проверка мигания
        if (timeLeft <= 3000 && Math.floor(this.blinkTimer / 10) % 2 === 0) {
            return;
        }

        ctx.save();
        ctx.translate(this.position.x, this.position.y);

        // Анимации
        const floatOffset = Math.sin(this.animationPhase) * 3;
        const pulseScale = 1 + Math.sin(this.pulsePhase) * 0.1;
        const scaledSize = this.size * pulseScale;
        const scaledHalfSize = scaledSize / 2;

        ctx.translate(0, floatOffset);

        // Фон бонуса
        this.drawBackground(ctx, scaledSize, scaledHalfSize);

        // Светящаяся рамка
        this.drawGlow(ctx, scaledSize, scaledHalfSize, pulseScale);

        // Символ бонуса
        this.drawSymbol(ctx, pulseScale);

        // Таймер исчезновения
        if (timeLeft < 5000) {
            this.drawTimer(ctx, scaledSize, timeLeft);
        }

        ctx.restore();
    }

    drawBackground(ctx, scaledSize, scaledHalfSize) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.9)';
        ctx.beginPath();
        ctx.roundRect(-scaledHalfSize, -scaledHalfSize, scaledSize, scaledSize, this.drawConfig.borderRadius);
        ctx.fill();
    }

    drawGlow(ctx, scaledSize, scaledHalfSize, pulseScale) {
        const glowIntensity = 0.5 + Math.sin(this.pulsePhase * 2) * 0.3;

        ctx.strokeStyle = this.type.color;
        ctx.lineWidth = 3;
        ctx.shadowColor = this.type.color;
        ctx.shadowBlur = 15 * glowIntensity;

        ctx.beginPath();
        ctx.roundRect(-scaledHalfSize, -scaledHalfSize, scaledSize, scaledSize, this.drawConfig.borderRadius);
        ctx.stroke();

        ctx.shadowBlur = 0;
    }

    drawSymbol(ctx, pulseScale) {
        ctx.fillStyle = this.type.color;
        ctx.font = `bold ${Math.floor(this.drawConfig.fontSize * pulseScale)}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(this.type.symbol, 0, 0);
    }

    drawTimer(ctx, scaledSize, timeLeft) {
        const progress = timeLeft / 5000;
        ctx.fillStyle = progress > 0.3 ? '#FFD700' : '#FF4444';

        const timerWidth = (scaledSize - this.drawConfig.timerMargin * 2) * progress;
        ctx.fillRect(
            -scaledSize/2 + this.drawConfig.timerMargin,
            scaledSize/2 - this.drawConfig.timerHeight - 1,
            timerWidth,
            this.drawConfig.timerHeight
        );
    }

    getBounds() {
        // Обновляем bounds на случай изменения позиции
        this.bounds.x = this.position.x - this.halfSize;
        this.bounds.y = this.position.y - this.halfSize;
        return this.bounds;
    }

    applyBonus() {
        if (!this.active) return;

        // Используем lookup table для применения бонусов
        const bonusActions = {
            'LIFE': () => this.applyLifeBonus(),
            'SHIELD': () => this.applyShieldBonus(),
            'FORTIFY': () => this.applyFortifyBonus(),
            'AUTO_AIM': () => this.applyAutoAimBonus(),
            'TIME_STOP': () => this.applyTimeStopBonus()
        };

        const action = bonusActions[this.type.id];
        if (action) {
            action();
        } else {
            console.warn(`Неизвестный тип бонуса: ${this.type.id}`);
        }

        // Воспроизводим звук
        this.playBonusSound();
    }

    applyLifeBonus() {
        this.game.lives++;
        if (this.game.updateUI) {
            this.game.updateUI();
        }
        this.createExplosionEffect();
    }

    applyShieldBonus() {
        if (!this.game.player.isDestroyed) {
            this.game.player.activateShield(10000);
            this.createExplosionEffect();
            this.game.screenShake = 15;
        }
    }

    applyFortifyBonus() {
        if (this.game.fortifyBase) {
            this.game.fortifyBase(this.type.duration);
        }

        const baseX = Math.floor(this.game.map.width / 2) * TILE_SIZE + TILE_SIZE/2;
        const baseY = (this.game.map.height - 2) * TILE_SIZE + TILE_SIZE/2;

        this.createExplosionEffect(baseX, baseY);
        this.game.screenShake = 20;
    }

    applyAutoAimBonus() {
        if (!this.game.player.isDestroyed) {
            this.game.player.activateAutoAim(this.type.duration);
            this.createExplosionEffect();
            this.game.screenShake = 10;
        }
    }

    applyTimeStopBonus() {
        this.game.activateTimeStop();
        this.createExplosionEffect();
        this.game.screenShake = 20;
    }

    playBonusSound() {
        if (this.game.soundManager) {
            this.game.soundManager.play(this.type.sound || 'bonusPickup');
        }
    }

    createExplosionEffect(x = this.position.x, y = this.position.y) {
        // Быстрая проверка доступности системы эффектов
        if (this.game.explosions && typeof Explosion === 'function') {
            this.game.explosions.push(new Explosion(x, y, 'bonus'));
        }
    }

    // Метод для быстрой деактивации
    deactivate() {
        this.active = false;
    }

    // Метод для проверки времени жизни без полного обновления
    isExpired() {
        return Date.now() - this.spawnTime >= this.lifetime;
    }
}
