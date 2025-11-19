// === ОПТИМИЗИРОВАННЫЕ КЛАССЫ ЭФФЕКТОВ И АНИМАЦИЙ ===

class ShieldEffect {
    constructor(tank) {
        this.tank = tank;
        this.active = true;
        this.startTime = Date.now();
        this.duration = PLAYER_SHIELD_DURATION;
        this.radius = tank.size * 1.3;
        this.particles = this.createParticles();
        this.colors = ['rgba(0, 150, 255, 0.8)', 'rgba(0, 100, 255, 0.4)', 'rgba(0, 50, 255, 0.1)'];
    }

    createParticles() {
        const particles = [];
        for (let i = 0; i < 16; i++) {
            particles.push({
                angle: (i / 16) * Math.PI * 2,
                           distance: this.radius * (0.7 + Math.random() * 0.3),
                           speed: 0.02 + Math.random() * 0.03,
                           size: 1 + Math.random() * 2,
                           phase: Math.random() * Math.PI * 2
            });
        }
        return particles;
    }

    update() {
        const elapsed = Date.now() - this.startTime;
        if (elapsed >= this.duration) {
            this.active = false;
            return false;
        }

        // Оптимизированное обновление частиц
        for (let i = 0; i < this.particles.length; i++) {
            const p = this.particles[i];
            p.angle += p.speed;
            p.phase += 0.1;
        }

        return true;
    }

    draw(ctx) {
        if (!this.active) return;

        const elapsed = Date.now() - this.startTime;
        const remaining = 1 - (elapsed / this.duration);
        const pulse = Math.sin(Date.now() * 0.01) * 0.2 + 0.8;
        const currentRadius = this.radius * pulse;

        ctx.save();
        ctx.translate(this.tank.position.x, this.tank.position.y);

        // Градиентное силовое поле
        const gradient = ctx.createRadialGradient(0, 0, currentRadius * 0.3, 0, 0, currentRadius);
        gradient.addColorStop(0, this.colors[0]);
        gradient.addColorStop(0.7, this.colors[1]);
        gradient.addColorStop(1, this.colors[2]);

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(0, 0, currentRadius, 0, Math.PI * 2);
        ctx.fill();

        // Энергетические частицы
        for (let i = 0; i < this.particles.length; i++) {
            const p = this.particles[i];
            const x = Math.cos(p.angle) * p.distance;
            const y = Math.sin(p.angle) * p.distance;
            const alpha = 0.3 + Math.sin(p.phase) * 0.3;

            ctx.fillStyle = `rgba(100, 200, 255, ${alpha * remaining})`;
            ctx.beginPath();
            ctx.arc(x, y, p.size, 0, Math.PI * 2);
            ctx.fill();
        }

        // Внешнее кольцо
        ctx.strokeStyle = `rgba(100, 200, 255, ${remaining * 0.8})`;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(0, 0, currentRadius, 0, Math.PI * 2);
        ctx.stroke();

        ctx.restore();
    }

    getRemainingTime() {
        const elapsed = Date.now() - this.startTime;
        return Math.max(0, (this.duration - elapsed) / 1000);
    }
}

// === ОПТИМИЗИРОВАННЫЙ КЛАСС ВЗРЫВА ===
class Explosion {
    constructor(x, y, type = 'tank') {
        this.position = new Vector2(x, y);
        this.type = type;
        this.active = true;
        this.lifetime = 0;

        // Предварительные вычисления
        this.config = this.getConfig();
        this.maxLifetime = this.config.maxLifetime;
        this.intensity = this.config.intensity;
        this.shakeIntensity = this.config.shakeIntensity;
        this.particleColors = this.config.colors;

        this.particles = this.createParticles();
        this.shockwaves = this.createShockwave();

        // Активация эффектов
        this.activateEffects();
    }

