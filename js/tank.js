class Tank {
    constructor(x, y, type = 'player', tankType = 'basic', level = 1) {
        this.position = new Vector2(x, y);
        this.direction = DIRECTIONS.UP;
        this.type = type; // 'player' или 'enemy'
        this.tankType = tankType; // Тип танка: 'basic', 'fast', 'heavy', 'armored', 'sniper'
        this.level = level;

        // Настройки в зависимости от типа танка
        this.setTankStats(tankType);

        this.size = TILE_SIZE - 8;
        this.color = this.getTankColor();
        this.health = this.maxHealth;
        this.reloadTime = 0;
        this.canShoot = true;
        this.username = type === 'enemy' ? this.generateEnemyName() : '';
        this.spawnProtection = type === 'enemy' ? 60 : 0;
        this.shield = null;
        this.isDestroyed = false;
        this.stuckTimer = 0;
    }

    setTankStats(tankType) {
        switch(tankType) {
            case 'fast': // Быстрый танк
                this.speed = TANK_SPEED * 1.5;
                this.maxHealth = 1;
                this.bulletSpeed = BULLET_SPEED * 1.2;
                this.reloadDelay = 25;
                this.scoreValue = 200;
                break;

            case 'heavy': // Тяжелый танк
                this.speed = TANK_SPEED * 0.6;
                this.maxHealth = 3;
                this.bulletSpeed = BULLET_SPEED;
                this.reloadDelay = 45;
                this.scoreValue = 400;
                break;

            case 'armored': // Бронированный танк
                this.speed = TANK_SPEED * 0.8;
                this.maxHealth = 2;
                this.bulletSpeed = BULLET_SPEED * 0.9;
                this.reloadDelay = 35;
                this.scoreValue = 300;
                break;

            case 'sniper': // Снайперский танк
                this.speed = TANK_SPEED;
                this.maxHealth = 1;
                this.bulletSpeed = BULLET_SPEED * 1.5;
                this.reloadDelay = 60;
                this.scoreValue = 500;
                break;

            default: // Базовый танк
                this.speed = type === 'player' ? TANK_SPEED : (this.level === 1 ? TANK_SPEED * 0.35 : TANK_SPEED * 0.7);
                this.maxHealth = 1;
                this.bulletSpeed = BULLET_SPEED;
                this.reloadDelay = type === 'player' ? 20 : 40;
                this.scoreValue = 100;
        }
    }

    getTankColor() {
        if (this.type === 'player') return '#4CAF50';

        switch(this.tankType) {
            case 'fast': return '#FF6B6B';    // Красный
            case 'heavy': return '#4ECDC4';   // Бирюзовый
            case 'armored': return '#45B7D1'; // Синий
            case 'sniper': return '#FFA500';  // Оранжевый
            default: return '#FF4444';        // Базовый красный
        }
    }

    generateEnemyName() {
        const prefixes = {
            'fast': ['Стрела', 'Молния', 'Вихрь', 'Ураган'],
            'heavy': ['Титан', 'Голиаф', 'Циклоп', 'Мастодонт'],
            'armored': ['Броня', 'Бастион', 'Крепость', 'Доспех'],
            'sniper': ['Снайпер', 'Меткий', 'Прицел', 'Стрелок'],
            'basic': ['Враг', 'Противо.', 'Атак.', 'Боец']
        };

        const prefixList = prefixes[this.tankType] || prefixes.basic;
        const prefix = prefixList[Math.floor(Math.random() * prefixList.length)];
        return `${prefix}${Math.floor(Math.random() * 1000)}`;
    }

    shoot() {
        if (this.isDestroyed || !this.canShoot) return null;

        this.canShoot = false;
        this.reloadTime = this.reloadDelay;

        const directionVector = new Vector2(this.direction.x, this.direction.y);
        const offset = directionVector.multiply(this.size / 2 + 5);
        const bulletX = this.position.x + offset.x;
        const bulletY = this.position.y + offset.y;

        const bullet = new Bullet(bulletX, bulletY, this.direction, this.type);
        bullet.speed = this.bulletSpeed; // Уникальная скорость пули

        // Особые способности для некоторых типов танков
        if (this.tankType === 'sniper') {
            bullet.size = 8; // Большие пули у снайпера
        }

        return bullet;
    }

    takeDamage() {
        if (this.hasShield()) {
            return false;
        }

        this.health--;
        if (this.health <= 0) {
            this.isDestroyed = true;
            return true;
        }
        return false;
    }

    draw(ctx) {
        if (this.isDestroyed) return;

        ctx.save();
        ctx.translate(this.position.x, this.position.y);

        let angle = 0;
        if (this.direction === DIRECTIONS.RIGHT) angle = Math.PI / 2;
        else if (this.direction === DIRECTIONS.DOWN) angle = Math.PI;
        else if (this.direction === DIRECTIONS.LEFT) angle = -Math.PI / 2;

        ctx.rotate(angle);

        if (this.spawnProtection > 0 && this.spawnProtection % 10 < 5) {
            ctx.globalAlpha = 0.5;
        }

        // Корпус танка
        ctx.fillStyle = this.color;
        ctx.fillRect(-this.size/2, -this.size/2, this.size, this.size);

        // Детали корпуса в зависимости от типа
        ctx.fillStyle = this.getDetailColor();
        ctx.fillRect(-this.size/4, -this.size/4, this.size/2, this.size/2);

        // Особые визуальные элементы для разных типов
        this.drawSpecialFeatures(ctx);

        // Дуло (разной длины для разных типов)
        ctx.fillStyle = '#333';
        const barrelLength = this.size * this.getBarrelLength();
        const barrelWidth = this.size * 0.25;
        ctx.fillRect(-barrelWidth/2, -barrelLength - 2, barrelWidth, barrelLength);

        ctx.restore();

        // Рисуем щит поверх танка
        if (this.shield) {
            this.shield.draw(ctx);
        }

        // Индикатор здоровья для врагов с более чем 1 HP
        if (this.type === 'enemy' && this.maxHealth > 1) {
            this.drawHealthBar(ctx);
        }

        if (this.type === 'enemy' && this.username) {
            ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
            const textWidth = ctx.measureText(this.username).width;
            ctx.fillRect(
                this.position.x - textWidth/2 - 2,
                this.position.y - this.size - 22,
                textWidth + 4,
                16
            );

            ctx.fillStyle = '#FFF';
            ctx.font = '10px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(this.username, this.position.x, this.position.y - this.size - 10);
        }
    }

    getDetailColor() {
        if (this.type === 'player') return '#388E3C';

        switch(this.tankType) {
            case 'fast': return '#CC3333';
            case 'heavy': return '#2A9D8F';
            case 'armored': return '#2C6FBB';
            case 'sniper': return '#E67E22';
            default: return '#CC3333';
        }
    }

    getBarrelLength() {
        switch(this.tankType) {
            case 'sniper': return 1.2; // Длинное дуло у снайпера
            case 'heavy': return 0.7;  // Короткое дуло у тяжелого
            default: return 0.8;
        }
    }

    drawSpecialFeatures(ctx) {
        const featureSize = this.size * 0.15;

        switch(this.tankType) {
            case 'armored': // Броневые пластины
                ctx.fillStyle = '#666';
                // Боковые пластины
                ctx.fillRect(-this.size/2, -this.size/4, featureSize, this.size/2);
                ctx.fillRect(this.size/2 - featureSize, -this.size/4, featureSize, this.size/2);
                break;

            case 'heavy': // Дополнительная броня
                ctx.fillStyle = '#555';
                // Угловые бронеплиты
                ctx.fillRect(-this.size/3, -this.size/3, featureSize, featureSize);
                ctx.fillRect(this.size/3 - featureSize, -this.size/3, featureSize, featureSize);
                ctx.fillRect(-this.size/3, this.size/3 - featureSize, featureSize, featureSize);
                ctx.fillRect(this.size/3 - featureSize, this.size/3 - featureSize, featureSize, featureSize);
                break;

            case 'sniper': // Прицел
                ctx.fillStyle = '#FFD700';
                ctx.beginPath();
                ctx.arc(0, 0, featureSize, 0, Math.PI * 2);
                ctx.fill();
                break;
        }
    }

    drawHealthBar(ctx) {
        const barWidth = this.size;
        const barHeight = 4;
        const barX = this.position.x - barWidth/2;
        const barY = this.position.y - this.size - 30;

        // Фон полоски здоровья
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(barX, barY, barWidth, barHeight);

        // Здоровье
        const healthWidth = (this.health / this.maxHealth) * barWidth;
        ctx.fillStyle = this.getHealthColor();
        ctx.fillRect(barX, barY, healthWidth, barHeight);
    }

    getHealthColor() {
        const healthPercent = this.health / this.maxHealth;
        if (healthPercent > 0.6) return '#4CAF50';
        if (healthPercent > 0.3) return '#FFA500';
        return '#FF4444';
    }
}
