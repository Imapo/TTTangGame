// === ИСПРАВЛЕННАЯ СИСТЕМА ИИ БЕЗ ДЕРГАНИЯ У ЦЕЛИ ===

class EnemyAI {
    constructor(tank) {
        this.tank = tank;
        this.state = 'PATROL';
        this.lastKnownPlayerPosition = null;
        this.basePosition = null;
        this.stuckCounter = 0;
        this.lastPosition = tank.position.clone();
        this.lastPlayerSighting = 0;
        this.lastBaseCheck = 0;
        this.lastLogTime = 0;
        this.lastDirectionChange = 0; // Время последней смены направления
        this.lastPathRecalculation = 0; // Время последнего перерасчета пути
        this.playerSearchCooldown = 0;
        this.baseDetectionRange = 300;
        this.reactionTime = 2000;
        this.reachedTarget = false;
        this.directionChangeCooldown = 2000; // 2 секунды между сменами направлений
        this.pathRecalculationCooldown = 1000; // 1 секунда между перерасчетами пути
    }

    update(map, player, otherTanks, brickFragments) {
        if (this.tank.isFrozen) return;

        if (this.playerSearchCooldown > 0) {
            this.playerSearchCooldown--;
        }

        if (!this.basePosition) {
            this.basePosition = this.findBasePosition(map);
        }

        this.updateState(player, map);

        switch (this.state) {
            case 'PATROL':
                this.patrolBehavior(map, otherTanks, brickFragments);
                break;
            case 'ATTACK_PLAYER':
                this.attackPlayerBehavior(map, player, otherTanks, brickFragments);
                break;
            case 'ATTACK_BASE':
                this.attackBaseBehavior(map, otherTanks, brickFragments);
                break;
        }

        this.updateShooting(player, map);
        this.checkStuck();
    }

    updateState(player, map) {
        const now = Date.now();

        // ПРИОРИТЕТ 1: Игрок виден
        if (player && !player.isDestroyed && this.tank.canSeePlayer(player, map)) {
            if (now - this.lastPlayerSighting > this.reactionTime) {
                this.state = 'ATTACK_PLAYER';
                this.lastKnownPlayerPosition = player.position.clone();
                this.lastPlayerSighting = now;
                this.reachedTarget = false; // Сбрасываем при смене цели
                this.logAction('АТАКА ИГРОКА');
            }
            return;
        }

        // ПРИОРИТЕТ 2: Продолжаем преследование игрока
        if (this.lastKnownPlayerPosition && this.state === 'ATTACK_PLAYER') {
            const distanceToLastPosition = this.getDistanceTo(this.lastKnownPlayerPosition);
            if (distanceToLastPosition > 80 && !this.reachedTarget) {
                return;
            }
        }

        // ПРИОРИТЕТ 3: База
        if (this.basePosition && this.shouldAttackBase(map)) {
            if (now - this.lastBaseCheck > this.reactionTime) {
                this.state = 'ATTACK_BASE';
                this.lastBaseCheck = now;
                this.reachedTarget = false; // Сбрасываем при смене цели
                const distance = Math.round(this.getDistanceTo(this.basePosition));
                this.logAction(`АТАКА БАЗЫ (${distance}px)`);
            }
            return;
        }

        // ПРИОРИТЕТ 4: Патрулирование
        this.state = 'PATROL';
        this.lastKnownPlayerPosition = null;
        this.reachedTarget = false;
    }

    patrolBehavior(map, otherTanks, brickFragments) {
        this.tank.currentDirectionTime++;

        // В патрулировании тоже используем таймауты
        const now = Date.now();
        if (this.basePosition && now - this.lastBaseCheck > this.reactionTime) {
            const distanceToBase = this.getDistanceTo(this.basePosition);
            if (distanceToBase < this.baseDetectionRange && this.hasLineOfSightToBase(map)) {
                this.state = 'ATTACK_BASE';
                this.lastBaseCheck = now;
                this.reachedTarget = false;
                this.logAction(`обнаружил базу при патрулировании (${Math.round(distanceToBase)}px)`);
                return;
            }
        }

        // Смена направления в патрулировании с таймаутом
        if (this.tank.currentDirectionTime >= this.tank.maxDirectionTime ||
            Math.random() < 0.01 ||
            !this.tank.move(this.tank.direction, map, otherTanks, brickFragments)) {

            if (now - this.lastDirectionChange > this.directionChangeCooldown) {
                this.changeRandomDirection();
                this.tank.currentDirectionTime = 0;
                this.lastDirectionChange = now;
            }
            }
    }