    getConfig() {
        const configs = {
            'tank': { maxLifetime: 60, intensity: 1.0, shakeIntensity: 10, colors: ['#FF4444', '#FFAA00', '#FFFF00', '#FF6B00'] },
            'base': { maxLifetime: 90, intensity: 2.0, shakeIntensity: 40, colors: ['#FF0000', '#FF6B00', '#FFFF00', '#FFFFFF'] },
            'bullet': { maxLifetime: 30, intensity: 0.5, shakeIntensity: 5, colors: ['#FFFF00', '#FFA500', '#FF4500'] },
            'bonus': { maxLifetime: 40, intensity: 0.7, shakeIntensity: 8, colors: ['#FF4081', '#FF80AB', '#FFFFFF'] }
        };
        return configs[this.type] || configs.tank;
    }

    createParticles() {
        const particles = [];
        const particleCount = Math.floor(15 * this.intensity);

        for (let i = 0; i < particleCount; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 1 + Math.random() * 3 * this.intensity;
            const size = 2 + Math.random() * 4 * this.intensity;

            particles.push({
                position: new Vector2(this.position.x, this.position.y),
                           velocity: new Vector2(Math.cos(angle) * speed, Math.sin(angle) * speed),
                           size: size,
                           startSize: size,
                           color: this.particleColors[Math.floor(Math.random() * this.particleColors.length)],
                           life: 1.0,
                           decay: 0.02 + Math.random() * 0.03,
                           rotation: Math.random() * Math.PI * 2,
                           rotationSpeed: (Math.random() - 0.5) * 0.2
            });
        }
        return particles;
    }

    createShockwave() {
        if (this.type === 'base' || this.type === 'tank') {
            return [{
                radius: 5,
                maxRadius: 80 * this.intensity,
                thickness: 8,
                life: 1.0,
                decay: 0.03
            }];
        }
        return [];
    }

    activateEffects() {
        if (typeof game === 'undefined') return;

        game.screenShake = this.shakeIntensity;

        if (game.soundManager) {
            const soundMap = { 'base': 'baseExplosion', 'tank': 'tankExplosion' };
            const soundName = soundMap[this.type];
            if (soundName) game.soundManager.play(soundName);
        }
    }

    update() {
        this.lifetime++;

        // Обновляем частицы
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.position = p.position.add(p.velocity);
            p.velocity = p.velocity.multiply(0.95);
            p.life -= p.decay;
            p.size = p.startSize * p.life;
            p.rotation += p.rotationSpeed;

            if (p.life <= 0) {
                this.particles.splice(i, 1);
            }
        }

        // Обновляем ударные волны
        for (let i = this.shockwaves.length - 1; i >= 0; i--) {
            const w = this.shockwaves[i];
            w.radius += 2;
            w.life -= w.decay;
            w.thickness *= 0.95;

            if (w.life <= 0) {
                this.shockwaves.splice(i, 1);
            }
        }

