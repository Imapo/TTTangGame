// === КЛАСС ДЛЯ УПРАВЛЕНИЯ ЗВУКАМИ ===
class SoundManager {
    constructor() {
        this.sounds = {};
        this.muted = false;
        this.engineLoop = null;
        this.init();
    }

    init() {
        // Загружаем все звуки
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
            fastTankShot: this.createSound('sounds/fast_shot.wav'),
            heavyTankShot: this.createSound('sounds/heavy_shot.wav'),
            sniperShot: this.createSound('sounds/sniper_shot.wav'),
        };

        // Настройка громкости
        this.sounds.engineIdle.volume = 0.3;
        this.sounds.engineMoving.volume = 0.4;
        this.sounds.tankExplosion.volume = 0.6;
        this.sounds.baseExplosion.volume = 0.7;
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
            // Создаем копию звука для одновременного воспроизведения
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

    // Управление звуком двигателя
    updateEngineSound(isMoving, isPlayerAlive) {
        if (!isPlayerAlive) {
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
}
