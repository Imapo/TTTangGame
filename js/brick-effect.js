// === ОПТИМИЗИРОВАННЫЙ КЛАСС ОСКОЛКА КИРПИЧА ===
class BrickFragment {
    constructor(x, y, size) {
        this.position = new Vector2(x, y);
        this.size = size;
        this.active = true;
        this.health = 1;
        this.collisionEnabled = false;
        this.creationTime = Date.now();
        this.hasStopped = false;
        this.originalPosition = new Vector2(x, y);

        // Предварительные вычисления
        const angle = Math.random() * Math.PI * 2;
        this.maxDistance = 1 + Math.random() * 14;
        this.velocity = new Vector2(
            Math.cos(angle) * this.maxDistance * 0.1,
                                    Math.sin(angle) * this.maxDistance * 0.1
        );

        this.rotation = Math.random() * Math.PI * 2;
        this.rotationSpeed = (Math.random() - 0.5) * 0.05;
        this.color = Math.random() > 0.5 ? '#D2691E' : '#8B4513';

        // Кэшируем bounds для коллизии
        this._bounds = new Rectangle(0, 0, 0, 0);
    }

    update(allTanks = []) {
        if (!this.hasStopped) {
            // Оптимизированная проверка расстояния (без Math.sqrt)
            const dx = this.position.x - this.originalPosition.x;
            const dy = this.position.y - this.originalPosition.y;
            const distanceSquared = dx * dx + dy * dy;
            const maxDistanceSquared = this.maxDistance * this.maxDistance;

            if (distanceSquared >= maxDistanceSquared || (Date.now() - this.creationTime) > 1000) {
                this.stopFragment();
            } else {
                this.position = this.position.add(this.velocity);
                this.rotation += this.rotationSpeed;
            }
        } else {
            this.handleTankCollisions(allTanks);
        }
    }

    stopFragment() {
        this.hasStopped = true;
        this.velocity = new Vector2(0, 0);
        this.rotationSpeed = 0;
        this.collisionEnabled = true;
    }

    handleTankCollisions(allTanks) {
        if (!this.collisionEnabled) return false;

        const fragmentBounds = this.getBounds();
        let collisionWithPlayer = false;

        for (let i = 0; i < allTanks.length; i++) {
            const tank = allTanks[i];
            if (tank.isDestroyed) continue;

            const tankBounds = tank.getBounds();
            if (fragmentBounds.intersects(tankBounds)) {
                this.handleTankPush(tank);
                if (tank.type === 'player') {
                    collisionWithPlayer = true;
                }
            }
        }

        return collisionWithPlayer;
    }

    handleTankPush(tank) {
        let tankMoveX = 0, tankMoveY = 0;

        switch (tank.direction) {
            case DIRECTIONS.UP: tankMoveY = -tank.speed; break;
            case DIRECTIONS.DOWN: tankMoveY = tank.speed; break;
            case DIRECTIONS.LEFT: tankMoveX = -tank.speed; break;
            case DIRECTIONS.RIGHT: tankMoveX = tank.speed; break;
        }

        this.position = this.position.add(new Vector2(tankMoveX * 0.7, tankMoveY * 0.7));
    }

    draw(ctx) {
        if (!this.active) return;

        ctx.save();
        ctx.translate(this.position.x, this.position.y);
        ctx.rotate(this.rotation);

        ctx.fillStyle = this.color;
        ctx.fillRect(-this.size/2, -this.size/2, this.size, this.size);

        ctx.strokeStyle = '#A0522D';
        ctx.lineWidth = 1;
        ctx.strokeRect(-this.size/2, -this.size/2, this.size, this.size);

        ctx.restore();
    }

    takeDamage() {
        this.health--;
        if (this.health <= 0) {
            this.active = false;
            return true;
        }
        return false;
    }

    getBounds() {
        if (!this.collisionEnabled || !this.active) {
            return this._bounds;
        }

        this._bounds.x = this.position.x - this.size/2;
        this._bounds.y = this.position.y - this.size/2;
        this._bounds.width = this.size;
        this._bounds.height = this.size;

        return this._bounds;
    }
}

// === ОПТИМИЗИРОВАННЫЙ КЛАСС КИРПИЧНОГО БЛОКА С ОСКОЛКАМИ ===
class BrickTile {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.health = 2;
        this.fragments = [];
        this.isDestroyed = false;
        this.cracks = this.generateCracks();

