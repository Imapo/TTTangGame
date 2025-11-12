// === КЛАССЫ ЭФФЕКТОВ И АНИМАЦИЙ ===

class ShieldEffect {
    constructor(tank) {
        this.tank = tank;
        this.active = true;
        this.startTime = Date.now();
        this.duration = PLAYER_SHIELD_DURATION;
        this.radius = tank.size * 1.3;
    }

    update() {
        const elapsed = Date.now() - this.startTime;
        if (elapsed >= this.duration) {
            this.active = false;
        }
        return this.active;
    }

    draw(ctx) {
        if (!this.active) return;

        const elapsed = Date.now() - this.startTime;
        const progress = elapsed / this.duration;
        const remaining = 1 - progress;

        ctx.save();
        ctx.translate(this.tank.position.x, this.tank.position.y);

        // Пульсирующий эффект
        const pulse = Math.sin(Date.now() * 0.01) * 0.2 + 0.8;
        const currentRadius = this.radius * pulse;

        // Градиентное силовое поле
        const gradient = ctx.createRadialGradient(0, 0, currentRadius * 0.3, 0, 0, currentRadius);
        gradient.addColorStop(0, 'rgba(0, 150, 255, 0.8)');
        gradient.addColorStop(0.7, 'rgba(0, 100, 255, 0.4)');
        gradient.addColorStop(1, 'rgba(0, 50, 255, 0.1)');

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(0, 0, currentRadius, 0, Math.PI * 2);
        ctx.fill();

        // Внешнее кольцо
        ctx.strokeStyle = `rgba(100, 200, 255, ${remaining * 0.8})`;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(0, 0, currentRadius, 0, Math.PI * 2);
        ctx.stroke();

        // Энергетические частицы
        ctx.strokeStyle = `rgba(255, 255, 255, ${remaining * 0.6})`;
        ctx.lineWidth = 1;
        for (let i = 0; i < 12; i++) {
            const angle = (i / 12) * Math.PI * 2 + progress * Math.PI;
            const innerRadius = currentRadius * 0.7;
            const outerRadius = currentRadius * 1.1;

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

    getRemainingTime() {
        const elapsed = Date.now() - this.startTime;
        return Math.max(0, (this.duration - elapsed) / 1000);
    }
}

class BulletExplosion {
    constructor(x, y) {
        this.position = new Vector2(x, y);
        this.particles = [];
        this.active = true;
        this.lifetime = 20;

        // Создаем частицы
        for (let i = 0; i < 8; i++) {
            this.particles.push({
                position: new Vector2(x, y),
                velocity: new Vector2(
                    (Math.random() - 0.5) * 6,
                    (Math.random() - 0.5) * 6
                ),
                life: 20 + Math.random() * 10
            });
        }
    }

    update() {
        this.lifetime--;
        if (this.lifetime <= 0) {
            this.active = false;
        }

        this.particles.forEach(particle => {
            particle.position = particle.position.add(particle.velocity);
            particle.life--;
            particle.velocity = particle.velocity.multiply(0.95);
        });

        this.particles = this.particles.filter(p => p.life > 0);
    }

    draw(ctx) {
        if (!this.active) return;

        this.particles.forEach(particle => {
            const alpha = particle.life / 30;
            ctx.fillStyle = `rgba(255, 255, 0, ${alpha})`;
            ctx.beginPath();
            ctx.arc(
                particle.position.x,
                particle.position.y,
                2,
                0,
                Math.PI * 2
            );
            ctx.fill();
        });
    }
}

class Explosion {
    constructor(x, y, type = 'tank') {
        this.position = new Vector2(x, y);
        this.frame = 0;
        this.totalFrames = type === 'tank' ? 8 : 12;
        this.frameTime = 0;
        this.frameDelay = type === 'tank' ? 50 : 40;
        this.active = true;
        this.size = type === 'tank' ? TILE_SIZE * 1.5 : TILE_SIZE * 2;
        this.type = type;
    }

    update(deltaTime) {
        this.frameTime += deltaTime;
        if (this.frameTime >= this.frameDelay) {
            this.frameTime = 0;
            this.frame++;
            if (this.frame >= this.totalFrames) {
                this.active = false;
            }
        }
    }

    draw(ctx) {
        if (!this.active) return;

        ctx.save();
        ctx.translate(this.position.x, this.position.y);

        const progress = this.frame / this.totalFrames;
        const scale = this.type === 'tank' ?
            (0.5 + progress * 1.5) :
            (0.3 + progress * 2.0);
        const alpha = 1 - progress * 0.8;

        ctx.globalAlpha = alpha;

        if (this.type === 'tank') {
            if (this.frame % 2 === 0) {
                ctx.fillStyle = '#FF4444';
            } else {
                ctx.fillStyle = '#FFAA00';
            }

            const radius = (this.size / 2) * scale;

            ctx.beginPath();
            ctx.arc(0, 0, radius, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = '#FFFF00';
            for (let i = 0; i < 8; i++) {
                const angle = (i / 8) * Math.PI * 2 + progress * Math.PI;
                const flashRadius = radius * 0.7;
                const flashSize = radius * 0.4;
                const x = Math.cos(angle) * flashRadius;
                const y = Math.sin(angle) * flashRadius;

                ctx.beginPath();
                ctx.arc(x, y, flashSize * (0.5 + Math.sin(progress * 10) * 0.5), 0, Math.PI * 2);
                ctx.fill();
            }
        } else {
            ctx.fillStyle = '#FF4444';
            const radius = (this.size / 2) * scale;

            ctx.beginPath();
            ctx.arc(0, 0, radius, 0, Math.PI * 2);
            ctx.fill();

            for (let i = 0; i < 3; i++) {
                const circleProgress = progress - i * 0.2;
                if (circleProgress > 0 && circleProgress < 0.8) {
                    ctx.fillStyle = i === 0 ? '#FFFF00' : i === 1 ? '#FFAA00' : '#FF4444';
                    const circleRadius = radius * (0.3 + circleProgress * 0.7);
                    ctx.globalAlpha = alpha * (1 - circleProgress);
                    ctx.beginPath();
                    ctx.arc(0, 0, circleRadius, 0, Math.PI * 2);
                    ctx.fill();
                }
            }
        }

        ctx.restore();
    }
}

class SpawnAnimation {
    constructor(x, y) {
        this.position = new Vector2(x, y);
        this.progress = 0;
        this.duration = SPAWN_ANIMATION_DURATION;
        this.active = true;
        this.size = TILE_SIZE - 8;
    }

    update(deltaTime) {
        this.progress += deltaTime / this.duration;
        if (this.progress >= 1) {
            this.active = false;
        }
    }

    draw(ctx) {
        if (!this.active) return;

        ctx.save();
        ctx.translate(this.position.x, this.position.y);

        const flashSpeed = 10;
        const visible = Math.floor(this.progress * flashSpeed) % 2 === 0;

        if (visible) {
            ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
            ctx.fillRect(-this.size/2, -this.size/2, this.size, this.size);

            const growProgress = this.progress * 2;
            if (growProgress < 1) {
                ctx.strokeStyle = '#4CAF50';
                ctx.lineWidth = 3;
                ctx.setLineDash([5, 5]);
                const currentSize = this.size * growProgress;
                ctx.strokeRect(-currentSize/2, -currentSize/2, currentSize, currentSize);
                ctx.setLineDash([]);
            }
        }

        ctx.restore();
    }
}