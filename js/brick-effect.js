// === ОПТИМИЗИРОВАННЫЙ КЛАСС ОСКОЛКА КИРПИЧА ===
// === ОПТИМИЗИРОВАННЫЙ КЛАСС ОСКОЛКА КИРПИЧА ===
class BrickFragment {
    constructor(x, y, size) {
        this.position = new Vector2(x, y);
        this.size = size;
        this.active = true;
        this.health = 1;
        this.collisionEnabled = true;
        this.creationTime = Date.now();
        this.hasStopped = false;
        this.originalPosition = new Vector2(x, y);
        this.isBeingPushed = false;
        this.pushForce = new Vector2(0, 0);
        this.friction = 0.85;
        this.lastCollisionCheck = 0;
        this.isStuck = false;
        this.stuckDirection = new Vector2(0, 0);

        // Простой разлёт в случайном направлении
        const angle = Math.random() * Math.PI * 2;
        this.maxDistance = 10 + Math.random() * 10;
        this.velocity = new Vector2(
            Math.cos(angle) * 2,
                                    Math.sin(angle) * 2
        );

        this.color = Math.random() > 0.5 ? '#D2691E' : '#8B4513';
    }

    update(allTanks = []) {
        if (!this.hasStopped) {
            // Двигаем фрагмент
            this.position = this.position.add(this.velocity);

            // Останавливаем через время или расстояние
            const dx = this.position.x - this.originalPosition.x;
            const dy = this.position.y - this.originalPosition.y;
            const distanceSquared = dx * dx + dy * dy;

            if (distanceSquared >= this.maxDistance * this.maxDistance ||
                (Date.now() - this.creationTime) > 800) {
                this.stopFragment();
                }
        } else {
            // ПРИМЕНЯЕМ ИНЕРЦИЮ (всегда, кроме направления застревания)
            if (this.pushForce.length() > 0.1) {
                // Если застрял, фильтруем силу чтобы не двигаться в направлении препятствия
                let filteredForce = this.pushForce;
                if (this.isStuck && this.stuckDirection.length() > 0) {
                    // Обнуляем компоненту силы в направлении препятствия
                    if (Math.abs(this.stuckDirection.x) > 0.5) {
                        filteredForce = new Vector2(0, filteredForce.y);
                    }
                    if (Math.abs(this.stuckDirection.y) > 0.5) {
                        filteredForce = new Vector2(filteredForce.x, 0);
                    }
                }

                this.position = this.position.add(filteredForce);
                this.pushForce = this.pushForce.multiply(this.friction);
            } else {
                this.pushForce = new Vector2(0, 0);
            }
        }

        // Обрабатываем столкновения с танками
        this.handleTankCollisions(allTanks);

        // Проверяем границы и коллизии
        if (Date.now() - this.lastCollisionCheck > 50) {
            this.checkBoundaries();
            this.lastCollisionCheck = Date.now();
        }
    }

    stopFragment() {
        this.hasStopped = true;
        this.velocity = new Vector2(0, 0);
    }

    // МЕТОД ДЛЯ ОБРАБОТКИ СТОЛКНОВЕНИЙ С ТАНКАМИ
    handleTankCollisions(allTanks) {
        if (!this.active || this.isStuck) return false;

        for (let i = 0; i < allTanks.length; i++) {
            const tank = allTanks[i];
            if (tank.isDestroyed) continue;

            const tankBounds = tank.getBounds();
            if (this.getBounds().intersects(tankBounds)) {
                this.applyTankPush(tank);
                break;
            }
        }

        return false;
    }

    // МЕТОД ДЛЯ ТОЛЧКА ОТ ТАНКА
    applyTankPush(tank) {
        // Снимаем флаг застревания при ЛЮБОМ толчке
        this.isStuck = false;
        this.stuckDirection = new Vector2(0, 0);

        let pushX = 0, pushY = 0;
        switch (tank.direction) {
            case DIRECTIONS.UP: pushY = -tank.speed; break;
            case DIRECTIONS.DOWN: pushY = tank.speed; break;
            case DIRECTIONS.LEFT: pushX = -tank.speed; break;
            case DIRECTIONS.RIGHT: pushX = tank.speed; break;
        }

        this.pushForce = this.pushForce.add(new Vector2(pushX * 1.2, pushY * 1.2));

        const maxForce = 4;
        const currentLength = this.pushForce.length();
        if (currentLength > maxForce) {
            const scale = maxForce / currentLength;
            this.pushForce = this.pushForce.multiply(scale);
        }
    }