        // Предварительные вычисления
        this.tileX = x * TILE_SIZE;
        this.tileY = y * TILE_SIZE;
        this.bounds = new Rectangle(this.tileX, this.tileY, TILE_SIZE, TILE_SIZE);
    }

    generateCracks() {
        const cracks = [];
        const crackCount = 2 + Math.floor(Math.random() * 2);

        for (let i = 0; i < crackCount; i++) {
            cracks.push({
                startX: Math.random() * 0.8 + 0.1,
                        startY: Math.random() * 0.8 + 0.1,
                        endX: Math.random() * 0.8 + 0.1,
                        endY: Math.random() * 0.8 + 0.1,
                        width: 1 + Math.random() * 1
            });
        }
        return cracks;
    }

    takeDamage() {
        if (this.isDestroyed) return false;

        this.health--;

        if (this.health <= 0) {
            this.isDestroyed = true;
            this.createFragments();
            return true;
        }
        return false;
    }

    createFragments() {
        const fragmentCount = 6 + Math.floor(Math.random() * 3);
        const centerX = this.tileX + TILE_SIZE / 2;
        const centerY = this.tileY + TILE_SIZE / 2;

        for (let i = 0; i < fragmentCount; i++) {
            const size = 6 + Math.random() * 6;
            const angle = Math.random() * Math.PI * 2;
            const distance = Math.random() * TILE_SIZE * 0.3;

            const startX = centerX + Math.cos(angle) * distance;
            const startY = centerY + Math.sin(angle) * distance;

            this.fragments.push(new BrickFragment(startX, startY, size));
        }
    }

    update(allTanks = []) {
        // Обратное обновление для безопасного удаления
        for (let i = this.fragments.length - 1; i >= 0; i--) {
            const fragment = this.fragments[i];
            if (fragment.active) {
                fragment.update(allTanks);
            } else {
                this.fragments.splice(i, 1);
            }
        }
    }

    draw(ctx) {
        const tileX = this.tileX;
        const tileY = this.tileY;

        if (!this.isDestroyed) {
            this.drawIntactBrick(ctx, tileX, tileY);
        }

        // Рисуем фрагменты
        for (let i = 0; i < this.fragments.length; i++) {
            this.fragments[i].draw(ctx);
        }
    }

    drawIntactBrick(ctx, tileX, tileY) {
        ctx.fillStyle = '#D2691E';
        ctx.fillRect(tileX, tileY, TILE_SIZE, TILE_SIZE);

        ctx.strokeStyle = '#8B4513';
        ctx.lineWidth = 1;
        ctx.strokeRect(tileX, tileY, TILE_SIZE, TILE_SIZE);

        // Рисуем крест
        ctx.strokeStyle = '#A0522D';
        ctx.beginPath();
        ctx.moveTo(tileX, tileY + TILE_SIZE/2);
        ctx.lineTo(tileX + TILE_SIZE, tileY + TILE_SIZE/2);
        ctx.moveTo(tileX + TILE_SIZE/2, tileY);
        ctx.lineTo(tileX + TILE_SIZE/2, tileY + TILE_SIZE);
        ctx.stroke();

        // Рисуем трещины если поврежден
        if (this.health === 1) {
            this.drawCracks(ctx, tileX, tileY);
        }
    }

    drawCracks(ctx, tileX, tileY) {
        ctx.strokeStyle = '#5D4037';
        for (let i = 0; i < this.cracks.length; i++) {
            const crack = this.cracks[i];
            ctx.lineWidth = crack.width;
            ctx.beginPath();
            ctx.moveTo(
                tileX + crack.startX * TILE_SIZE,
                tileY + crack.startY * TILE_SIZE
            );
            ctx.lineTo(
                tileX + crack.endX * TILE_SIZE,
                tileY + crack.endY * TILE_SIZE
            );
            ctx.stroke();
        }
    }

    checkBulletCollision(bullet) {
        const bulletBounds = bullet.getBounds();

        if (this.isDestroyed) {
            // Проверяем столкновение с фрагментами
            return this.checkFragmentCollision(bulletBounds);
        } else {
            // Проверяем столкновение с основным блоком
            return bulletBounds.intersects(this.bounds);
        }
    }

    checkFragmentCollision(bulletBounds) {
        for (let i = this.fragments.length - 1; i >= 0; i--) {
            const fragment = this.fragments[i];
            if (fragment.active && fragment.collisionEnabled &&
                bulletBounds.intersects(fragment.getBounds())) {

                if (fragment.takeDamage()) {
                    this.fragments.splice(i, 1);
                }
                return true;
                }
        }
        return false;
    }

    hasFragments() {
        return this.fragments.length > 0;
    }

    // Метод для массовой очистки фрагментов
    clearFragments() {
        this.fragments.length = 0;
    }
}