    attackPlayerBehavior(map, player, otherTanks, brickFragments) {
        if (this.currentMovementCooldown > 0) {
            this.continueCurrentMovement(map, otherTanks, brickFragments);
            return;
        }

        let targetPosition = this.lastKnownPlayerPosition;

        const now = Date.now();
        if (player && !player.isDestroyed && this.tank.canSeePlayer(player, map) &&
            now - this.lastPlayerSighting > this.reactionTime) {
            targetPosition = player.position;
        this.lastKnownPlayerPosition = player.position.clone();
        this.lastPlayerSighting = now;
        this.reachedTarget = false; // Сбрасываем при обновлении позиции
            }

            if (!targetPosition) {
                this.state = 'PATROL';
                return;
            }

            this.moveToTargetWithPauses(targetPosition, map, otherTanks, brickFragments, 'PLAYER');
    }

    attackBaseBehavior(map, otherTanks, brickFragments) {
        if (!this.basePosition) {
            this.state = 'PATROL';
            return;
        }

        const distanceToBase = this.getDistanceTo(this.basePosition);

        // Если очень близко к базе - считаем что достигли цели
        if (distanceToBase < 60 && !this.reachedTarget) {
            this.reachedTarget = true;
            this.logAction("достиг базы, занимаю позицию");
        }

        const now = Date.now();
        if (now - this.lastLogTime > 3000 && !this.reachedTarget) {
            this.logAction(`атакует базу (${Math.round(distanceToBase)}px)`);
            this.lastLogTime = now;
        }

        if (map.baseDestroyed) {
            this.logAction("база уничтожена, возвращаюсь к патрулированию");
            this.state = 'PATROL';
            this.reachedTarget = false;
            return;
        }

        if (!this.hasLineOfSightToBase(map)) {
            if (now - this.lastBaseCheck > this.reactionTime) {
                this.logAction("потерял видимость базы, возвращаюсь к патрулированию");
                this.state = 'PATROL';
                this.lastBaseCheck = now;
                this.reachedTarget = false;
                return;
            }
        }

        if (this.currentMovementCooldown > 0) {
            this.continueCurrentMovement(map, otherTanks, brickFragments);
            return;
        }

        this.moveToTargetWithPauses(this.basePosition, map, otherTanks, brickFragments, 'BASE');
    }

    // ИСПРАВЛЕННЫЙ МЕТОД: Движение к цели с правильными таймаутами
    moveToTargetWithPauses(targetPosition, map, otherTanks, brickFragments, targetType) {
        const distanceToTarget = this.getDistanceTo(targetPosition);
        const now = Date.now();

        // Если достигли цели - просто поворачиваемся
        if (distanceToTarget < 5) {
            if (!this.reachedTarget) {
                this.reachedTarget = true;
                this.logAction(`достиг ${targetType === 'BASE' ? 'базы' : 'игрока'}, занимаю позицию`);
            }
            this.faceTarget(targetPosition);
            return;
        }

        // ПЕРЕРАСЧЕТ ПУТИ: не чаще чем раз в 1 секунду
        if (now - this.lastPathRecalculation > this.pathRecalculationCooldown) {
            this.lastPathRecalculation = now;

            // Сначала пытаемся выровняться по осям
            if (this.tryAlignWithTarget(targetPosition, map, otherTanks, brickFragments)) {
                return;
            }

            // Если не выравниваемся, выбираем новое направление
            this.chooseBestDirection(targetPosition, map, otherTanks, brickFragments);
        }

        // ДВИЖЕНИЕ: Просто продолжаем двигаться в текущем направлении
        if (!this.tank.move(this.tank.direction, map, otherTanks, brickFragments)) {
            this.stuckCounter++;
            if (this.stuckCounter > 10) { // Увеличил порог застревания
                // Принудительная смена направления при застревании
                this.emergencyDirectionChange(map, otherTanks, brickFragments);
                this.stuckCounter = 0;
                this.lastDirectionChange = now; // Сбрасываем таймер
            }
        } else {
            this.stuckCounter = 0;
        }
    }

