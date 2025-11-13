// === СИСТЕМА БОНУСОВ ===

class Bonus {
    constructor(x, y, type) {
        this.position = new Vector2(x, y);
        this.type = type;
        this.active = true;
        this.spawnTime = Date.now();
        this.lifetime = typeof BONUS_LIFETIME !== 'undefined' ? BONUS_LIFETIME : 10000;
        this.size = TILE_SIZE - 8;
        this.blinkTimer = 0;
        this.animationPhase = 0;
        this.pulsePhase = 0;

        console.log(`🎁 Создан бонус ${type.id} в (${Math.round(x)}, ${Math.round(y)})`);
    }

    update() {
        if (!this.active) return false;

        const elapsed = Date.now() - this.spawnTime;
        if (elapsed >= this.lifetime) {
            this.active = false;
            console.log(`⏰ Бонус ${this.type.id} исчез по времени`);
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

        // Мигание перед исчезновением (последние 3 секунды)
        const shouldDraw = timeLeft > 3000 || Math.floor(this.blinkTimer / 10) % 2 === 0;
        if (!shouldDraw) return;

        ctx.save();
        ctx.translate(this.position.x, this.position.y);

        // Плавающая анимация
        const floatOffset = Math.sin(this.animationPhase) * 3;
        ctx.translate(0, floatOffset);

        // Пульсирующий размер
        const pulseScale = 1 + Math.sin(this.pulsePhase) * 0.1;

        // Фон бонуса (закругленный)
        ctx.fillStyle = 'rgba(0, 0, 0, 0.9)';
        ctx.beginPath();
        ctx.roundRect(-this.size/2 * pulseScale, -this.size/2 * pulseScale, this.size * pulseScale, this.size * pulseScale, 5);
        ctx.fill();

        // Светящаяся рамка
        const glowIntensity = 0.5 + Math.sin(this.pulsePhase * 2) * 0.3;
        ctx.strokeStyle = this.type.color;
        ctx.lineWidth = 3;
        ctx.shadowColor = this.type.color;
        ctx.shadowBlur = 15 * glowIntensity;
        ctx.beginPath();
        ctx.roundRect(-this.size/2 * pulseScale, -this.size/2 * pulseScale, this.size * pulseScale, this.size * pulseScale, 5);
        ctx.stroke();

        // Сброс тени
        ctx.shadowBlur = 0;

        // Символ бонуса (тоже пульсирует)
        ctx.fillStyle = this.type.color;
        ctx.font = `bold ${Math.floor(18 * pulseScale)}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(this.type.symbol, 0, 0);

        // Таймер исчезновения (полоска внизу)
        if (timeLeft < 5000) {
            const progress = timeLeft / 5000;
            ctx.fillStyle = progress > 0.3 ? '#FFD700' : '#FF4444';
            ctx.fillRect(
                -this.size/2 + 2,
                this.size/2 - 4,
                (this.size - 4) * progress,
                         3
            );
        }

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

    applyBonus(game) {
        console.log(`Подобран бонус: ${this.type.id}`);

        switch(this.type.id) {
            case 'LIFE':
                this.applyLifeBonus(game);
                break;
            case 'SHIELD':
                this.applyShieldBonus(game);
                break;
            case 'FORTIFY':
                this.applyFortifyBonus(game);
                break;
            default:
                console.warn(`Неизвестный тип бонуса: ${this.type.id}`);
        }

        // Воспроизводим звук бонуса
        if (game.soundManager) {
            game.soundManager.play(this.type.sound || 'bonusPickup');
        }
    }

    applyLifeBonus(game) {
        game.lives++;
        game.updateUI();

        game.explosions.push(new Explosion(
            this.position.x,
            this.position.y,
            'bonus'
        ));
    }

    applyShieldBonus(game) {
        if (!game.player.isDestroyed) {
            game.player.activateInvincibility(this.type.duration);

            // Визуальный эффект
            game.explosions.push(new Explosion(
                this.position.x,
                this.position.y,
                'bonus'
            ));

            // Тряска экрана
            game.screenShake = 15;
        }
    }

    applyFortifyBonus(game) {
        game.fortifyBase(this.type.duration);

        // Визуальный эффект вокруг базы
        const baseX = Math.floor(game.map.width / 2) * TILE_SIZE + TILE_SIZE/2;
        const baseY = (game.map.height - 2) * TILE_SIZE + TILE_SIZE/2;

        game.explosions.push(new Explosion(baseX, baseY, 'bonus'));

        // Сильная тряска для важного бонуса
        game.screenShake = 20;
    }
}
