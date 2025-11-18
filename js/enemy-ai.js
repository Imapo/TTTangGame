class EnemyAI {
    constructor(tank) {
        this.tank = tank;
        this.state = 'PATROL';
        this.stuckCounter = 0;
        this.lastPosition = tank.position.clone();
    }

    // ДОБАВЛЯЕМ недостающий метод:
    getDirectionName(direction) {
        if (direction === DIRECTIONS.UP) return 'ВВЕРХ';
        if (direction === DIRECTIONS.DOWN) return 'ВНИЗ';
        if (direction === DIRECTIONS.LEFT) return 'ВЛЕВО';
        if (direction === DIRECTIONS.RIGHT) return 'ВПРАВО';
        return 'НЕИЗВЕСТНО';
    }

    // ДОБАВЛЯЕМ метод для логирования:
    logAction(message) {
        const now = Date.now();
        if (now - this.lastLogTime > 3000) {
            //console.log(`🎯 ${this.tank.username} -> ${message}`);
            this.lastLogTime = now;
        }
    }

    changeRandomDirection() {
        const directions = Object.values(DIRECTIONS);
        const availableDirections = directions.filter(dir => dir !== this.tank.direction);
        this.tank.direction = availableDirections[Math.floor(Math.random() * availableDirections.length)];
        this.logAction(`случайная смена направления на ${this.getDirectionName(this.tank.direction)}`);
    }

    patrolBehavior(map, otherTanks, brickFragments) {
        this.tank.currentDirectionTime++;

        // Двигаемся в текущем направлении
        const canMove = this.tank.move(this.tank.direction, map, otherTanks, brickFragments);

        // Меняем направление при столкновении или по времени
        if (!canMove || this.tank.currentDirectionTime >= this.tank.maxDirectionTime) {
            this.changeRandomDirection();
            this.tank.currentDirectionTime = 0;
        }
    }

    updateShooting(player, map) {
        if (!this.tank.canShoot || this.tank.isFrozen) return;

        let shootChance = SHOOT_CHANCES[this.tank.enemyType] || 0.02;

        // Увеличиваем шанс стрельбы при атаке базы
        if (this.tank.baseAttackMode) {
            shootChance *= 3;
        }

        if (Math.random() < shootChance) {
            let bullet;

            // Приоритетная стрельба в базу
            if (this.tank.baseAttackMode) {
                const baseDirection = this.tank.getBaseShootDirection();
                if (baseDirection) {
                    bullet = this.tank.shoot();
                    if (bullet) {
                        bullet.direction = baseDirection;
                    }
                }
            }

            // Обычная стрельба
            if (!bullet) {
                bullet = this.tank.shoot();
            }

            if (bullet && typeof game !== 'undefined') {
                game.bullets.push(bullet);
                game.soundManager.playEnemyShot(this.tank.enemyType);
                this.tank.recordShot();
                game.saveEnemyStatsToStorage(this.tank);
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
        const distanceMoved = Math.sqrt(
            Math.pow(this.tank.position.x - this.lastPosition.x, 2) +
            Math.pow(this.tank.position.y - this.lastPosition.y, 2)
        );

        if (distanceMoved < 2) {
            this.stuckCounter++;
        } else {
            this.stuckCounter = 0;
            this.lastPosition = this.tank.position.clone();
        }

        if (this.stuckCounter > 60) {
            this.changeRandomDirection();
            this.stuckCounter = 0;
        }
    }

    changeRandomDirection() {
        const directions = Object.values(DIRECTIONS);
        const availableDirections = directions.filter(dir => dir !== this.tank.direction);
        this.tank.direction = availableDirections[Math.floor(Math.random() * availableDirections.length)];
    }
}

class BasicEnemyAI extends EnemyAI {
    constructor(tank) {
        super(tank);
        this.debugShowMemory = false; // Включить для отладки
    }

    update(map, player, otherTanks, brickFragments) {
        if (this.tank.isFrozen) return;

        // ПРИОРИТЕТ: защита базы
        if (this.tank.baseDefenseMode) {
            this.baseDefenseBehavior(map, otherTanks, brickFragments);
            return;
        }

        // Движение только в состоянии MOVING и если можем двигаться
        if (this.tank.patrolState === 'MOVING') {
            this.tank.currentDirectionTime++;

            // Пытаемся двигаться в текущем направлении
            const canMove = this.tank.move(this.tank.direction, map, otherTanks, brickFragments);

            if (!canMove || this.tank.currentDirectionTime >= this.tank.maxDirectionTime) {
                // Меняем направление при столкновении или по истечении времени
                this.changeSmartDirection(map, otherTanks, brickFragments);
                this.tank.currentDirectionTime = 0;

                // Короткая остановка после смены направления
                if (Math.random() < 0.3) {
                    this.tank.patrolState = 'STOPPED';
                    this.tank.nextStateChangeTime = Date.now() + 1000;
                }
            }
        }

        // Стрельба возможна в любом состоянии
        this.updateShooting(player, map);
        this.checkStuck();
    }

    // НОВЫЙ МЕТОД: Поведение защиты базы
    baseAttackBehavior(map, otherTanks, brickFragments) {
        // ПРОСТО ЕЗДИМ СЛУЧАЙНО В ПРЕДЕЛАХ ЗОНЫ
        this.tank.currentDirectionTime++;

        // Двигаемся в текущем направлении
        const canMove = this.tank.move(this.tank.direction, map, otherTanks, brickFragments);

        // Меняем направление если не можем двигаться или прошло время
        if (!canMove || this.tank.currentDirectionTime >= 45) {
            this.changeRandomDirection();
            this.tank.currentDirectionTime = 0;
            //console.log(`🛡️ ${this.tank.username} патрулирует базу`);
        }
    }

    // Метод для движения к зоне базы
    moveToBaseZone(baseZone, map, otherTanks, brickFragments) {
        const currentZone = this.getCurrentZone();

        // Определяем направление к базе
        const dx = baseZone.x - currentZone.x;
        const dy = baseZone.y - currentZone.y;

        let targetDirection;

        if (Math.abs(dx) > Math.abs(dy)) {
            targetDirection = dx > 0 ? DIRECTIONS.RIGHT : DIRECTIONS.LEFT;
        } else {
            targetDirection = dy > 0 ? DIRECTIONS.DOWN : DIRECTIONS.UP;
        }

        // Пытаемся двигаться к базе
        if (this.tank.move(targetDirection, map, otherTanks, brickFragments)) {
            this.tank.direction = targetDirection;
        } else {
            // Если не можем - пробуем другое направление
            this.changeRandomDirection();
        }
    }

    // Метод для патрулирования вокруг базы
    patrolAroundBase(baseZone, map, otherTanks, brickFragments) {
        this.tank.currentDirectionTime++;

        // Смена направления каждые 2 секунды или при столкновении
        if (this.tank.currentDirectionTime >= 60 ||
            !this.tank.move(this.tank.direction, map, otherTanks, brickFragments)) {

            // Выбираем направление для патрулирования вокруг базы
            this.chooseBasePatrolDirection(baseZone);
        this.tank.currentDirectionTime = 0;
            }
    }

    // Метод для выбора направления патрулирования вокруг базы
    // УПРОЩЕННЫЙ МЕТОД: Двигаемся как обычно, но не покидаем зону базы
    chooseBasePatrolDirection(baseZone) {
        const currentZone = this.getCurrentZone();

        // Пробуем все направления и выбираем то, которое НЕ выводит из зоны базы
        const directions = [DIRECTIONS.UP, DIRECTIONS.DOWN, DIRECTIONS.LEFT, DIRECTIONS.RIGHT];
        let safeDirections = [];

        for (const direction of directions) {
            const directionVector = new Vector2(direction.x, direction.y);
            const testPos = this.tank.position.add(directionVector.multiply(this.tank.size * 2));
            const testZone = game.getZoneId(testPos.x, testPos.y);

            // Проверяем остаемся ли мы в зоне базы
            const distanceToBase = Math.max(
                Math.abs(testZone.x - baseZone.x),
                                            Math.abs(testZone.y - baseZone.y)
            );

            if (distanceToBase <= 2) { // Остаемся в радиусе 2 зон от базы
                safeDirections.push(direction);
            }
        }

        // Если есть безопасные направления - выбираем из них
        if (safeDirections.length > 0) {
            this.tank.direction = safeDirections[Math.floor(Math.random() * safeDirections.length)];
        } else {
            // Если все направления ведут из зоны - выбираем направление К базе
            const dx = baseZone.x - currentZone.x;
            const dy = baseZone.y - currentZone.y;

            if (Math.abs(dx) > Math.abs(dy)) {
                this.tank.direction = dx > 0 ? DIRECTIONS.RIGHT : DIRECTIONS.LEFT;
            } else {
                this.tank.direction = dy > 0 ? DIRECTIONS.DOWN : DIRECTIONS.UP;
            }
        }
    }

    // НОВЫЙ МЕТОД: Умная смена направления с учетом памяти пути
    changeSmartDirection(map, otherTanks, brickFragments) {
        const directions = Object.values(DIRECTIONS);
        let bestDirection = this.tank.direction;
        let bestScore = -9999;

        for (const direction of directions) {
            let score = this.evaluateDirectionWithMemory(direction, map, otherTanks);

            if (score > bestScore) {
                bestScore = score;
                bestDirection = direction;
            }
        }

        // Меняем направление только если значительно лучше
        if (bestDirection !== this.tank.direction && bestScore > -500) {
            this.tank.direction = bestDirection;
            this.logAction(`умная смена направления на ${this.getDirectionName(bestDirection)} (оценка: ${Math.round(bestScore)})`);
        } else {
            // Или случайным образом для разнообразия
            this.changeRandomDirection();
        }
    }

    // НОВЫЙ МЕТОД: Оценка направления с учетом памяти пути
    evaluateDirection(direction, targetPosition, map, otherTanks) {
        let score = 0;

        const directionVector = new Vector2(direction.x, direction.y);
        // ПЕРЕИМЕНОВЫВАЕМ переменную чтобы избежать конфликта
        const testPosition = this.tank.position.add(directionVector.multiply(this.tank.size * 2));

        const distanceToTarget = this.getDistanceTo(targetPosition);
        const distanceFromTestPos = this.getDistanceFromTo(testPosition, targetPosition);

        // ОСНОВНАЯ ОЦЕНКА: движение к цели
        if (distanceFromTestPos < distanceToTarget) {
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
            testPosition.x - this.tank.size/2 + 2,
            testPosition.y - this.tank.size/2 + 2,
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

        // НОВОЕ: Бонус за движение к зоне цели
        const targetZone = game.getZoneId(targetPosition.x, targetPosition.y);
        const testZone = game.getZoneId(testPosition.x, testPosition.y);

        if (testZone.x === targetZone.x && testZone.y === targetZone.y) {
            score += 200; // Большой бонус за движение в нужную зону
        }

        // МИНИМАЛЬНАЯ случайность
        score += Math.random() * 10;

        return score;
    }

    // ДОБАВЬ ЭТОТ МЕТОД - он отсутствовал!
    evaluateDirectionWithMemory(direction, map, otherTanks) {
        let score = 0;

        const directionVector = new Vector2(direction.x, direction.y);
        const testPosition = this.tank.position.add(directionVector.multiply(this.tank.size * 2));

        // ШТРАФ за недавно посещенные позиции
        const positionPenalty = this.tank.getPositionPenalty(testPosition.x, testPosition.y);
        score -= positionPenalty;

        // БОНУС за новое направление (избегаем повторений)
        if (direction !== this.tank.direction) {
            score += 100;
        }

        // ШТРАФ за столкновения
        const testBounds = new Rectangle(
            testPosition.x - this.tank.size/2 + 2,
            testPosition.y - this.tank.size/2 + 2,
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

        // БОНУС за движение к центру карты (чтобы не застревать у границ)
        const centerX = CANVAS_WIDTH / 2;
        const centerY = CANVAS_HEIGHT / 2;
        const currentDistance = Math.sqrt(
            Math.pow(this.tank.position.x - centerX, 2) +
            Math.pow(this.tank.position.y - centerY, 2)
        );
        const newDistance = Math.sqrt(
            Math.pow(testPosition.x - centerX, 2) +
            Math.pow(testPosition.y - centerY, 2)
        );

        if (newDistance < currentDistance) {
            score += 50;
        }

        // БОНУС за движение к случайной точке (для исследования)
        if (!this.explorationTarget) {
            this.explorationTarget = this.getRandomExplorationTarget();
        }

        const distanceToExploration = Math.sqrt(
            Math.pow(testPosition.x - this.explorationTarget.x, 2) +
            Math.pow(testPosition.y - this.explorationTarget.y, 2)
        );
        const currentDistanceToExploration = Math.sqrt(
            Math.pow(this.tank.position.x - this.explorationTarget.x, 2) +
            Math.pow(this.tank.position.y - this.explorationTarget.y, 2)
        );

        if (distanceToExploration < currentDistanceToExploration) {
            score += 30;
        }

        // Случайность для разнообразия
        score += Math.random() * 30;

        return score;
    }

    // Вспомогательный метод для получения случайной точки исследования
    getRandomExplorationTarget() {
        return {
            x: Math.random() * (CANVAS_WIDTH - 100) + 50,
            y: Math.random() * (CANVAS_HEIGHT - 100) + 50
        };
    }

    // УПРОЩАЕМ метод стрельбы (оставляем без изменений)
    updateShooting(player, map) {
        if (!this.tank.canShoot || this.tank.isFrozen) return;

        let shootChance = SHOOT_CHANCES[this.tank.enemyType] || 0.02;

        if (this.tank.baseAttackMode) {
            shootChance *= 3;
        }

        if (Math.random() < shootChance) {
            let bullet;

            if (this.tank.baseAttackMode) {
                const baseDirection = this.tank.getBaseShootDirection();
                if (baseDirection) {
                    //console.log(`🎯 ${this.tank.username} стреляет по базе!`);
                    bullet = this.tank.shoot();
                    if (bullet) {
                        bullet.direction = baseDirection;
                    }
                }
            }

            if (!bullet) {
                bullet = this.tank.shoot();
                ////console.log(`🔫 ${this.tank.username} делает выстрел`);
            }

            if (bullet && typeof game !== 'undefined') {
                game.bullets.push(bullet);
                game.soundManager.playEnemyShot(this.tank.enemyType);
                this.tank.recordShot();
                game.saveEnemyStatsToStorage(this.tank);
            }
            this.tank.canShoot = false;
            this.tank.reloadTime = this.getReloadTime();
        }
    }

    // Переключатель визуализации памяти (для дебага)
    toggleMemoryVisualization() {
        this.debugShowMemory = !this.debugShowMemory;
        //console.log(`🎯 ${this.tank.username} визуализация памяти: ${this.debugShowMemory ? 'ВКЛ' : 'ВЫКЛ'}`);
    }

    // Метод для проверки, находится ли враг в зоне атаки базы ИГРОКА
    isInPlayerBaseZone() {
        const zone = this.getCurrentZone();
        const baseZone = game.getBaseZone();
        const protectedRadius = game.BASE_ZONE_SYSTEM.PROTECTED_RADIUS;

        const distance = Math.max(
            Math.abs(zone.x - baseZone.x),
                                  Math.abs(zone.y - baseZone.y)
        );

        return distance <= protectedRadius;
    }

    // Метод для получения приоритета атаки базы ИГРОКА
    getBaseAttackPriority() {
        const baseZone = game.getBaseZone();
        const currentZone = this.getCurrentZone();

        const distance = Math.max(
            Math.abs(currentZone.x - baseZone.x),
                                  Math.abs(currentZone.y - baseZone.y)
        );

        if (distance > game.BASE_ZONE_SYSTEM.PROTECTED_RADIUS) return 0;

        // Чем ближе к базе ИГРОКА - тем выше приоритет атаки
        return game.BASE_ZONE_SYSTEM.PROTECTED_RADIUS - distance + 1;
    }
}