    // НОВЫЙ МЕТОД: Выбор направления с таймаутом
    chooseBestDirection(targetPosition, map, otherTanks, brickFragments) {
        const now = Date.now();

        // ПРОВЕРКА ТАЙМАУТА: не меняем направление чаще чем раз в 2 секунды
        if (now - this.lastDirectionChange < this.directionChangeCooldown) {
            return; // Ждем пока пройдет таймаут
        }

        const directions = Object.values(DIRECTIONS);
        let bestDirection = this.tank.direction;
        let bestScore = -9999;

        for (const direction of directions) {
            let score = this.evaluateDirection(direction, targetPosition, map, otherTanks);

            if (score > bestScore) {
                bestScore = score;
                bestDirection = direction;
            }
        }

        // Меняем направление только если значительно лучше
        if (bestDirection !== this.tank.direction && bestScore > 100) {
            this.tank.direction = bestDirection;
            this.lastDirectionChange = now; // Запоминаем время смены направления
            this.logAction(`меняю направление на ${this.getDirectionName(bestDirection)}`);
        }
    }

    // НОВЫЙ МЕТОД: Оценка направления
    evaluateDirection(direction, targetPosition, map, otherTanks) {
        let score = 0;

        const directionVector = new Vector2(direction.x, direction.y);
        const newPos = this.tank.position.add(directionVector.multiply(this.tank.size * 2));

        const distanceToTarget = this.getDistanceTo(targetPosition);
        const distanceFromNewPos = this.getDistanceFromTo(newPos, targetPosition);

        // ОСНОВНАЯ ОЦЕНКА: движение к цели
        if (distanceFromNewPos < distanceToTarget) {
            score += 400; // Очень большой бонус за движение к цели
        } else {
            score -= 300; // Большой штраф за движение от цели
        }

        // БОНУС за прямое движение к цели
        if (this.isMovingDirectlyTowardTarget(direction, targetPosition)) {
            score += 200;
        }

        // ШТРАФ за столкновения
        const testBounds = new Rectangle(
            newPos.x - this.tank.size/2 + 2,
            newPos.y - this.tank.size/2 + 2,
            this.tank.size - 4,
            this.tank.size - 4
        );

        if (map.checkCollision(testBounds)) {
            score -= 1000;
        }

        // ШТРАФ за столкновения с танками
        for (const tank of otherTanks) {
            if (tank !== this.tank && !tank.isDestroyed && testBounds.intersects(tank.getBounds())) {
                score -= 500;
            }
        }

        // БОНУС за текущее направление (чтобы меньше менять)
        if (direction === this.tank.direction) {
            score += 300; // Очень большой бонус за текущее направление
        }

        // МИНИМАЛЬНАЯ случайность
        score += Math.random() * 10;

        return score;
    }

    // НОВЫЙ МЕТОД: Аварийная смена направления
    emergencyDirectionChange(map, otherTanks, brickFragments) {
        const directions = [DIRECTIONS.UP, DIRECTIONS.DOWN, DIRECTIONS.LEFT, DIRECTIONS.RIGHT];
        const availableDirections = directions.filter(dir => dir !== this.tank.direction);

        // Пробуем все направления пока не найдем рабочее
        for (const direction of availableDirections) {
            if (this.tank.move(direction, map, otherTanks, brickFragments)) {
                this.tank.direction = direction;
                this.logAction(`аварийная смена направления на ${this.getDirectionName(direction)}`);
                return;
            }
        }

        // Если все направления заблокированы - телепортируем
        this.tryPushOut();
    }

    // НОВЫЙ МЕТОД: Получить имя направления для логов
    getDirectionName(direction) {
        if (direction === DIRECTIONS.UP) return 'ВВЕРХ';
        if (direction === DIRECTIONS.DOWN) return 'ВНИЗ';
        if (direction === DIRECTIONS.LEFT) return 'ВЛЕВО';
        if (direction === DIRECTIONS.RIGHT) return 'ВПРАВО';
        return 'НЕИЗВЕСТНО';
    }

    // Выравнивание по осям (оставляем без изменений)
    tryAlignWithTarget(targetPosition, map, otherTanks, brickFragments) {
        const dx = Math.abs(this.tank.position.x - targetPosition.x);
        const dy = Math.abs(this.tank.position.y - targetPosition.y);

        if (dx < 10 && dy > 20) {
            const moveY = targetPosition.y > this.tank.position.y ? DIRECTIONS.DOWN : DIRECTIONS.UP;
            if (this.tank.move(moveY, map, otherTanks, brickFragments)) {
                this.tank.direction = moveY;
                return true;
            }
        } else if (dy < 10 && dx > 20) {
            const moveX = targetPosition.x > this.tank.position.x ? DIRECTIONS.RIGHT : DIRECTIONS.LEFT;
            if (this.tank.move(moveX, map, otherTanks, brickFragments)) {
                this.tank.direction = moveX;
                return true;
            }
        }
        return false;
    }

