// КЛАСС ТЕЛЕПОРТА (ОПТИМИЗИРОВАННЫЙ)

class Teleport {
    constructor(x, y, type = 'exit') {
        this.position = new Vector2(x, y);
        this.radius = TELEPORT_RADIUS;
        this.type = type; // 'exit' или 'entry'
        this.active = true;
        this.animationProgress = 1.0;
        this.animationDuration = TELEPORT_ANIMATION_DURATION;
        this.startTime = Date.now();

        // Для анимации схлопывания
        this.closing = false;
        this.closeStartTime = 0;

        // Кэширование цветов и вычислений
        this.colors = this.type === 'exit' ?
        { outer: '76, 175, 80', main: '76, 175, 80', core: '#4CAF50', dark: '#2E7D32' } :
        { outer: '33, 150, 243', main: '33, 150, 243', core: '#2196F3', dark: '#1565C0' };

        // Предварительные вычисления
        this.particleCount = 12;
        this.angleStep = (Math.PI * 2) / this.particleCount;

        // Частицы для эффекта
        this.particles = this.initParticles();
    }

    // Инициализация частиц
    initParticles() {
        const particles = [];
        const baseRadius = this.radius * 0.7;

        for (let i = 0; i < this.particleCount; i++) {
            particles.push({
                angle: i * this.angleStep,
                radius: baseRadius,
                size: 3 + Math.random() * 3,
                           speed: 0.5 + Math.random() * 0.5
            });
        }
        return particles;
    }

    update() {
        const currentTime = Date.now();

        if (this.closing) {
            // Анимация схлопывания
            const elapsed = currentTime - this.closeStartTime;
            this.animationProgress = Math.max(0, 1 - elapsed / this.animationDuration);

            if (this.animationProgress <= 0) {
                this.active = false;
                return;
            }
        } else {
            // Пульсирующая анимация (оптимизированная формула)
            const elapsed = (currentTime - this.startTime) / 300;
            this.animationProgress = Math.sin(elapsed) * 0.2 + 0.8;
        }

        // Обновляем частицы (оптимизированный цикл)
        for (let i = 0; i < this.particles.length; i++) {
            this.particles[i].angle += this.particles[i].speed * 0.02;
        }
    }

    draw(ctx) {
        if (!this.active) return;

        ctx.save();
        ctx.translate(this.position.x, this.position.y);

        const progress = this.animationProgress;
        const scaledRadius = this.radius * progress;

        // Внешнее свечение
        this.drawOuterGlow(ctx, scaledRadius);

        // Основной круг телепорта
        this.drawMainCircle(ctx, scaledRadius);

        // Вращающиеся частицы
        this.drawParticles(ctx, progress);

        // Внутреннее кольцо
        this.drawInnerRing(ctx, scaledRadius);

        // Центральное ядро
        this.drawCore(ctx, progress);

        // Эффект искр в центре
        this.drawSparks(ctx);

        // Текст под телепортом
        this.drawLabel(ctx);

        ctx.restore();
    }

    drawOuterGlow(ctx, radius) {
        const gradient = ctx.createRadialGradient(0, 0, radius * 0.33, 0, 0, radius * 1.5);
        gradient.addColorStop(0, `rgba(${this.colors.outer}, 0.3)`);
        gradient.addColorStop(1, `rgba(${this.colors.outer}, 0)`);

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(0, 0, radius * 1.5, 0, Math.PI * 2);
        ctx.fill();
    }

    drawMainCircle(ctx, radius) {
        const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, radius);
        gradient.addColorStop(0, `rgba(${this.colors.main}, 0.9)`);
        gradient.addColorStop(0.6, `rgba(${this.colors.main}, 0.4)`);
        gradient.addColorStop(1, `rgba(${this.colors.main}, 0.1)`);

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(0, 0, radius, 0, Math.PI * 2);
        ctx.fill();
    }

    drawParticles(ctx, progress) {
        for (let i = 0; i < this.particles.length; i++) {
            const p = this.particles[i];
            const x = Math.cos(p.angle) * p.radius * progress;
            const y = Math.sin(p.angle) * p.radius * progress;

            const gradient = ctx.createRadialGradient(x, y, 0, x, y, p.size);
            gradient.addColorStop(0, '#FFFFFF');
            gradient.addColorStop(1, this.colors.core);

            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(x, y, p.size * progress, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    drawInnerRing(ctx, radius) {
        ctx.strokeStyle = this.colors.core;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, radius * 0.4, 0, Math.PI * 2);
        ctx.stroke();
    }

    drawCore(ctx, progress) {
        const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, 8);
        gradient.addColorStop(0, '#FFFFFF');
        gradient.addColorStop(0.7, this.colors.core);
        gradient.addColorStop(1, this.colors.dark);

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(0, 0, 8 * progress, 0, Math.PI * 2);
        ctx.fill();
    }

    drawSparks(ctx) {
        const sparkTime = Date.now() / 100;
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 1;

        for (let i = 0; i < 3; i++) {
            const sparkAngle = sparkTime + (i / 3) * Math.PI * 2;
            const sparkLength = 5 + Math.sin(sparkTime * 2) * 3;
            const sparkX = Math.cos(sparkAngle) * sparkLength;
            const sparkY = Math.sin(sparkAngle) * sparkLength;

            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(sparkX, sparkY);
            ctx.stroke();
        }
    }

    drawLabel(ctx) {
        ctx.fillStyle = '#FFFFFF';
        ctx.font = '12px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText(this.type === 'exit' ? 'ВЫХОД' : 'ВХОД', 0, this.radius + 10);
    }

    getBounds() {
        const currentRadius = this.radius * this.animationProgress;
        return {
            x: this.position.x - currentRadius,
            y: this.position.y - currentRadius,
            width: currentRadius * 2,
            height: currentRadius * 2
        };
    }

    startClosing() {
        this.closing = true;
        this.closeStartTime = Date.now();
        console.log(`🌀 Начинаем схлопывание телепорта ${this.type}`);
    }

    isPlayerInside(player) {
        if (!this.active || !player || this.closing) return false;

        const playerBounds = player.getBounds();
        const teleportBounds = this.getBounds();

        // Проверка пересечения прямоугольников (AABB)
        if (!(playerBounds.x < teleportBounds.x + teleportBounds.width &&
            playerBounds.x + playerBounds.width > teleportBounds.x &&
            playerBounds.y < teleportBounds.y + teleportBounds.height &&
            playerBounds.y + playerBounds.height > teleportBounds.y)) {
            return false;
            }

            // Дополнительная проверка расстояния до центра
            const dx = player.position.x - this.position.x;
        const dy = player.position.y - this.position.y;
        const distanceSquared = dx * dx + dy * dy;

        return distanceSquared < (this.radius * 0.8) ** 2;
    }

    // Метод для активации эффекта при использовании
    activate() {
        // Создаем вспышку
        if (window.game?.effectManager) {
            window.game.effectManager.addExplosion(
                this.position.x,
                this.position.y,
                'teleport',
                this.colors.core
            );
        }
    }
}
