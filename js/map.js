// === КЛАСС КАРТЫ ===
class GameMap {
    constructor(level = 1) {
        this.tileSize = TILE_SIZE;
        this.width = Math.floor(CANVAS_WIDTH / TILE_SIZE);
        this.height = Math.floor(CANVAS_HEIGHT / TILE_SIZE);

        if (typeof BrickTile === 'undefined') {
            this.grid = Array(this.height).fill().map(() => Array(this.width).fill(0));
            this.brickTiles = new Map();
            this.basePosition = new Vector2(0, 0);
            this.baseDestroyed = false;
            return;
        }

        this.grid = this.generateProceduralLevel(level);
        this.brickTiles = new Map();
        this.basePosition = new Vector2(Math.floor(this.width / 2), this.height - 2);
        this.baseDestroyed = false;
        this.grassImage = this.createNaturalGrassTexture();
        this.grassImageLoaded = true;
        this.initializeBrickTiles();
    }

    createNaturalGrassTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = TILE_SIZE;
        canvas.height = TILE_SIZE;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, TILE_SIZE, TILE_SIZE);

        const pixelSize = TILE_SIZE / 8;
        const grassColors = ['#00A000', '#008800', '#006600', '#00CC00'];
        const targetPixels = Math.floor(64 * 0.7);

        for (let i = 0; i < targetPixels; i++) {
            const x = Math.floor(Math.random() * 8);
            const y = Math.floor(Math.random() * 8);
            const color = grassColors[Math.floor(Math.random() * grassColors.length)];
            ctx.fillStyle = color;
            ctx.fillRect(x * pixelSize, y * pixelSize, pixelSize, pixelSize);
        }

        return canvas;
    }

    initializeBrickTiles() {
        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                if (this.grid[y][x] === TILE_TYPES.BRICK) {
                    this.brickTiles.set(`${x},${y}`, new BrickTile(x, y));
                }
            }
        }
    }

    generateProceduralLevel(level) {
        const grid = Array(this.height).fill().map(() => Array(this.width).fill(TILE_TYPES.EMPTY));

        // Создаем границы
        this.createBoundaries(grid);

        // Определяем зоны спавна
        const spawnAreas = this.defineSpawnAreas();

        // Защищаем зоны спавна
        this.protectSpawnAreas(grid, spawnAreas);

        // Создаем защиту базы
        this.createBaseDefense(grid);

        // Генерируем различные типы препятствий
        this.generateObstacles(grid, level, spawnAreas);

        // Добавляем специальные структуры
        this.generateSpecialStructures(grid, level);

        return grid;
    }

    createBoundaries(grid) {
        // Внешние границы из бетона
        for (let i = 0; i < this.width; i++) {
            grid[0][i] = TILE_TYPES.CONCRETE;
            grid[this.height-1][i] = TILE_TYPES.CONCRETE;
        }
        for (let i = 0; i < this.height; i++) {
            grid[i][0] = TILE_TYPES.CONCRETE;
            grid[i][this.width-1] = TILE_TYPES.CONCRETE;
        }
    }

    defineSpawnAreas() {
        const playerSpawnArea = [];
        const enemySpawnAreas = [];

        // Зона спавна игрока (нижняя центральная часть)
        for (let y = this.height - 6; y < this.height - 2; y++) {
            for (let x = Math.floor(this.width/2) - 3; x <= Math.floor(this.width/2) + 2; x++) {
                if (x >= 0 && x < this.width && y >= 0 && y < this.height) {
                    playerSpawnArea.push([x, y]);
                }
            }
        }

        // Зоны спавна врагов (верхняя часть)
        const enemySpawnCount = 3 + Math.min(2, Math.floor(level / 3));
        for (let i = 0; i < enemySpawnCount; i++) {
            const areaWidth = 4;
            const areaHeight = 3;
            const x = Math.floor(i * (this.width - areaWidth) / (enemySpawnCount - 1));
            const y = 1;

            for (let dy = 0; dy < areaHeight; dy++) {
                for (let dx = 0; dx < areaWidth; dx++) {
                    if (x + dx < this.width && y + dy < this.height) {
                        enemySpawnAreas.push([x + dx, y + dy]);
                    }
                }
            }
        }

        return {
            playerSpawnArea,
            enemySpawnAreas,
            allSpawnAreas: [...playerSpawnArea, ...enemySpawnAreas.flat()]
        };
    }

    protectSpawnAreas(grid, spawnAreas) {
        spawnAreas.allSpawnAreas.forEach(([x, y]) => {
            if (x >= 0 && x < this.width && y >= 0 && y < this.height) {
                grid[y][x] = TILE_TYPES.EMPTY;
            }
        });
    }

    createBaseDefense(grid) {
        const baseX = Math.floor(this.width / 2);
        const baseY = this.height - 2;

        // Очищаем область вокруг базы
        for (let dx = -2; dx <= 2; dx++) {
            for (let dy = -2; dy <= 2; dy++) {
                const x = baseX + dx, y = baseY + dy;
                if (x >= 0 && x < this.width && y >= 0 && y < this.height) {
                    grid[y][x] = TILE_TYPES.EMPTY;
                }
            }
        }

        // Создаем защитные стены вокруг базы
        const defensePatterns = [
            // Паттерн 1: Крестообразная защита
            [
                [baseX-2, baseY-2], [baseX-1, baseY-2], [baseX, baseY-2], [baseX+1, baseY-2], [baseX+2, baseY-2],
                [baseX-2, baseY-1], [baseX+2, baseY-1],
                [baseX-2, baseY], [baseX+2, baseY],
                [baseX-2, baseY+1], [baseX+2, baseY+1],
                [baseX-2, baseY+2], [baseX-1, baseY+2], [baseX, baseY+2], [baseX+1, baseY+2], [baseX+2, baseY+2]
            ],
            // Паттерн 2: Угловая защита
            [
                [baseX-2, baseY-2], [baseX-1, baseY-2], [baseX, baseY-2], [baseX+1, baseY-2], [baseX+2, baseY-2],
                [baseX-2, baseY-1], [baseX-2, baseY], [baseX-2, baseY+1], [baseX-2, baseY+2],
                [baseX+2, baseY-1], [baseX+2, baseY], [baseX+2, baseY+1], [baseX+2, baseY+2],
                [baseX-1, baseY+2], [baseX, baseY+2], [baseX+1, baseY+2]
            ],
            // Паттерн 3: Полная защита с проходами
            [
                [baseX-2, baseY-2], [baseX-1, baseY-2], [baseX, baseY-2], [baseX+1, baseY-2], [baseX+2, baseY-2],
                [baseX-2, baseY-1], [baseX+2, baseY-1],
                [baseX-2, baseY], [baseX+2, baseY],
                [baseX-2, baseY+1], [baseX+2, baseY+1],
                [baseX-1, baseY+2], [baseX+1, baseY+2]
            ]
        ];

        const pattern = defensePatterns[Math.floor(Math.random() * defensePatterns.length)];
        pattern.forEach(([x, y]) => {
            if (x >= 0 && x < this.width && y >= 0 && y < this.height) {
                grid[y][x] = TILE_TYPES.BRICK;
            }
        });

        // Устанавливаем базу
        grid[baseY][baseX] = TILE_TYPES.BASE;
    }

    generateObstacles(grid, level, spawnAreas) {
        const obstacleCount = 15 + level * 2;
        const maxAttempts = obstacleCount * 10;
        let attempts = 0;
        let placed = 0;

        while (placed < obstacleCount && attempts < maxAttempts) {
            attempts++;

            // Выбираем случайный тип препятствия с весами
            const rand = Math.random();
            let obstacleType;
            if (rand < 0.4) obstacleType = TILE_TYPES.BRICK;      // 40% кирпичи
            else if (rand < 0.65) obstacleType = TILE_TYPES.GRASS; // 25% трава
            else if (rand < 0.85) obstacleType = TILE_TYPES.WATER; // 20% вода
            else obstacleType = TILE_TYPES.CONCRETE;              // 15% бетон

            // Выбираем размер препятствия
            const size = Math.random() < 0.7 ? 1 : (Math.random() < 0.5 ? 2 : 3);

            // Выбираем позицию
            const x = Math.floor(Math.random() * (this.width - size - 4)) + 2;
            const y = Math.floor(Math.random() * (this.height - size - 8)) + 4;

            // Проверяем, можно ли разместить здесь препятствие
            if (this.canPlaceObstacle(grid, x, y, size, spawnAreas.allSpawnAreas)) {
                this.placeObstacle(grid, x, y, size, obstacleType);
                placed++;
            }
        }

        // Добавляем дополнительные препятствия на поздних уровнях
        if (level > 3) {
            this.addChallengeObstacles(grid, level, spawnAreas.allSpawnAreas);
        }
    }

    canPlaceObstacle(grid, x, y, size, allSpawnAreas) {
        // Проверяем, не пересекается ли с зонами спавна
        for (let dy = 0; dy < size; dy++) {
            for (let dx = 0; dx < size; dx++) {
                const checkX = x + dx;
                const checkY = y + dy;

                // Проверяем границы
                if (checkX >= this.width - 1 || checkY >= this.height - 1) {
                    return false;
                }

                // Проверяем зоны спавна
                const inSpawnArea = allSpawnAreas.some(([sx, sy]) => checkX === sx && checkY === sy);
                if (inSpawnArea) {
                    return false;
                }

                // Проверяем, не занята ли уже клетка
                if (grid[checkY][checkX] !== TILE_TYPES.EMPTY) {
                    return false;
                }

                // Проверяем, чтобы не блокировал проходы к базе (особенно снизу)
                if (checkY > this.height - 8 && Math.abs(checkX - Math.floor(this.width/2)) < 3) {
                    return false;
                }
            }
        }
        return true;
    }

    placeObstacle(grid, x, y, size, type) {
        for (let dy = 0; dy < size; dy++) {
            for (let dx = 0; dx < size; dx++) {
                if (x + dx < this.width - 1 && y + dy < this.height - 1) {
                    grid[y + dy][x + dx] = type;
                }
            }
        }

        // Для больших препятствий добавляем вариативность
        if (size > 1 && Math.random() < 0.3) {
            this.varyLargeObstacle(grid, x, y, size, type);
        }
    }

    varyLargeObstacle(grid, x, y, size, baseType) {
        // Случайным образом меняем некоторые клетки большого препятствия
        const variationCount = Math.floor(size * size * 0.3);
        const variations = [TILE_TYPES.EMPTY, TILE_TYPES.GRASS, baseType];
        const weights = baseType === TILE_TYPES.BRICK ? [0.1, 0.2, 0.7] : [0.05, 0.15, 0.8];

        for (let i = 0; i < variationCount; i++) {
            const varX = x + Math.floor(Math.random() * size);
            const varY = y + Math.floor(Math.random() * size);
            const rand = Math.random();
            let newType = baseType;

            if (rand < weights[0]) newType = variations[0];
            else if (rand < weights[0] + weights[1]) newType = variations[1];

            if (varX < this.width - 1 && varY < this.height - 1) {
                grid[varY][varX] = newType;
            }
        }
    }

    addChallengeObstacles(grid, level, allSpawnAreas) {
        // Добавляем сложные препятствия на высоких уровнях
        const challengeCount = Math.floor(level / 2);

        for (let i = 0; i < challengeCount; i++) {
            const patternType = Math.floor(Math.random() * 3);

            switch (patternType) {
                case 0: // Лабиринтные стены
                    this.createMazePattern(grid, allSpawnAreas);
                    break;
                case 1: // Водные преграды
                    this.createWaterBarrier(grid, allSpawnAreas);
                    break;
                case 2: // Бетонные укрепления
                    this.createConcreteFortification(grid, allSpawnAreas);
                    break;
            }
        }
    }

    createMazePattern(grid, allSpawnAreas) {
        const mazeWidth = 5 + Math.floor(Math.random() * 3);
        const mazeHeight = 4 + Math.floor(Math.random() * 3);
        const startX = Math.floor(Math.random() * (this.width - mazeWidth - 4)) + 2;
        const startY = Math.floor(Math.random() * (this.height - mazeHeight - 8)) + 4;

        // Простой алгоритм создания лабиринта
        for (let y = 0; y < mazeHeight; y++) {
            for (let x = 0; x < mazeWidth; x++) {
                const worldX = startX + x;
                const worldY = startY + y;

                // Создаем стены с шансом 60%, но оставляем проходы
                if (worldX < this.width - 1 && worldY < this.height - 1) {
                    const inSpawn = allSpawnAreas.some(([sx, sy]) => worldX === sx && worldY === sy);
                    if (!inSpawn && grid[worldY][worldX] === TILE_TYPES.EMPTY) {
                        // Создаем узор: чередуем стены и проходы
                        if ((x % 2 === 0 && y % 2 === 1) || (x % 2 === 1 && y % 2 === 0)) {
                            if (Math.random() < 0.6) {
                                grid[worldY][worldX] = TILE_TYPES.BRICK;
                            }
                        }
                    }
                }
            }
        }
    }

    createWaterBarrier(grid, allSpawnAreas) {
        const barrierLength = 3 + Math.floor(Math.random() * 4);
        const isHorizontal = Math.random() < 0.5;
        const startX = Math.floor(Math.random() * (this.width - barrierLength - 4)) + 2;
        const startY = Math.floor(Math.random() * (this.height - barrierLength - 8)) + 4;

        for (let i = 0; i < barrierLength; i++) {
            const x = isHorizontal ? startX + i : startX;
            const y = isHorizontal ? startY : startY + i;

            if (x < this.width - 1 && y < this.height - 1) {
                const inSpawn = allSpawnAreas.some(([sx, sy]) => x === sx && y === sy);
                if (!inSpawn && grid[y][x] === TILE_TYPES.EMPTY) {
                    grid[y][x] = TILE_TYPES.WATER;
                }
            }
        }
    }

    createConcreteFortification(grid, allSpawnAreas) {
        const fortSize = 2 + Math.floor(Math.random() * 2);
        const startX = Math.floor(Math.random() * (this.width - fortSize - 4)) + 2;
        const startY = Math.floor(Math.random() * (this.height - fortSize - 8)) + 4;

        for (let y = 0; y < fortSize; y++) {
            for (let x = 0; x < fortSize; x++) {
                const worldX = startX + x;
                const worldY = startY + y;

                if (worldX < this.width - 1 && worldY < this.height - 1) {
                    const inSpawn = allSpawnAreas.some(([sx, sy]) => worldX === sx && worldY === sy);
                    if (!inSpawn && grid[worldY][worldX] === TILE_TYPES.EMPTY) {
                        grid[worldY][worldX] = TILE_TYPES.CONCRETE;
                    }
                }
            }
        }
    }

    generateSpecialStructures(grid, level) {
        // Добавляем специальные структуры на средних и высоких уровнях
        if (level >= 2) {
            const structureCount = 1 + Math.floor(level / 3);

            for (let i = 0; i < structureCount; i++) {
                const structureType = Math.floor(Math.random() * 2);

                switch (structureType) {
                    case 0: // Кирпичные крепости
                        this.createBrickFortress(grid);
                        break;
                    case 1: // Смешанные укрепления
                        this.createMixedFortification(grid);
                        break;
                }
            }
        }
    }

    createBrickFortress(grid) {
        const fortressWidth = 4;
        const fortressHeight = 3;
        const startX = Math.floor(Math.random() * (this.width - fortressWidth - 4)) + 2;
        const startY = Math.floor(Math.random() * (this.height - fortressHeight - 8)) + 4;

        // Создаем U-образную структуру
        for (let y = 0; y < fortressHeight; y++) {
            for (let x = 0; x < fortressWidth; x++) {
                // Создаем стены по краям, оставляя центр пустым
                if (y === 0 || y === fortressHeight - 1 || x === 0 || x === fortressWidth - 1) {
                    const worldX = startX + x;
                    const worldY = startY + y;

                    if (worldX < this.width - 1 && worldY < this.height - 1 &&
                        grid[worldY][worldX] === TILE_TYPES.EMPTY) {
                        grid[worldY][worldX] = TILE_TYPES.BRICK;
                        }
                }
            }
        }
    }

    createMixedFortification(grid) {
        const size = 3;
        const startX = Math.floor(Math.random() * (this.width - size - 4)) + 2;
        const startY = Math.floor(Math.random() * (this.height - size - 8)) + 4;
        const materials = [TILE_TYPES.BRICK, TILE_TYPES.CONCRETE];

        for (let y = 0; y < size; y++) {
            for (let x = 0; x < size; x++) {
                const worldX = startX + x;
                const worldY = startY + y;

                if (worldX < this.width - 1 && worldY < this.height - 1 &&
                    grid[worldY][worldX] === TILE_TYPES.EMPTY) {
                    // Чередуем материалы для создания прочной структуры
                    const material = materials[(x + y) % 2];
                grid[worldY][worldX] = material;
                    }
            }
        }
    }

    // Остальные методы класса остаются без изменений
    checkBoundaryCollision(rect) {
        return rect.x < TILE_SIZE || rect.x + rect.width > CANVAS_WIDTH - TILE_SIZE ||
        rect.y < TILE_SIZE || rect.y + rect.height > CANVAS_HEIGHT - TILE_SIZE;
    }

    checkCollision(rect) {
        if (this.checkBoundaryCollision(rect)) return true;

        const startX = Math.max(0, Math.floor(rect.x / this.tileSize));
        const startY = Math.max(0, Math.floor(rect.y / this.tileSize));
        const endX = Math.min(this.width-1, Math.floor((rect.x + rect.width) / this.tileSize));
        const endY = Math.min(this.height-1, Math.floor((rect.y + rect.height) / this.tileSize));

        for (let y = startY; y <= endY; y++) {
            for (let x = startX; x <= endX; x++) {
                const tile = this.grid[y][x];
                if (tile === TILE_TYPES.WATER || tile === TILE_TYPES.BASE || tile === TILE_TYPES.CONCRETE) {
                    const tileRect = new Rectangle(x * this.tileSize, y * this.tileSize, this.tileSize, this.tileSize);
                    if (rect.intersects(tileRect)) return true;
                } else if (tile === TILE_TYPES.BRICK) {
                    const key = `${x},${y}`;
                    if (this.brickTiles.has(key)) {
                        const brickTile = this.brickTiles.get(key);
                        if (!brickTile.isDestroyed) {
                            const tileRect = new Rectangle(x * this.tileSize, y * this.tileSize, this.tileSize, this.tileSize);
                            if (rect.intersects(tileRect)) return true;
                        } else {
                            for (const fragment of brickTile.fragments) {
                                if (fragment.active && fragment.collisionEnabled && rect.intersects(fragment.getBounds())) {
                                    return true;
                                }
                            }
                        }
                    }
                }
            }
        }
        return false;
    }

    checkBulletCollision(bullet) {
        const bulletBounds = bullet.getBounds();

        // ПЕРВОЕ: проверяем фрагменты кирпичей (они могут быть где угодно)
        for (let [key, brickTile] of this.brickTiles) {
            if (brickTile.isDestroyed && brickTile.hasFragments()) {
                if (brickTile.checkFragmentCollision(bulletBounds)) {
                    return 'brick';
                }
            }
        }

        // ВТОРОЕ: проверяем обычные тайлы по сетке
        const startX = Math.max(0, Math.floor(bulletBounds.x / this.tileSize));
        const startY = Math.max(0, Math.floor(bulletBounds.y / this.tileSize));
        const endX = Math.min(this.width-1, Math.floor((bulletBounds.x + bulletBounds.width) / this.tileSize));
        const endY = Math.min(this.height-1, Math.floor((bulletBounds.y + bulletBounds.height) / this.tileSize));

        for (let y = startY; y <= endY; y++) {
            for (let x = startX; x <= endX; x++) {
                const tile = this.grid[y][x];

                if (y === this.height - 1) {
                    const tileRect = new Rectangle(x * this.tileSize, y * this.tileSize, this.tileSize, this.tileSize);
                    if (bulletBounds.intersects(tileRect)) return 'concrete';
                }

                if (tile === TILE_TYPES.BASE) {
                    this.grid[y][x] = TILE_TYPES.EMPTY;
                    if (bullet.owner === 'enemy' && bullet.shooter) {
                        bullet.shooter.recordBaseDestroyed();
                        if (typeof game !== 'undefined') game.saveEnemyStatsToStorage(bullet.shooter);
                    }
                    this.checkBaseDestruction();
                    return 'base';
                } else if (tile === TILE_TYPES.CONCRETE) {
                    return 'concrete';
                } else if (tile === TILE_TYPES.BRICK) {
                    const key = `${x},${y}`;
                    if (this.brickTiles.has(key)) {
                        const brickTile = this.brickTiles.get(key);
                        if (!brickTile.isDestroyed && brickTile.checkBulletCollision(bullet)) {
                            if (bullet.owner === 'enemy' && bullet.shooter) {
                                bullet.shooter.recordWallDestroyed();
                                if (typeof game !== 'undefined') game.saveEnemyStatsToStorage(bullet.shooter);
                            } else if(bullet.owner !== 'enemy' && bullet.shooter) {
                                if (typeof game !== 'undefined') game.recordBlockDestroyed(1);
                            }

                            if (brickTile.takeDamage()) {
                                if (typeof game !== 'undefined' && game.soundManager) {
                                    game.soundManager.play('brickDestroy');
                                }
                                if (!brickTile.hasFragments()) {
                                    this.grid[y][x] = TILE_TYPES.EMPTY;
                                    this.brickTiles.delete(key);
                                }
                            }
                            return 'brick';
                        }
                    }
                }
            }
        }
        return false;
    }

    checkBaseDestruction() {
        const baseX = Math.floor(this.width / 2);
        const baseY = this.height - 2;
        if (this.grid[baseY][baseX] !== TILE_TYPES.BASE) {
            this.baseDestroyed = true;
        }
    }

    isBaseDestroyed() { return this.baseDestroyed; }

    update(allTanks = []) {
        this.brickTiles.forEach(brick => brick.update(allTanks));
    }

    draw(ctx) {
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

        // Границы
        ctx.fillStyle = '#FFFFFF';
        for (let i = 0; i < this.width; i++) {
            ctx.fillRect(i * TILE_SIZE, 0, TILE_SIZE, TILE_SIZE);
            ctx.fillRect(i * TILE_SIZE, (this.height-1) * TILE_SIZE, TILE_SIZE, TILE_SIZE);
        }
        for (let i = 0; i < this.height; i++) {
            ctx.fillRect(0, i * TILE_SIZE, TILE_SIZE, TILE_SIZE);
            ctx.fillRect((this.width-1) * TILE_SIZE, i * TILE_SIZE, TILE_SIZE, TILE_SIZE);
        }

        // Тайлы
        for (let y = 1; y < this.height - 1; y++) {
            for (let x = 1; x < this.width - 1; x++) {
                const tile = this.grid[y][x];
                const tileX = x * this.tileSize;
                const tileY = y * this.tileSize;

                switch(tile) {
                    case TILE_TYPES.BRICK:
                        const key = `${x},${y}`;
                        if (this.brickTiles.has(key)) this.brickTiles.get(key).draw(ctx);
                        break;
                    case TILE_TYPES.WATER:
                        ctx.fillStyle = '#1E90FF';
                        ctx.fillRect(tileX, tileY, this.tileSize, this.tileSize);
                        ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
                        const waveTime = Date.now() * 0.002;
                        const waveOffset = Math.sin(waveTime + x * 0.5 + y * 0.3) * 2;
                        ctx.fillRect(tileX, tileY + waveOffset, this.tileSize, this.tileSize / 3);
                        break;
                    case TILE_TYPES.BASE:
                        ctx.fillStyle = '#FFD700';
                        ctx.fillRect(tileX, tileY, this.tileSize, this.tileSize);
                        ctx.fillStyle = '#000';
                        ctx.font = '20px Arial';
                        ctx.textAlign = 'center';
                        ctx.fillText('★', tileX + this.tileSize/2, tileY + this.tileSize/2 + 7);
                        break;
                    case TILE_TYPES.CONCRETE:
                        ctx.fillStyle = '#FFFFFF';
                        ctx.fillRect(tileX, tileY, this.tileSize, this.tileSize);
                        ctx.strokeStyle = '#CCCCCC';
                        ctx.lineWidth = 1;
                        ctx.strokeRect(tileX, tileY, this.tileSize, this.tileSize);

                        ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
                        ctx.beginPath();
                        ctx.moveTo(tileX, tileY);
                        ctx.lineTo(tileX + this.tileSize, tileY);
                        ctx.lineTo(tileX, tileY + this.tileSize);
                        ctx.fill();

                        ctx.fillStyle = 'rgba(200, 200, 200, 0.2)';
                        for (let i = 0; i < 3; i++) {
                            for (let j = 0; j < 3; j++) {
                                if ((i + j) % 2 === 0) {
                                    ctx.fillRect(tileX + i * this.tileSize/3 + 2, tileY + j * this.tileSize/3 + 2, this.tileSize/4, this.tileSize/4);
                                }
                            }
                        }
                        break;
                }
            }
        }
    }

    drawGrassOverlay(ctx) {
        if (!this.grassImageLoaded) return;
        for (let y = 1; y < this.height - 1; y++) {
            for (let x = 1; x < this.width - 1; x++) {
                if (this.grid[y][x] === TILE_TYPES.GRASS) {
                    const tileX = x * this.tileSize;
                    const tileY = y * this.tileSize;
                    ctx.drawImage(this.grassImage, tileX, tileY, TILE_SIZE, TILE_SIZE);
                }
            }
        }
    }
}