    // НОВЫЙ МЕТОД: Попытка выровняться по осям с целью
    tryAlignWithTarget(targetPosition, map, otherTanks, brickFragments) {
        const dx = Math.abs(this.tank.position.x - targetPosition.x);
        const dy = Math.abs(this.tank.position.y - targetPosition.y);

        // Если уже достаточно близко по одной оси, двигаемся по другой
        if (dx < 10 && dy > 20) {
            // Выровнены по X, нужно двигаться по Y
            const moveY = targetPosition.y > this.tank.position.y ? DIRECTIONS.DOWN : DIRECTIONS.UP;
            if (this.tank.move(moveY, map, otherTanks, brickFragments)) {
                this.tank.direction = moveY;
                return true;
            }
        } else if (dy < 10 && dx > 20) {
            // Выровнены по Y, нужно двигаться по X
            const moveX = targetPosition.x > this.tank.position.x ? DIRECTIONS.RIGHT : DIRECTIONS.LEFT;
            if (this.tank.move(moveX, map, otherTanks, brickFragments)) {
                this.tank.direction = moveX;
                return true;
            }
        }

        return false;
    }

    // НОВЫЙ МЕТОД: Проверка движения прямо к цели
    isMovingDirectlyTowardTarget(direction, targetPosition) {
        const dx = targetPosition.x - this.tank.position.x;
        const dy = targetPosition.y - this.tank.position.y;

        if (Math.abs(dx) > Math.abs(dy)) {
            return (dx > 0 && direction === DIRECTIONS.RIGHT) ||
            (dx < 0 && direction === DIRECTIONS.LEFT);
        } else {
            return (dy > 0 && direction === DIRECTIONS.DOWN) ||
            (dy < 0 && direction === DIRECTIONS.UP);
        }
    }

    // НОВЫЙ МЕТОД: Поиск альтернативного пути
    findAlternativePath(targetPosition, map, otherTanks, brickFragments) {
        const directions = [DIRECTIONS.UP, DIRECTIONS.DOWN, DIRECTIONS.LEFT, DIRECTIONS.RIGHT];
        let bestDirection = this.tank.direction;
        let minObstacles = Infinity;

        for (const direction of directions) {
            if (this.tank.move(direction, map, otherTanks, brickFragments)) {
                // Если можем двигаться в этом направлении, проверяем насколько оно хорошее
                const newPos = this.tank.position.add(new Vector2(direction.x, direction.y).multiply(this.tank.size));
                const newDistance = this.getDistanceFromTo(newPos, targetPosition);

                if (newDistance < minObstacles) {
                    minObstacles = newDistance;
                    bestDirection = direction;
                }
                // Отменяем движение (мы только проверяли)
                this.tank.position = this.tank.position.add(new Vector2(-direction.x, -direction.y).multiply(this.tank.size));
            }
        }

        this.tank.direction = bestDirection;
        this.currentMovementCooldown = 10;
    }

    // ИСПРАВЛЕННЫЙ МЕТОД: Поворот к цели
    faceTarget(targetPosition) {
        const dx = targetPosition.x - this.tank.position.x;
        const dy = targetPosition.y - this.tank.position.y;

        if (Math.abs(dx) > Math.abs(dy)) {
            this.tank.direction = dx > 0 ? DIRECTIONS.RIGHT : DIRECTIONS.LEFT;
        } else {
            this.tank.direction = dy > 0 ? DIRECTIONS.DOWN : DIRECTIONS.UP;
        }
    }

    continueCurrentMovement(map, otherTanks, brickFragments) {
        if (!this.reachedTarget) {
            if (!this.tank.move(this.tank.direction, map, otherTanks, brickFragments)) {
                this.stuckCounter++;
                if (this.stuckCounter > 5) {
                    this.changeRandomDirection();
                    this.currentMovementCooldown = 20;
                    this.stuckCounter = 0;
                }
            } else {
                this.stuckCounter = 0;
            }
        }
        // Если достигли цели - не двигаемся
    }

    changeRandomDirection() {
        const directions = Object.values(DIRECTIONS);
        const availableDirections = directions.filter(dir => dir !== this.tank.direction);
        this.tank.direction = availableDirections[Math.floor(Math.random() * availableDirections.length)];
    }

    logAction(message) {
        const now = Date.now();
        if (now - this.lastLogTime > 1000) {
            console.log(`🎯 ${this.tank.username} -> ${message}`);
            this.lastLogTime = now;
        }
    }

    // Остальные методы без изменений
    shouldAttackBase(map) {
        if (!this.basePosition) return false;
        const distanceToBase = this.getDistanceTo(this.basePosition);
        if (distanceToBase < 150) return true;
        if (distanceToBase < this.baseDetectionRange && this.hasLineOfSightToBase(map)) return true;
        return false;
    }

