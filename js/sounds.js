class SoundManager {
    constructor() {
        this.sounds = {};
        this.muted = false;
        this.engineLoop = null;
        this.init();
    }

    init() {
        // Загружаем все звуки БЕЗ timeStop
        this.sounds = {
            tankExplosion: this.createSound('sounds/tank_explosion.wav'),
            baseExplosion: this.createSound('sounds/base_explosion.wav'),
            bulletHit: this.createSound('sounds/bullet_hit.wav'),
            bulletCollision: this.createSound('sounds/bullet_collision.wav'),
            brickHit: this.createSound('sounds/brick_hit.wav'),
            brickDestroy: this.createSound('sounds/brick_destroy.wav'),
            enemyShot: this.createSound('sounds/enemy_shot.wav'),
            playerShot: this.createSound('sounds/player_shot.wav'),
            engineIdle: this.createSound('sounds/engine_idle.wav', true),
            engineMoving: this.createSound('sounds/engine_moving.wav', true),

            // Звуки для типов танков
            fastTankShot: this.createSound('sounds/fast_tank_shot.wav'),
            heavyTankShot: this.createSound('sounds/heavy_tank_shot.wav'),
            sniperShot: this.createSound('sounds/sniper_tank_shot.wav'),
            heavyTankHit: this.createSound('sounds/battle_city_bullet_armor.wav'),

            // ЗВУКИ БОНУСОВ
            bonusPickup: this.createSound('sounds/star_bonus.wav'),
            lifeBonus: this.createSound('sounds/star_bonus.wav'),

            // ТОЛЬКО необходимые звуки для остановки времени
            clockTick: this.createSound('sounds/clock_tick.wav', true),
            freezeEffect: this.createSound('sounds/freeze_effect.wav'),
            timeResume: this.createSound('sounds/time_resume.wav')
        };

        // Настройка громкости
        this.sounds.engineIdle.volume = 0.3;
        this.sounds.engineMoving.volume = 0.4;
        this.sounds.tankExplosion.volume = 0.6;
        this.sounds.baseExplosion.volume = 0.7;

        // Громкость для звуков остановки времени
        this.sounds.clockTick.volume = 0.4;
        this.sounds.freezeEffect.volume = 0.9;
        this.sounds.timeResume.volume = 0.9;
    }

    createSound(src, loop = false) {
        const audio = new Audio(src);
        audio.loop = loop;
        audio.preload = 'auto';
        return audio;
    }

    play(soundName) {
        if (this.muted || !this.sounds[soundName]) return;

        try {
            const sound = this.sounds[soundName].cloneNode();
            sound.volume = this.sounds[soundName].volume;
            sound.play().catch(e => console.log('Audio play error:', e));
        } catch (e) {
            console.log('Sound error:', e);
        }
    }

    playLoop(soundName) {
        if (this.muted || !this.sounds[soundName]) return;

        try {
            this.sounds[soundName].currentTime = 0;
            this.sounds[soundName].play().catch(e => console.log('Audio play error:', e));
        } catch (e) {
            console.log('Sound error:', e);
        }
    }

    stopLoop(soundName) {
        if (this.sounds[soundName]) {
            this.sounds[soundName].pause();
            this.sounds[soundName].currentTime = 0;
        }
    }

    // ПРОСТЫЕ методы для остановки времени
    playTimeStop() {
        if (this.muted) return;

        // Звук заморозки
        this.play('freezeEffect');

        // Только тикание часов
        this.playLoop('clockTick');
    }

    stopTimeStop() {
        // Останавливаем тикание
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
        Object.values(this.sounds).forEach(sound => {
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
        switch(enemyType) {
            case 'FAST':
                this.play('fastTankShot');
                break;
            case 'HEAVY':
                this.play('heavyTankShot');
                break;
            case 'SNIPER':
                this.play('sniperShot');
                break;
            default:
                this.play('enemyShot');
        }
    }
}