    // МЕТОД ДЛЯ ПРОВЕРКИ ГРАНИЦ
    checkBoundaries() {
        const bounds = this.getBounds();
        const gameBounds = TILE_SIZE;

        let collision = false;
        let collisionDirection = new Vector2(0, 0);

        if (bounds.x < gameBounds) {
            this.position.x = gameBounds + this.size/2;
            collision = true;
            collisionDirection = new Vector2(1, 0);
        }
        if (bounds.x + bounds.width > CANVAS_WIDTH - gameBounds) {
            this.position.x = CANVAS_WIDTH - gameBounds - this.size/2;
            collision = true;
            collisionDirection = new Vector2(-1, 0);
        }
        if (bounds.y < gameBounds) {
            this.position.y = gameBounds + this.size/2;
            collision = true;
            collisionDirection = new Vector2(0, 1);
        }
        if (bounds.y + bounds.height > CANVAS_HEIGHT - gameBounds) {
            this.position.y = CANVAS_HEIGHT - gameBounds - this.size/2;
            collision = true;
            collisionDirection = new Vector2(0, -1);
        }

        if (collision) {
            this.handleSolidCollision(collisionDirection);
        }
    }

    // МЕТОД ДЛЯ ОБРАБОТКИ СТОЛКНОВЕНИЙ С ТВЁРДЫМИ ОБЪЕКТАМИ
    handleSolidCollision(direction) {
        this.isStuck = true;
        this.stuckDirection = direction;

        // МГНОВЕННОЕ выталкивание
        this.resolveCollisionInstantly(direction);
    }

    // МЕТОД ДЛЯ МГНОВЕННОГО ВЫТАЛКИВАНИЯ
    resolveCollisionInstantly(direction) {
        const pushDistance = 3; // Фиксированное расстояние выталкивания

        if (Math.abs(direction.x) > Math.abs(direction.y)) {
            // Выталкиваем по X
            this.position.x += direction.x > 0 ? pushDistance : -pushDistance;
        } else {
            // Выталкиваем по Y
            this.position.y += direction.y > 0 ? pushDistance : -pushDistance;
        }

        // Гасим силу в направлении препятствия
        if (direction.x !== 0) this.pushForce.x = 0;
        if (direction.y !== 0) this.pushForce.y = 0;
    }

    // ВСПОМОГАТЕЛЬНЫЙ МЕТОД ДЛЯ ДЛИНЫ ВЕКТОРА
    length() {
        return this.pushForce.length();
    }

    // МЕТОД ДЛЯ УПРУГИХ СТОЛКНОВЕНИЙ МЕЖДУ ФРАГМЕНТАМИ
    resolveElasticCollision(otherFragment) {
        // Если один из фрагментов застрял, не обрабатываем столкновение
        if (this.isStuck || otherFragment.isStuck) return false;

        const bounds1 = this.getBounds();
        const bounds2 = otherFragment.getBounds();

        if (!bounds1.intersects(bounds2)) return false;

        const center1 = new Vector2(bounds1.x + bounds1.width/2, bounds1.y + bounds1.height/2);
        const center2 = new Vector2(bounds2.x + bounds2.width/2, bounds2.y + bounds2.height/2);

        const dx = center1.x - center2.x;
        const dy = center1.y - center2.y;
        const distance = Math.sqrt(dx*dx + dy*dy);

        if (distance === 0) return false;

        const minDistance = this.size;
        const overlap = minDistance - distance;

        if (overlap > 0) {
            const nx = dx / distance;
            const ny = dy / distance;
            const pushForce = overlap * 0.5;

            this.position = this.position.add(new Vector2(nx * pushForce * 0.5, ny * pushForce * 0.5));
            otherFragment.position = otherFragment.position.add(new Vector2(-nx * pushForce * 0.5, -ny * pushForce * 0.5));

            const collisionInertia = 0.2;
            this.pushForce = this.pushForce.add(new Vector2(nx * collisionInertia, ny * collisionInertia));
            otherFragment.pushForce = otherFragment.pushForce.add(new Vector2(-nx * collisionInertia, -ny * collisionInertia));

            return true;
        }

        return false;
    }

