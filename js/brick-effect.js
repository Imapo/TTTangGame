// === КЛАСС ОСКОЛКА КИРПИЧА ===
class BrickFragment {
    constructor(x, y, size) {
        this.position = new Vector2(x, y);
        this.size = size;

        // Случайное направление и радиус разлёта (1-15 пикселей)
        const angle = Math.random() * Math.PI * 2;
        const distance = 1 + Math.random() * 14; // 1-15 пикселей
        this.velocity = new Vector2(
            Math.cos(angle) * distance * 0.1,
                                    Math.sin(angle) * distance * 0.1
        );

        this.rotation = Math.random() * Math.PI * 2;
        this.rotationSpeed = (Math.random() - 0.5) * 0.05;
        this.active = true;
        this.health = 1;
        this.color = Math.random() > 0.5 ? '#D2691E' : '#8B4513';
        this.collisionEnabled = false;
        this.creationTime = Date.now();
        this.hasStopped = false;
        this.originalPosition = new Vector2(x, y);
        this.maxDistance = distance;
    }

    update(allTanks = []) {
        if (!this.hasStopped) {
            // Проверяем, не достигли ли максимального расстояния разлёта
            const currentDistance = Math.sqrt(
                Math.pow(this.position.x - this.originalPosition.x, 2) +
                Math.pow(this.position.y - this.originalPosition.y, 2)
            );

            if (currentDistance >= this.maxDistance) {
                this.hasStopped = true;
                this.velocity = new Vector2(0, 0);
                this.rotationSpeed = 0;
                this.collisionEnabled = true;
            } else {
                this.position = this.position.add(this.velocity);
                this.rotation += this.rotationSpeed;
            }

            const timeSinceCreation = Date.now() - this.creationTime;
            if (timeSinceCreation > 1000) {
                this.hasStopped = true;
                this.velocity = new Vector2(0, 0);
                this.rotationSpeed = 0;
                this.collisionEnabled = true;
            }
        } else {
            this.handleTankCollisions(allTanks);
        }
    }

    handleTankCollisions(allTanks) {
        if (!this.collisionEnabled) return false;

        const fragmentBounds = this.getBounds();
        let collisionWithPlayer = false;

        for (const tank of allTanks) {
            if (tank.isDestroyed) continue;

            const tankBounds = tank.getBounds();
            if (fragmentBounds.intersects(tankBounds)) {
                // Вычисляем направление движения танка
                let tankMoveX = 0, tankMoveY = 0;

                if (tank.direction === DIRECTIONS.UP) tankMoveY = -tank.speed;
                else if (tank.direction === DIRECTIONS.DOWN) tankMoveY = tank.speed;
                else if (tank.direction === DIRECTIONS.LEFT) tankMoveX = -tank.speed;
                else if (tank.direction === DIRECTIONS.RIGHT) tankMoveX = tank.speed;

                // Осколок двигается в том же направлении, что и танк, но медленнее
                const fragmentMoveX = tankMoveX * 0.7;
                const fragmentMoveY = tankMoveY * 0.7;

                this.position = this.position.add(new Vector2(fragmentMoveX, fragmentMoveY));

                if (tank.type === 'player') {
                    collisionWithPlayer = true;
                }
            }
        }

        return collisionWithPlayer;
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
            return new Rectangle(0, 0, 0, 0);
        }
        return new Rectangle(
            this.position.x - this.size/2,
            this.position.y - this.size/2,
            this.size,
            this.size
        );
    }
}

// === КЛАСС КИРПИЧНОГО БЛОКА С ОСКОЛКАМИ ===
class BrickTile {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.health = 2;
        this.fragments = [];
        this.isDestroyed = false;
        this.cracks = this.generateCracks();
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
        // Если кирпич уже разрушен, не обрабатываем повреждение здесь
        if (this.isDestroyed) {
            return false;
        }

        this.health--;

        if (this.health <= 0) {
            this.isDestroyed = true;
            this.createFragments();
            return true; // Возвращаем true чтобы показать что кирпич разрушен
        }
        return false;
    }

    createFragments() {
        const tileX = this.x * TILE_SIZE;
        const tileY = this.y * TILE_SIZE;

        // Создаем 6-8 осколков
        const fragmentCount = 6 + Math.floor(Math.random() * 3);

        for (let i = 0; i < fragmentCount; i++) {
            const size = 6 + Math.random() * 6;
            const startX = tileX + (Math.random() * 0.6 + 0.2) * TILE_SIZE;
            const startY = tileY + (Math.random() * 0.6 + 0.2) * TILE_SIZE;

            this.fragments.push(new BrickFragment(startX, startY, size));
        }
    }

    update(allTanks = []) {
        this.fragments.forEach(fragment => {
            if (fragment.active) {
                fragment.update(allTanks);
            }
        });

        this.fragments = this.fragments.filter(fragment => fragment.active);
    }

    draw(ctx) {
        const tileX = this.x * TILE_SIZE;
        const tileY = this.y * TILE_SIZE;

        if (!this.isDestroyed) {
            ctx.fillStyle = '#D2691E';
            ctx.fillRect(tileX, tileY, TILE_SIZE, TILE_SIZE);

            ctx.strokeStyle = '#8B4513';
            ctx.lineWidth = 1;
            ctx.strokeRect(tileX, tileY, TILE_SIZE, TILE_SIZE);

            ctx.strokeStyle = '#A0522D';
            ctx.beginPath();
            ctx.moveTo(tileX, tileY + TILE_SIZE/2);
            ctx.lineTo(tileX + TILE_SIZE, tileY + TILE_SIZE/2);
            ctx.moveTo(tileX + TILE_SIZE/2, tileY);
            ctx.lineTo(tileX + TILE_SIZE/2, tileY + TILE_SIZE);
            ctx.stroke();

            if (this.health === 1) {
                ctx.strokeStyle = '#5D4037';
                this.cracks.forEach(crack => {
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
                });
            }
        }

        this.fragments.forEach(fragment => {
            if (fragment.active) {
                fragment.draw(ctx);
            }
        });
    }

    checkBulletCollision(bullet) {
        if (this.isDestroyed) {
            // Для разрушенного кирпича проверяем только осколки
            let hitFragment = false;
            for (let i = this.fragments.length - 1; i >= 0; i--) {
                const fragment = this.fragments[i];
                if (fragment.active && fragment.collisionEnabled && bullet.getBounds().intersects(fragment.getBounds())) {
                    if (fragment.takeDamage()) {
                        this.fragments.splice(i, 1);
                    }
                    hitFragment = true;
                    break;
                }
            }
            return hitFragment; // Возвращаем true если попали в осколок
        } else {
            // Для целого кирпича проверяем столкновение с основным блоком
            const brickBounds = new Rectangle(
                this.x * TILE_SIZE,
                this.y * TILE_SIZE,
                TILE_SIZE,
                TILE_SIZE
            );
            return bullet.getBounds().intersects(brickBounds);
        }
    }

    hasFragments() {
        return this.fragments.length > 0;
    }
}