    hasLineOfSightToBase(map) {
        if (!this.basePosition) return false;
        const steps = 20;
        const dx = (this.basePosition.x - this.tank.position.x) / steps;
        const dy = (this.basePosition.y - this.tank.position.y) / steps;
        for (let i = 1; i < steps; i++) {
            const checkX = this.tank.position.x + dx * i;
            const checkY = this.tank.position.y + dy * i;
            const checkBounds = new Rectangle(checkX - 3, checkY - 3, 6, 6);
            if (map.checkCollision(checkBounds)) return false;
        }
        return true;
    }

    getDistanceTo(target) {
        return Math.sqrt(
            Math.pow(this.tank.position.x - target.x, 2) +
            Math.pow(this.tank.position.y - target.y, 2)
        );
    }

    getDistanceFromTo(from, to) {
        return Math.sqrt(
            Math.pow(from.x - to.x, 2) +
            Math.pow(from.y - to.y, 2)
        );
    }

    updateShooting(player, map) {
        if (!this.tank.canShoot || this.tank.isFrozen) return;
        let shouldShoot = false;
        const baseShootChance = SHOOT_CHANCES[this.tank.enemyType] || 0.02;

        switch (this.state) {
            case 'PATROL':
                shouldShoot = Math.random() < baseShootChance;
                break;
            case 'ATTACK_PLAYER':
                if (player && !player.isDestroyed && this.tank.canSeePlayer(player, map)) {
                    shouldShoot = Math.random() < (baseShootChance * 1.8);
                } else {
                    shouldShoot = Math.random() < baseShootChance;
                }
                break;
            case 'ATTACK_BASE':
                shouldShoot = Math.random() < (baseShootChance * 1.5);
                break;
        }

        if (shouldShoot) {
            const bullet = this.tank.shoot();
            if (bullet && typeof game !== 'undefined') {
                game.bullets.push(bullet);
                game.soundManager.playEnemyShot(this.tank.enemyType);
            }
            this.tank.canShoot = false;
            this.tank.reloadTime = this.getReloadTime();
        }
    }

    getReloadTime() {
        switch (this.tank.enemyType) {
            case 'FAST': return 25;
            case 'HEAVY': return 60;
            default: return 40;
        }
    }

    checkStuck() {
        if (this.reachedTarget) return; // Не проверяем застревание если достигли цели

        const distanceMoved = this.getDistanceTo(this.lastPosition);
        if (distanceMoved < 1) {
            this.stuckCounter++;
        } else {
            this.stuckCounter = Math.max(0, this.stuckCounter - 1);
            this.lastPosition = this.tank.position.clone();
        }
        if (this.stuckCounter > 60) {
            this.resolveStuck();
        }
    }

    resolveStuck() {
        this.logAction("пытается выйти из застревания");
        this.changeRandomDirection();
        this.tryPushOut();
        this.stuckCounter = 0;
        this.currentMovementCooldown = 40;
    }

    tryPushOut() {
        const directions = Object.values(DIRECTIONS);
        for (const direction of directions) {
            const testPos = this.tank.position.add(new Vector2(direction.x, direction.y).multiply(8));
            if (this.tank.isPositionInBounds(testPos.x, testPos.y)) {
                this.tank.position = testPos;
                return;
            }
        }
    }

    findBasePosition(map) {
        for (let y = map.height - 5; y < map.height; y++) {
            for (let x = Math.floor(map.width / 2) - 2; x <= Math.floor(map.width / 2) + 2; x++) {
                if (x >= 0 && x < map.width && y >= 0 && y < map.height) {
                    if (map.grid[y][x] === TILE_TYPES.BASE) {
                        return {
                            x: x * TILE_SIZE + TILE_SIZE / 2,
                            y: y * TILE_SIZE + TILE_SIZE / 2
                        };
                    }
                }
            }
        }
        return null;
    }
}

// Базовый ИИ остается без изменений
class BasicEnemyAI extends EnemyAI {
    update(map, player, otherTanks, brickFragments) {
        if (this.tank.isFrozen) return;
        this.tank.currentDirectionTime++;
        if (this.tank.currentDirectionTime >= this.tank.maxDirectionTime ||
            Math.random() < 0.01 ||
            !this.tank.move(this.tank.direction, map, otherTanks, brickFragments)) {
            this.changeRandomDirection();
        this.tank.currentDirectionTime = 0;
            }
            this.updateShooting(player, map);
            this.checkStuck();
    }
}