    // МЕТОД ДЛЯ ПОЛУЧЕНИЯ СОСЕДЕЙ
    getNeighbors(allFragments) {
        const neighbors = [];
        const myBounds = this.getBounds();

        for (let i = 0; i < allFragments.length; i++) {
            const fragment = allFragments[i];
            if (fragment === this || !fragment.active) continue;

            const otherBounds = fragment.getBounds();
            if (myBounds.intersects(otherBounds)) {
                neighbors.push(fragment);
            }
        }

        return neighbors;
    }

    // МЕТОД ДЛЯ ОТРИСОВКИ
    draw(ctx) {
        if (!this.active) return;

        const bounds = this.getBounds();

        // Рисуем фрагмент
        ctx.fillStyle = this.color;
        ctx.fillRect(bounds.x, bounds.y, this.size, this.size);

        ctx.strokeStyle = '#A0522D';
        ctx.lineWidth = 1;
        ctx.strokeRect(bounds.x, bounds.y, this.size, this.size);

        // Индикатор застревания
        if (this.isStuck) {
            ctx.strokeStyle = 'rgba(255, 0, 0, 0.5)';
            ctx.lineWidth = 2;
            ctx.strokeRect(bounds.x - 1, bounds.y - 1, this.size + 2, this.size + 2);
        }
    }

    // МЕТОД ДЛЯ ПОЛУЧЕНИЯ УРОНА
    takeDamage() {
        this.health--;
        if (this.health <= 0) {
            this.active = false;
            return true;
        }
        return false;
    }

    // МЕТОД ДЛЯ ПОЛУЧЕНИЯ ГРАНИЦ
    getBounds() {
        return new Rectangle(
            this.position.x - this.size/2,
            this.position.y - this.size/2,
            this.size,
            this.size
        );
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
        const fragmentSize = TILE_SIZE / 2;

        // 4 одинаковых фрагмента в углах
        const positions = [
            { x: this.tileX + fragmentSize/2, y: this.tileY + fragmentSize/2 },
            { x: this.tileX + TILE_SIZE - fragmentSize/2, y: this.tileY + fragmentSize/2 },
            { x: this.tileX + fragmentSize/2, y: this.tileY + TILE_SIZE - fragmentSize/2 },
            { x: this.tileX + TILE_SIZE - fragmentSize/2, y: this.tileY + TILE_SIZE - fragmentSize/2 }
        ];

        for (let i = 0; i < 4; i++) {
            const pos = positions[i];
            this.fragments.push(new BrickFragment(pos.x, pos.y, fragmentSize));
        }
    }

    update(allTanks = []) {
        // Сначала обновляем все фрагменты
        for (let i = this.fragments.length - 1; i >= 0; i--) {
            const fragment = this.fragments[i];
            if (fragment.active) {
                fragment.update(allTanks);
            } else {
                this.fragments.splice(i, 1);
            }
        }

        // УПРУГИЕ СТОЛКНОВЕНИЯ между фрагментами (только незастрявшие)
        let collisionFound = false;
        for (let i = 0; i < this.fragments.length; i++) {
            const fragment1 = this.fragments[i];
            if (!fragment1.active || fragment1.isStuck) continue;

            for (let j = i + 1; j < this.fragments.length; j++) {
                const fragment2 = this.fragments[j];
                if (!fragment2.active || fragment2.isStuck) continue;

                if (fragment1.resolveElasticCollision(fragment2)) {
                    collisionFound = true;
                }
            }
        }

        // СОПРОТИВЛЕНИЕ ТОЛПЫ
        for (let i = 0; i < this.fragments.length; i++) {
            const fragment = this.fragments[i];
            if (!fragment.active || fragment.pushForce.length() === 0) continue;

            const neighbors = fragment.getNeighbors(this.fragments);
            if (neighbors.length > 0) {
                const crowdFriction = Math.min(neighbors.length * 0.15, 0.6);
                fragment.friction = 0.85 - crowdFriction;

                const currentLength = fragment.pushForce.length();
                if (currentLength > 0) {
                    const scale = 1 - crowdFriction * 0.5;
                    fragment.pushForce = new Vector2(
                        fragment.pushForce.x * scale,
                        fragment.pushForce.y * scale
                    );
                }
            } else {
                fragment.friction = 0.85;
            }
        }

        // Проверяем коллизии с твёрдыми блоками
        this.checkSolidBlockCollisions();
    }

