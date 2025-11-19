class EnemyAI {
    constructor(tank) {
        this.tank = tank;
        this.state = 'PATROL';
        this.stuckCounter = 0;
        this.lastPosition = tank.position.clone();
        this.lastLogTime = 0;
    }

    update(map, player, otherTanks, brickFragments) {
        if (this.tank.isFrozen) return;

        if (this.tank.patrolState === 'MOVING') {
            this.tank.currentDirectionTime++;
            const canMove = this.tank.move(this.tank.direction, map, otherTanks, brickFragments);

            if (!canMove || this.tank.currentDirectionTime >= this.tank.maxDirectionTime) {
                this.changeSmartDirection(map, otherTanks);
                this.tank.currentDirectionTime = 0;
            }
        }

        this.updateShooting(player, map);
        this.checkStuck();
    }

    changeSmartDirection(map, otherTanks) {
        const directions = Object.values(DIRECTIONS);
        let bestDirection = this.tank.direction;
        let bestScore = -9999;

        for (const direction of directions) {
            const score = this.evaluateDirection(direction, map, otherTanks);
            if (score > bestScore) {
                bestScore = score;
                bestDirection = direction;
            }
        }

        if (bestDirection !== this.tank.direction && bestScore > -500) {
            this.tank.direction = bestDirection;
        } else {
            this.changeRandomDirection();
        }
    }

    evaluateDirection(direction, map, otherTanks) {
        let score = 0;
        const directionVector = new Vector2(direction.x, direction.y);
        const testPosition = this.tank.position.add(directionVector.multiply(this.tank.size * 2));

        // Position memory penalty
        score -= this.tank.getPositionPenalty?.(testPosition.x, testPosition.y) || 0;

        // Bonus for new direction
        if (direction !== this.tank.direction) score += 100;

        // Collision checks
        const testBounds = new Rectangle(testPosition.x - this.tank.size/2 + 2, testPosition.y - this.tank.size/2 + 2, this.tank.size - 4, this.tank.size - 4);

        if (map.checkCollision(testBounds)) score -= 1000;
        if (otherTanks?.some(tank => tank !== this.tank && !tank.isDestroyed && testBounds.intersects(tank.getBounds()))) score -= 500;

        // Exploration bonus
        if (!this.explorationTarget) {
            this.explorationTarget = {
                x: Math.random() * (CANVAS_WIDTH - 100) + 50,
                y: Math.random() * (CANVAS_HEIGHT - 100) + 50
            };
        }

        const newDistance = Math.sqrt(Math.pow(testPosition.x - this.explorationTarget.x, 2) + Math.pow(testPosition.y - this.explorationTarget.y, 2));
        const currentDistance = Math.sqrt(Math.pow(this.tank.position.x - this.explorationTarget.x, 2) + Math.pow(this.tank.position.y - this.explorationTarget.y, 2));
        if (newDistance < currentDistance) score += 30;

        return score + Math.random() * 30;
    }

    updateShooting(player, map) {
        if (!this.tank.canShoot || this.tank.isFrozen) return;

        let shootChance = SHOOT_CHANCES[this.tank.enemyType] || 0.02;
        if (this.tank.baseAttackMode) shootChance *= 3;

        if (Math.random() < shootChance) {
            let bullet = null;

            if (this.tank.baseAttackMode) {
                const baseDirection = this.tank.getBaseShootDirection();
                if (baseDirection) {
                    bullet = this.tank.shoot();
                    if (bullet) bullet.direction = baseDirection;
                }
            }

            if (!bullet) bullet = this.tank.shoot();

            if (bullet && game) {
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
        return this.tank.enemyType === 'FAST' ? 25 : this.tank.enemyType === 'HEAVY' ? 60 : 40;
    }

    checkStuck() {
        const distanceMoved = Math.sqrt(Math.pow(this.tank.position.x - this.lastPosition.x, 2) + Math.pow(this.tank.position.y - this.lastPosition.y, 2));

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
        const directions = Object.values(DIRECTIONS).filter(dir => dir !== this.tank.direction);
        this.tank.direction = directions[Math.floor(Math.random() * directions.length)];
    }
}

class BasicEnemyAI extends EnemyAI {
    constructor(tank) {
        super(tank);
        this.debugShowMemory = false;
    }

    update(map, player, otherTanks, brickFragments) {
        if (this.tank.isFrozen) return;

        if (this.tank.patrolState === 'MOVING') {
            this.tank.currentDirectionTime++;
            const canMove = this.tank.move(this.tank.direction, map, otherTanks, brickFragments);

            if (!canMove || this.tank.currentDirectionTime >= this.tank.maxDirectionTime) {
                this.changeSmartDirection(map, otherTanks);
                this.tank.currentDirectionTime = 0;

                if (Math.random() < 0.3) {
                    this.tank.patrolState = 'STOPPED';
                    this.tank.nextStateChangeTime = Date.now() + 1000;
                }
            }
        }

        this.updateShooting(player, map);
        this.checkStuck();
    }
}
