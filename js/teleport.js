// КЛАСС ТЕЛЕПОРТА

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

        // Частицы для эффекта
        this.particles = [];
        this.initParticles();
    }

    // Инициализация частиц
    initParticles() {
        this.particles = [];
        const particleCount = 12;

        for (let i = 0; i < particleCount; i++) {
            this.particles.push({
                angle: (i / particleCount) * Math.PI * 2,
                                radius: this.radius * 0.7,
                                size: 3 + Math.random() * 3,
                                speed: 0.5 + Math.random() * 0.5
            });
        }
    }

    update() {
        if (this.closing) {
            // Анимация схлопывания
            const elapsed = Date.now() - this.closeStartTime;
            this.animationProgress = 1 - Math.min(elapsed / this.animationDuration, 1);

            if (this.animationProgress <= 0) {
                this.active = false;
            }
        } else {
            // Пульсирующая анимация
            const elapsed = Date.now() - this.startTime;
            this.animationProgress = Math.sin((elapsed / 300) % (2 * Math.PI)) * 0.2 + 0.8;
        }

        // Обновляем частицы
        this.particles.forEach(particle => {
            particle.angle += particle.speed * 0.02;
        });
    }

    draw(ctx) {
        if (!this.active) return;

        ctx.save();
        ctx.translate(this.position.x, this.position.y);

        // Внешнее свечение
        const outerGradient = ctx.createRadialGradient(0, 0, this.radius * 0.5, 0, 0, this.radius * 1.5);
        if (this.type === 'exit') {
            outerGradient.addColorStop(0, 'rgba(76, 175, 80, 0.3)');
            outerGradient.addColorStop(1, 'rgba(76, 175, 80, 0)');
        } else {
            outerGradient.addColorStop(0, 'rgba(33, 150, 243, 0.3)');
            outerGradient.addColorStop(1, 'rgba(33, 150, 243, 0)');
        }

        ctx.fillStyle = outerGradient;
        ctx.beginPath();
        ctx.arc(0, 0, this.radius * 1.5 * this.animationProgress, 0, Math.PI * 2);
        ctx.fill();

        // Основной круг телепорта
        const mainGradient = ctx.createRadialGradient(0, 0, 0, 0, 0, this.radius);

        if (this.type === 'exit') {
            mainGradient.addColorStop(0, 'rgba(76, 175, 80, 0.9)');
            mainGradient.addColorStop(0.6, 'rgba(76, 175, 80, 0.4)');
            mainGradient.addColorStop(1, 'rgba(76, 175, 80, 0.1)');
        } else {
            mainGradient.addColorStop(0, 'rgba(33, 150, 243, 0.9)');
            mainGradient.addColorStop(0.6, 'rgba(33, 150, 243, 0.4)');
            mainGradient.addColorStop(1, 'rgba(33, 150, 243, 0.1)');
        }

        ctx.fillStyle = mainGradient;
        ctx.beginPath();
        ctx.arc(0, 0, this.radius * this.animationProgress, 0, Math.PI * 2);
        ctx.fill();

        // Вращающиеся частицы
        this.particles.forEach(particle => {
            const x = Math.cos(particle.angle) * particle.radius * this.animationProgress;
            const y = Math.sin(particle.angle) * particle.radius * this.animationProgress;

            // Градиент для частиц
            const particleGradient = ctx.createRadialGradient(x, y, 0, x, y, particle.size);
            particleGradient.addColorStop(0, '#FFFFFF');
            particleGradient.addColorStop(1, this.type === 'exit' ? '#4CAF50' : '#2196F3');

            ctx.fillStyle = particleGradient;
            ctx.beginPath();
            ctx.arc(x, y, particle.size * this.animationProgress, 0, Math.PI * 2);
            ctx.fill();
        });

        // Внутреннее кольцо
        ctx.strokeStyle = this.type === 'exit' ? '#4CAF50' : '#2196F3';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, this.radius * 0.4 * this.animationProgress, 0, Math.PI * 2);
        ctx.stroke();

        // Центральное ядро
        const coreGradient = ctx.createRadialGradient(0, 0, 0, 0, 0, 8);
        coreGradient.addColorStop(0, '#FFFFFF');
        coreGradient.addColorStop(0.7, this.type === 'exit' ? '#4CAF50' : '#2196F3');
        coreGradient.addColorStop(1, this.type === 'exit' ? '#2E7D32' : '#1565C0');

        ctx.fillStyle = coreGradient;
        ctx.beginPath();
        ctx.arc(0, 0, 8 * this.animationProgress, 0, Math.PI * 2);
        ctx.fill();

        // Эффект искр в центре
        const sparkTime = Date.now() / 100;
        for (let i = 0; i < 3; i++) {
            const sparkAngle = sparkTime + (i / 3) * Math.PI * 2;
            const sparkLength = 5 + Math.sin(sparkTime * 2) * 3;
            const sparkX = Math.cos(sparkAngle) * sparkLength;
            const sparkY = Math.sin(sparkAngle) * sparkLength;

            ctx.strokeStyle = '#FFFFFF';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(sparkX, sparkY);
            ctx.stroke();
        }

        // Текст под телепортом
        ctx.fillStyle = '#FFFFFF';
        ctx.font = '12px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText(this.type === 'exit' ? 'ВЫХОД' : 'ВХОД', 0, this.radius + 10);

        ctx.restore();
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

        // Проверка пересечения прямоугольников
        const collision = (
            playerBounds.x < teleportBounds.x + teleportBounds.width &&
            playerBounds.x + playerBounds.width > teleportBounds.x &&
            playerBounds.y < teleportBounds.y + teleportBounds.height &&
            playerBounds.y + playerBounds.height > teleportBounds.y
        );

        if (collision) {
            // Дополнительная проверка расстояния до центра
            const dx = player.position.x - this.position.x;
            const dy = player.position.y - this.position.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            return distance < this.radius * 0.8;
        }

        return false;
    }

    // Метод для активации эффекта при использовании
    activate() {
        // Создаем вспышку
        if (window.game && window.game.effectManager) {
            window.game.effectManager.addExplosion(
                this.position.x,
                this.position.y,
                'teleport',
                this.type === 'exit' ? '#4CAF50' : '#2196F3'
            );
        }
    }
}
