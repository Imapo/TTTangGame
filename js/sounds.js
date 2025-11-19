class SoundManager {
    constructor() {
        this.sounds = new Map();
        this.muted = false;
        this.engineLoop = null;

        // Предзагрузка ключевых звуков
        this.criticalSounds = [
            'engineIdle', 'engineMoving', 'clockTick'
        ];

        this.init();
    }

    init() {
        // Конфигурация звуков
        const soundConfig = [
            // Основные звуки
            { name: 'tankExplosion', src: 'sounds/tank_explosion.wav', volume: 0.6 },
            { name: 'baseExplosion', src: 'sounds/base_explosion.wav', volume: 0.7 },
            { name: 'bulletHit', src: 'sounds/bullet_hit.wav' },
            { name: 'bulletCollision', src: 'sounds/bullet_collision.wav' },
            { name: 'brickHit', src: 'sounds/brick_hit.wav' },
            { name: 'brickDestroy', src: 'sounds/brick_destroy.wav' },
            { name: 'enemyShot', src: 'sounds/enemy_shot.wav' },
            { name: 'playerShot', src: 'sounds/player_shot.wav' },

            // Звуки двигателя (loop)
            { name: 'engineIdle', src: 'sounds/engine_idle.wav', loop: true, volume: 0.3 },
            { name: 'engineMoving', src: 'sounds/engine_moving.wav', loop: true, volume: 0.4 },

            // Звуки танков
            { name: 'fastTankShot', src: 'sounds/fast_tank_shot.wav' },
            { name: 'heavyTankShot', src: 'sounds/heavy_tank_shot.wav' },
            { name: 'sniperShot', src: 'sounds/sniper_tank_shot.wav' },
            { name: 'heavyTankHit', src: 'sounds/battle_city_bullet_armor.wav' },

            // Бонусы
            { name: 'bonusPickup', src: 'sounds/star_bonus.wav' },
            { name: 'lifeBonus', src: 'sounds/star_bonus.wav' },

            // Время
            { name: 'clockTick', src: 'sounds/clock_tick.wav', loop: true, volume: 0.4 },
            { name: 'freezeEffect', src: 'sounds/freeze_effect.wav', volume: 0.9 },
            { name: 'timeResume', src: 'sounds/time_resume.wav', volume: 0.9 }
        ];

        // Создаем звуки по конфигурации
        soundConfig.forEach(config => {
            this.sounds.set(config.name, this.createSound(config));
        });

        // Предзагрузка критических звуков
        this.preloadCriticalSounds();
    }

    createSound({ src, loop = false, volume = 1.0 }) {
        const audio = new Audio();
        audio.src = src;
        audio.loop = loop;
        audio.preload = 'auto';
        audio.volume = volume;
        return audio;
    }

    preloadCriticalSounds() {
        this.criticalSounds.forEach(soundName => {
            const sound = this.sounds.get(soundName);
            if (sound) {
                sound.load();
            }
        });
    }

    play(soundName) {
        if (this.muted || !this.sounds.has(soundName)) return;

        const sound = this.sounds.get(soundName);

        // Для одноразовых звуков создаем клон, для loop звуков используем оригинал
        if (!sound.loop) {
            this.playClonedSound(sound);
        } else {
            this.playOriginalSound(sound);
        }
    }

    playClonedSound(sound) {
        try {
            const clone = sound.cloneNode();
            clone.volume = sound.volume;
            clone.play().catch(() => {}); // Игнорируем ошибки воспроизведения
        } catch (e) {
            // Fallback: пытаемся воспроизвести оригинал
            this.playOriginalSound(sound);
        }
    }

    playOriginalSound(sound) {
        try {
            if (sound.paused) {
                sound.currentTime = 0;
                sound.play().catch(() => {});
            }
        } catch (e) {
            // Игнорируем ошибки воспроизведения
        }
    }

    playLoop(soundName) {
        if (this.muted || !this.sounds.has(soundName)) return;

        const sound = this.sounds.get(soundName);
        this.playOriginalSound(sound);
    }

    stopLoop(soundName) {
        const sound = this.sounds.get(soundName);
        if (sound) {
            sound.pause();
            sound.currentTime = 0;
        }
    }

    // Оптимизированные методы для остановки времени
    playTimeStop() {
        if (this.muted) return;

        this.play('freezeEffect');
        this.playLoop('clockTick');
    }

    stopTimeStop() {
        this.stopLoop('clockTick');
    }

    toggleMute() {
        this.muted = !this.muted;
        if (this.muted) {
            this.stopAll();
        }
        return this.muted;
    }

    stopAll() {
        this.sounds.forEach(sound => {
            sound.pause();
            sound.currentTime = 0;
        });
    }

    updateEngineSound(isMoving, isPlayerAlive, gameState = {}) {
        if (gameState.gameOver || gameState.levelComplete || !isPlayerAlive) {
            this.stopLoop('engineIdle');
            this.stopLoop('engineMoving');
            return;
        }

        if (isMoving) {
            this.stopLoop('engineIdle');
            this.playLoop('engineMoving');
        } else {
            this.stopLoop('engineMoving');
            this.playLoop('engineIdle');
        }
    }

    playEnemyShot(enemyType) {
        const shotSounds = {
            'FAST': 'fastTankShot',
            'HEAVY': 'heavyTankShot',
            'SNIPER': 'sniperShot'
        };

        const soundName = shotSounds[enemyType] || 'enemyShot';
        this.play(soundName);
    }

    // Очистка ресурсов
    destroy() {
        this.stopAll();
        this.sounds.clear();
    }
}