        // Проверяем окончание взрыва
        if (this.lifetime >= this.maxLifetime && this.particles.length === 0) {
            this.active = false;
        }
    }

    draw(ctx) {
        if (!this.active) return;

        const progress = this.lifetime / this.maxLifetime;

        ctx.save();

        // Ударные волны
        for (let i = 0; i < this.shockwaves.length; i++) {
            const w = this.shockwaves[i];
            if (w.life > 0) {
                ctx.strokeStyle = `rgba(255, 255, 255, ${w.life * 0.6})`;
                ctx.lineWidth = w.thickness;
                ctx.beginPath();
                ctx.arc(this.position.x, this.position.y, w.radius, 0, Math.PI * 2);
                ctx.stroke();
            }
        }

        // Основное ядро взрыва
        if (progress < 0.3) {
            const coreSize = (1 - progress * 3) * 30 * this.intensity;
            const gradient = ctx.createRadialGradient(
                this.position.x, this.position.y, 0,
                this.position.x, this.position.y, coreSize
            );

            gradient.addColorStop(0, 'rgba(255, 255, 255, 0.8)');
            gradient.addColorStop(0.3, 'rgba(255, 200, 0, 0.6)');
            gradient.addColorStop(1, 'rgba(255, 0, 0, 0)');

            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(this.position.x, this.position.y, coreSize, 0, Math.PI * 2);
            ctx.fill();
        }

        // Частицы
        for (let i = 0; i < this.particles.length; i++) {
            const p = this.particles[i];
            if (p.life > 0) {
                ctx.save();
                ctx.translate(p.position.x, p.position.y);
                ctx.rotate(p.rotation);
                ctx.globalAlpha = p.life;

                ctx.fillStyle = p.color;
                if (Math.random() > 0.5) {
                    ctx.fillRect(-p.size/2, -p.size/2, p.size, p.size);
                } else {
                    ctx.beginPath();
                    ctx.arc(0, 0, p.size/2, 0, Math.PI * 2);
                    ctx.fill();
                }

                ctx.restore();
            }
        }

        // Эффект свечения
        if (this.intensity > 1.0 && progress < 0.5) {
            const glowSize = 100 * this.intensity * (1 - progress * 2);
            const gradient = ctx.createRadialGradient(
                this.position.x, this.position.y, 0,
                this.position.x, this.position.y, glowSize
            );

            gradient.addColorStop(0, 'rgba(255, 100, 0, 0.3)');
            gradient.addColorStop(1, 'rgba(255, 0, 0, 0)');

            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(this.position.x, this.position.y, glowSize, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.restore();
    }
}

// === ОПТИМИЗИРОВАННЫЙ ВЗРЫВ ПУЛЬ ===
class BulletExplosion {
    constructor(x, y, intensity = 1.0) {
        this.position = new Vector2(x, y);
        this.active = true;
        this.lifetime = 0;
        this.maxLifetime = 25;
        this.particles = this.createParticles(intensity);
    }

    createParticles(intensity) {
        const particles = [];
        for (let i = 0; i < 8; i++) {
            particles.push({
                position: new Vector2(this.position.x, this.position.y),
                           velocity: new Vector2((Math.random() - 0.5) * 8, (Math.random() - 0.5) * 8),
                           size: 1 + Math.random() * 2,
                           color: Math.random() > 0.5 ? '#FFFF00' : '#FFA500',
                           life: 15 + Math.random() * 10,
                           trail: []
            });
        }
        return particles;
    }

    update() {
        this.lifetime++;

        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];

            // Обновляем след
            p.trail.push({ x: p.position.x, y: p.position.y, alpha: p.life / 25 });
            if (p.trail.length > 5) p.trail.shift();

            p.position = p.position.add(p.velocity);
            p.life--;
            p.velocity = p.velocity.multiply(0.92);

            if (p.life <= 0) {
                this.particles.splice(i, 1);
            }
        }

        if (this.lifetime >= this.maxLifetime && this.particles.length === 0) {
            this.active = false;
        }
    }

    draw(ctx) {
        if (!this.active) return;

        for (let i = 0; i < this.particles.length; i++) {
            const p = this.particles[i];
            const alpha = p.life / 25;

            // След
            for (let j = 0; j < p.trail.length; j++) {
                const point = p.trail[j];
                const trailAlpha = alpha * (j / p.trail.length) * 0.5;
                ctx.fillStyle = `rgba(255, 200, 0, ${trailAlpha})`;
                ctx.beginPath();
                ctx.arc(point.x, point.y, p.size * 0.7, 0, Math.PI * 2);
                ctx.fill();
            }

            // Основная частица
            ctx.fillStyle = `rgba(255, 255, 0, ${alpha})`;
            ctx.beginPath();
            ctx.arc(p.position.x, p.position.y, p.size, 0, Math.PI * 2);
            ctx.fill();
        }
    }
}

// === ОПТИМИЗИРОВАННАЯ АНИМАЦИЯ СПАВНА ===
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

        const visible = Math.floor(this.progress * 10) % 2 === 0;

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

// === ОПТИМИЗИРОВАННАЯ ВОЛНА ВРЕМЕНИ ===
class TimeWave {
    constructor(x, y, duration) {
        this.position = new Vector2(x, y);
        this.radius = 5;
        this.maxRadius = 1000;
        this.speed = 8;
        this.active = true;
        this.duration = duration;
        this.startTime = Date.now();
        this.distortionPoints = this.createDistortionPoints();

        // Предварительные вычисления
        this.colors = {
            main: ['rgba(0, 255, 255, 0.9)', 'rgba(0, 200, 255, 0.6)', 'rgba(0, 150, 255, 0.3)', 'rgba(0, 100, 255, 0)'],
            inner: ['rgba(255, 255, 255, 0.8)', 'rgba(0, 255, 255, 0)']
        };
    }