    // В классе BrickTile УПРОЩАЕМ проверку коллизий:
    checkSolidBlockCollisions() {
        if (typeof game === 'undefined' || !game.map) return;

        for (let i = 0; i < this.fragments.length; i++) {
            const fragment = this.fragments[i];
            if (!fragment.active || !fragment.hasStopped) continue;

            const bounds = fragment.getBounds();
            let hasCollision = false;

            const startX = Math.max(0, Math.floor(bounds.x / TILE_SIZE));
            const startY = Math.max(0, Math.floor(bounds.y / TILE_SIZE));
            const endX = Math.min(game.map.width-1, Math.floor((bounds.x + bounds.width) / TILE_SIZE));
            const endY = Math.min(game.map.height-1, Math.floor((bounds.y + bounds.height) / TILE_SIZE));

            for (let y = startY; y <= endY; y++) {
                for (let x = startX; x <= endX; x++) {
                    const tile = game.map.grid[y][x];

                    if (tile === TILE_TYPES.CONCRETE ||
                        tile === TILE_TYPES.BASE ||
                        (tile === TILE_TYPES.BRICK && this.isOtherBrick(x, y))) {

                        const tileBounds = new Rectangle(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
                    if (bounds.intersects(tileBounds)) {
                        hasCollision = true;
                        const direction = this.getSimpleCollisionDirection(bounds, tileBounds);
                        fragment.handleSolidCollision(direction);
                        break; // Обрабатываем только первую коллизию
                    }
                        }
                }
                if (hasCollision) break;
            }

            if (!hasCollision) {
                fragment.isStuck = false;
                fragment.stuckDirection = new Vector2(0, 0);
            }
        }
    }

    // ПРОСТОЙ метод определения направления коллизии
    getSimpleCollisionDirection(fragmentBounds, tileBounds) {
        const fragmentCenter = new Vector2(
            fragmentBounds.x + fragmentBounds.width / 2,
            fragmentBounds.y + fragmentBounds.height / 2
        );
        const tileCenter = new Vector2(
            tileBounds.x + tileBounds.width / 2,
            tileBounds.y + tileBounds.height / 2
        );

        const dx = fragmentCenter.x - tileCenter.x;
        const dy = fragmentCenter.y - tileCenter.y;

        // Простое определение: какая ось имеет большее смещение
        if (Math.abs(dx) > Math.abs(dy)) {
            return new Vector2(dx > 0 ? 1 : -1, 0);
        } else {
            return new Vector2(0, dy > 0 ? 1 : -1);
        }
    }

    // ДОБАВЛЯЕМ недостающий метод handleTankCollisions:
    handleTankCollisions(allTanks) {
        if (!this.active || this.isStuck) return false;

        for (let i = 0; i < allTanks.length; i++) {
            const tank = allTanks[i];
            if (tank.isDestroyed) continue;

            const tankBounds = tank.getBounds();
            if (this.getBounds().intersects(tankBounds)) {
                this.applyTankPush(tank);
                break;
            }
        }

        return false;
    }

    // Новый метод для вычисления глубины и направления пересечения
    calculateOverlap(bounds1, bounds2) {
        const overlapLeft = bounds1.x + bounds1.width - bounds2.x;
        const overlapRight = bounds2.x + bounds2.width - bounds1.x;
        const overlapTop = bounds1.y + bounds1.height - bounds2.y;
        const overlapBottom = bounds2.y + bounds2.height - bounds1.y;

        // Находим наименьшее перекрытие (направление выталкивания)
        const minOverlap = Math.min(overlapLeft, overlapRight, overlapTop, overlapBottom);

        let direction = new Vector2(0, 0);

        if (minOverlap === overlapLeft) {
            direction = new Vector2(-1, 0); // Выталкиваем влево
        } else if (minOverlap === overlapRight) {
            direction = new Vector2(1, 0); // Выталкиваем вправо
        } else if (minOverlap === overlapTop) {
            direction = new Vector2(0, -1); // Выталкиваем вверх
        } else if (minOverlap === overlapBottom) {
            direction = new Vector2(0, 1); // Выталкиваем вниз
        }

        return {
            depth: minOverlap,
            direction: direction
        };
    }

    // Определение направления столкновения
    getCollisionDirection(fragmentBounds, tileBounds) {
        const fragmentCenter = new Vector2(
            fragmentBounds.x + fragmentBounds.width / 2,
            fragmentBounds.y + fragmentBounds.height / 2
        );
        const tileCenter = new Vector2(
            tileBounds.x + tileBounds.width / 2,
            tileBounds.y + tileBounds.height / 2
        );

        const dx = fragmentCenter.x - tileCenter.x;
        const dy = fragmentCenter.y - tileCenter.y;

        // Возвращаем нормализованное направление от тайла к фрагменту
        const length = Math.sqrt(dx * dx + dy * dy);
        if (length > 0) {
            return new Vector2(dx / length, dy / length);
        }
        return new Vector2(0, 0);
    }

    // Проверяем, что это другой кирпич (не тот, из которого созданы фрагменты)
    isOtherBrick(x, y) {
        return x !== this.x || y !== this.y;
    }

    // Мягкое разрешение коллизий с твёрдыми блоками
    resolveSolidCollision(fragment, tileBounds) {
        const bounds = fragment.getBounds();

        const overlapLeft = bounds.x + bounds.width - tileBounds.x;
        const overlapRight = tileBounds.x + tileBounds.width - bounds.x;
        const overlapTop = bounds.y + bounds.height - tileBounds.y;
        const overlapBottom = tileBounds.y + tileBounds.height - bounds.y;

        // Находим направление наименьшего перекрытия
        const minOverlap = Math.min(overlapLeft, overlapRight, overlapTop, overlapBottom);

        if (minOverlap > 0) {
            // Мягкое отталкивание
            const pushDistance = minOverlap + 1;

            if (minOverlap === overlapLeft) {
                fragment.position.x = tileBounds.x - bounds.width - 1;
                fragment.pushForce.x = -Math.abs(fragment.pushForce.x) * 0.5;
            } else if (minOverlap === overlapRight) {
                fragment.position.x = tileBounds.x + tileBounds.width + 1;
                fragment.pushForce.x = Math.abs(fragment.pushForce.x) * 0.5;
            } else if (minOverlap === overlapTop) {
                fragment.position.y = tileBounds.y - bounds.height - 1;
                fragment.pushForce.y = -Math.abs(fragment.pushForce.y) * 0.5;
            } else if (minOverlap === overlapBottom) {
                fragment.position.y = tileBounds.y + tileBounds.height + 1;
                fragment.pushForce.y = Math.abs(fragment.pushForce.y) * 0.5;
            }
        }
    }

    draw(ctx) {
        const tileX = this.tileX;
        const tileY = this.tileY;

        if (!this.isDestroyed) {
            this.drawIntactBrick(ctx, tileX, tileY);
        }

        // Рисуем фрагменты ПОВЕРХ всех текстур
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
            return this.checkFragmentCollision(bulletBounds);
        } else {
            return bulletBounds.intersects(this.bounds);
        }
    }

    checkFragmentCollision(bulletBounds) {
        for (let i = this.fragments.length - 1; i >= 0; i--) {
            const fragment = this.fragments[i];
            if (fragment.active && bulletBounds.intersects(fragment.getBounds())) {
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

    clearFragments() {
        this.fragments.length = 0;
    }
}
