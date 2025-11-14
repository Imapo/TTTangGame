// === УЛУЧШЕННЫЕ КЛАССЫ ЭФФЕКТОВ И АНИМАЦИЙ ===

class ShieldEffect {
    constructor(tank) {
        this.tank = tank;
        this.active = true;
        this.startTime = Date.now();
        this.duration = PLAYER_SHIELD_DURATION;
        this.radius = tank.size * 1.3;
        this.particles = [];
        this.createParticles();
    }

    createParticles() {
        for (let i = 0; i < 16; i++) {
            this.particles.push({
                angle: (i / 16) * Math.PI * 2,
                                distance: this.radius * (0.7 + Math.random() * 0.3),
                                speed: 0.02 + Math.random() * 0.03,
                                size: 1 + Math.random() * 2,
                                phase: Math.random() * Math.PI * 2
            });
        }
    }

    update() {
        const elapsed = Date.now() - this.startTime;
        if (elapsed >= this.duration) {
            this.active = false;
        }

        // Обновляем частицы
        this.particles.forEach(particle => {
            particle.angle += particle.speed;
            particle.phase += 0.1;
        });

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

        // Энергетические частицы
        this.particles.forEach(particle => {
            const x = Math.cos(particle.angle) * particle.distance;
            const y = Math.sin(particle.angle) * particle.distance;
            const alpha = 0.3 + Math.sin(particle.phase) * 0.3;

            ctx.fillStyle = `rgba(100, 200, 255, ${alpha * remaining})`;
            ctx.beginPath();
            ctx.arc(x, y, particle.size, 0, Math.PI * 2);
            ctx.fill();
        });

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

// === УЛУЧШЕННЫЙ КЛАСС ВЗРЫВА ===
class Explosion {
    constructor(x, y, type = 'tank') {
        this.position = new Vector2(x, y);
        this.type = type;
        this.particles = [];
        this.shockwaves = [];
        this.active = true;
        this.lifetime = 0;
        this.maxLifetime = this.getMaxLifetime();
        this.intensity = this.getIntensity();

        this.createParticles();
        this.createShockwave();

        // АКТИВИРУЕМ ТРЯСКУ КАМЕРЫ ПРЯМО ЗДЕСЬ
        if (typeof game !== 'undefined') {
            const shakeIntensity = this.getShakeIntensity();
            game.screenShake = shakeIntensity;

            // Разные звуки для разных типов взрывов
            if (game.soundManager) {
                if (type === 'base') {
                    game.soundManager.play('baseExplosion');
                } else if (type === 'tank') {
                    game.soundManager.play('tankExplosion');
                }
            }
        }
    }

    // НОВЫЙ МЕТОД: Определяем интенсивность тряски
    getShakeIntensity() {
        const shakes = {
            'tank': 10,
            'base': 40,
            'bullet': 5,
            'bonus': 8
        };
        return shakes[this.type] || 10;
    }

    getMaxLifetime() {
        const types = {
            'tank': 60,
            'base': 90,
            'bullet': 30,
            'bonus': 40
        };
        return types[this.type] || 60;
    }

    getIntensity() {
        const intensities = {
            'tank': 1.0,
            'base': 2.0,
            'bullet': 0.5,
            'bonus': 0.7
        };
        return intensities[this.type] || 1.0;
    }

    createParticles() {
        const particleCount = Math.floor(15 * this.intensity);
        const colors = this.getParticleColors();

        for (let i = 0; i < particleCount; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 1 + Math.random() * 3 * this.intensity;
            const size = 2 + Math.random() * 4 * this.intensity;

            this.particles.push({
                position: new Vector2(this.position.x, this.position.y),
                                velocity: new Vector2(
                                    Math.cos(angle) * speed,
                                                      Math.sin(angle) * speed
                                ),
                                size: size,
                                startSize: size,
                                color: colors[Math.floor(Math.random() * colors.length)],
                                life: 1.0,
                                decay: 0.02 + Math.random() * 0.03,
                                rotation: Math.random() * Math.PI * 2,
                                rotationSpeed: (Math.random() - 0.5) * 0.2
            });
        }
    }

    getParticleColors() {
        const colorSchemes = {
            'tank': ['#FF4444', '#FFAA00', '#FFFF00', '#FF6B00'],
            'base': ['#FF0000', '#FF6B00', '#FFFF00', '#FFFFFF'],
            'bullet': ['#FFFF00', '#FFA500', '#FF4500'],
            'bonus': ['#FF4081', '#FF80AB', '#FFFFFF']
        };
        return colorSchemes[this.type] || colorSchemes.tank;
    }

    createShockwave() {
        if (this.type === 'base' || this.type === 'tank') {
            this.shockwaves.push({
                radius: 5,
                maxRadius: 80 * this.intensity,
                thickness: 8,
                life: 1.0,
                decay: 0.03
            });
        }
    }

    update() {
        this.lifetime++;

        // Обновляем частицы
        this.particles.forEach(particle => {
            particle.position = particle.position.add(particle.velocity);
            particle.velocity = particle.velocity.multiply(0.95); // Сопротивление воздуха
            particle.life -= particle.decay;
            particle.size = particle.startSize * particle.life;
            particle.rotation += particle.rotationSpeed;
        });

        // Обновляем ударные волны
        this.shockwaves.forEach(wave => {
            wave.radius += 2;
            wave.life -= wave.decay;
            wave.thickness *= 0.95;
        });

        // Удаляем мертвые частицы и волны
        this.particles = this.particles.filter(p => p.life > 0);
        this.shockwaves = this.shockwaves.filter(w => w.life > 0);

        // Проверяем окончание взрыва
        if (this.lifetime >= this.maxLifetime && this.particles.length === 0) {
            this.active = false;
        }
    }

    draw(ctx) {
        if (!this.active) return;

        const progress = this.lifetime / this.maxLifetime;

        ctx.save();

        // Рисуем ударные волны
        this.shockwaves.forEach(wave => {
            if (wave.life > 0) {
                const alpha = wave.life * 0.6;
                ctx.strokeStyle = `rgba(255, 255, 255, ${alpha})`;
                ctx.lineWidth = wave.thickness;
                ctx.beginPath();
                ctx.arc(this.position.x, this.position.y, wave.radius, 0, Math.PI * 2);
                ctx.stroke();
            }
        });

        // Рисуем основное ядро взрыва (только в начале)
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

        // Рисуем частицы
        this.particles.forEach(particle => {
            if (particle.life > 0) {
                ctx.save();
                ctx.translate(particle.position.x, particle.position.y);
                ctx.rotate(particle.rotation);

                ctx.fillStyle = particle.color;
                ctx.globalAlpha = particle.life;

                // Разные формы частиц для разнообразия
                if (Math.random() > 0.5) {
                    // Квадратная частица
                    ctx.fillRect(-particle.size/2, -particle.size/2, particle.size, particle.size);
                } else {
                    // Круглая частица
                    ctx.beginPath();
                    ctx.arc(0, 0, particle.size/2, 0, Math.PI * 2);
                    ctx.fill();
                }

                ctx.restore();
            }
        });

        // Эффект свечения для больших взрывов
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

// === УЛУЧШЕННЫЙ ВЗРЫВ ПУЛЬ ===
class BulletExplosion {
    constructor(x, y, intensity = 1.0) {
        this.position = new Vector2(x, y);
        this.particles = [];
        this.active = true;
        this.lifetime = 0;
        this.maxLifetime = 25;

        // Создаем искры
        for (let i = 0; i < 8; i++) {
            this.particles.push({
                position: new Vector2(x, y),
                                velocity: new Vector2(
                                    (Math.random() - 0.5) * 8,
                                                      (Math.random() - 0.5) * 8
                                ),
                                size: 1 + Math.random() * 2,
                                color: Math.random() > 0.5 ? '#FFFF00' : '#FFA500',
                                life: 15 + Math.random() * 10,
                                trail: []
            });
        }
    }

    update() {
        this.lifetime++;

        this.particles.forEach(particle => {
            // Сохраняем след
            particle.trail.push({
                x: particle.position.x,
                y: particle.position.y,
                alpha: particle.life / 25
            });

            // Ограничиваем длину следа
            if (particle.trail.length > 5) {
                particle.trail.shift();
            }

            particle.position = particle.position.add(particle.velocity);
            particle.life--;
            particle.velocity = particle.velocity.multiply(0.92);
        });

        this.particles = this.particles.filter(p => p.life > 0);

        if (this.lifetime >= this.maxLifetime && this.particles.length === 0) {
            this.active = false;
        }
    }

    draw(ctx) {
        if (!this.active) return;

        this.particles.forEach(particle => {
            const alpha = particle.life / 25;

            // Рисуем след
            particle.trail.forEach((point, index) => {
                const trailAlpha = alpha * (index / particle.trail.length) * 0.5;
                ctx.fillStyle = `rgba(255, 200, 0, ${trailAlpha})`;
                ctx.beginPath();
                ctx.arc(point.x, point.y, particle.size * 0.7, 0, Math.PI * 2);
                ctx.fill();
            });

            // Рисуем основную частицу
            ctx.fillStyle = `rgba(255, 255, 0, ${alpha})`;
            ctx.beginPath();
            ctx.arc(particle.position.x, particle.position.y, particle.size, 0, Math.PI * 2);
            ctx.fill();
        });
    }
}

// Анимация спавна (оставляем без изменений)
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

class TimeWave {
    constructor(x, y, duration) {
        this.position = new Vector2(x, y);
        this.radius = 5;
        this.maxRadius = 1000; // Увеличиваем радиус
        this.speed = 8; // Увеличиваем скорость
        this.active = true;
        this.duration = duration;
        this.particles = [];
        this.distortionPoints = [];
        this.startTime = Date.now();

        this.createDistortionPoints();
        console.log(`🌀 Создана волна времени в (${x}, ${y})`);
    }

    createDistortionPoints() {
        // Создаем точки для искажения по всей карте
        for (let i = 0; i < 200; i++) {
            const angle = Math.random() * Math.PI * 2;
            const distance = Math.random() * this.maxRadius;

            this.distortionPoints.push({
                x: this.position.x + Math.cos(angle) * distance,
                                       y: this.position.y + Math.sin(angle) * distance,
                                       originalX: 0,
                                       originalY: 0,
                                       distortion: 0,
                                       size: 2 + Math.random() * 4
            });
        }
    }

    update() {
        // Расширяем волну
        this.radius += this.speed;

        // Обновляем искажения
        this.distortionPoints.forEach(point => {
            const distance = Math.sqrt(
                Math.pow(point.x - this.position.x, 2) +
                Math.pow(point.y - this.position.y, 2)
            );

            // Искажение максимально когда волна проходит через точку
            const wavePosition = Math.abs(distance - this.radius);
            point.distortion = Math.max(0, 1 - wavePosition / 100);

            // Случайное смещение для эффекта ряби
            point.originalX = Math.sin(Date.now() * 0.001 + point.x * 0.01) * point.distortion * 10;
            point.originalY = Math.cos(Date.now() * 0.001 + point.y * 0.01) * point.distortion * 10;
        });

        if (this.radius >= this.maxRadius) {
            this.active = false;
            console.log('🌀 Волна времени завершена');
        }

        return this.active;
    }

    draw(ctx) {
        if (!this.active) return;

        ctx.save();

        // ОСНОВНАЯ ВОЛНА - рисуем поверх всего
        const gradient = ctx.createRadialGradient(
            this.position.x, this.position.y, this.radius - 50,
            this.position.x, this.position.y, this.radius + 50
        );
        gradient.addColorStop(0, 'rgba(0, 255, 255, 0.9)');
        gradient.addColorStop(0.3, 'rgba(0, 200, 255, 0.6)');
        gradient.addColorStop(0.6, 'rgba(0, 150, 255, 0.3)');
        gradient.addColorStop(1, 'rgba(0, 100, 255, 0)');

        // Толстая яркая волна
        ctx.strokeStyle = gradient;
        ctx.lineWidth = 20;
        ctx.beginPath();
        ctx.arc(this.position.x, this.position.y, this.radius, 0, Math.PI * 2);
        ctx.stroke();

        // Дополнительные внутренние волны для объема
        const innerGradient = ctx.createRadialGradient(
            this.position.x, this.position.y, this.radius - 30,
            this.position.x, this.position.y, this.radius
        );
        innerGradient.addColorStop(0, 'rgba(255, 255, 255, 0.8)');
        innerGradient.addColorStop(1, 'rgba(0, 255, 255, 0)');

        ctx.strokeStyle = innerGradient;
        ctx.lineWidth = 8;
        ctx.beginPath();
        ctx.arc(this.position.x, this.position.y, this.radius - 10, 0, Math.PI * 2);
        ctx.stroke();

        // ТОЧКИ ИСКАЖЕНИЯ - рисуем поверх всего
        this.distortionPoints.forEach(point => {
            if (point.distortion > 0.1) {
                const alpha = point.distortion * 0.7;
                const size = point.size * point.distortion;

                // Яркие точки искажения
                ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
                ctx.beginPath();
                ctx.arc(point.x + point.originalX, point.y + point.originalY, size, 0, Math.PI * 2);
                ctx.fill();

                // Свечение вокруг точек
                ctx.shadowColor = '#00FFFF';
                ctx.shadowBlur = 10 * point.distortion;
                ctx.fillStyle = `rgba(0, 255, 255, ${alpha * 0.3})`;
                ctx.beginPath();
                ctx.arc(point.x + point.originalX, point.y + point.originalY, size * 2, 0, Math.PI * 2);
                ctx.fill();
                ctx.shadowBlur = 0;
            }
        });

        // ЦЕНТРАЛЬНАЯ ВСПЫШКА
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