    createDistortionPoints() {
        const points = [];
        for (let i = 0; i < 150; i++) { // Уменьшено количество точек
            const angle = Math.random() * Math.PI * 2;
            const distance = Math.random() * this.maxRadius;

            points.push({
                x: this.position.x + Math.cos(angle) * distance,
                        y: this.position.y + Math.sin(angle) * distance,
                        originalX: 0,
                        originalY: 0,
                        distortion: 0,
                        size: 2 + Math.random() * 4
            });
        }
        return points;
    }

    update() {
        this.radius += this.speed;

        // Оптимизированное обновление искажений
        for (let i = 0; i < this.distortionPoints.length; i++) {
            const p = this.distortionPoints[i];
            const dx = p.x - this.position.x;
            const dy = p.y - this.position.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            const wavePosition = Math.abs(distance - this.radius);
            p.distortion = Math.max(0, 1 - wavePosition / 100);

            const time = Date.now() * 0.001;
            p.originalX = Math.sin(time + p.x * 0.01) * p.distortion * 10;
            p.originalY = Math.cos(time + p.y * 0.01) * p.distortion * 10;
        }

        if (this.radius >= this.maxRadius) {
            this.active = false;
        }

        return this.active;
    }

    draw(ctx) {
        if (!this.active) return;

        ctx.save();

        // Основная волна
        const gradient = ctx.createRadialGradient(
            this.position.x, this.position.y, this.radius - 50,
            this.position.x, this.position.y, this.radius + 50
        );
        this.colors.main.forEach((color, index) => {
            gradient.addColorStop(index * 0.33, color);
        });

        ctx.strokeStyle = gradient;
        ctx.lineWidth = 20;
        ctx.beginPath();
        ctx.arc(this.position.x, this.position.y, this.radius, 0, Math.PI * 2);
        ctx.stroke();

        // Внутренняя волна
        const innerGradient = ctx.createRadialGradient(
            this.position.x, this.position.y, this.radius - 30,
            this.position.x, this.position.y, this.radius
        );
        innerGradient.addColorStop(0, this.colors.inner[0]);
        innerGradient.addColorStop(1, this.colors.inner[1]);

        ctx.strokeStyle = innerGradient;
        ctx.lineWidth = 8;
        ctx.beginPath();
        ctx.arc(this.position.x, this.position.y, this.radius - 10, 0, Math.PI * 2);
        ctx.stroke();

        // Точки искажения
        for (let i = 0; i < this.distortionPoints.length; i++) {
            const p = this.distortionPoints[i];
            if (p.distortion > 0.1) {
                const alpha = p.distortion * 0.7;
                const size = p.size * p.distortion;

                ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
                ctx.beginPath();
                ctx.arc(p.x + p.originalX, p.y + p.originalY, size, 0, Math.PI * 2);
                ctx.fill();

                ctx.shadowColor = '#00FFFF';
                ctx.shadowBlur = 10 * p.distortion;
                ctx.fillStyle = `rgba(0, 255, 255, ${alpha * 0.3})`;
                ctx.beginPath();
                ctx.arc(p.x + p.originalX, p.y + p.originalY, size * 2, 0, Math.PI * 2);
                ctx.fill();
            }
        }
        ctx.shadowBlur = 0;

        // Центральная вспышка
        const pulse = (Math.sin(Date.now() * 0.01) + 1) * 0.5;
        const centerGradient = ctx.createRadialGradient(
            this.position.x, this.position.y, 0,
            this.position.x, this.position.y, 80
        );
        centerGradient.addColorStop(0, `rgba(255, 255, 255, ${0.8 + pulse * 0.2})`);
        centerGradient.addColorStop(0.5, 'rgba(0, 255, 255, 0.5)');
        centerGradient.addColorStop(1, 'rgba(0, 100, 255, 0)');

        ctx.fillStyle = centerGradient;
        ctx.beginPath();
        ctx.arc(this.position.x, this.position.y, 60 + pulse * 20, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }
}
