// === КЛАСС КАРТЫ ===
class GameMap {
    constructor(level = 1) {
        if (typeof BrickTile === 'undefined') {
            console.error('BrickTile is not defined!');
            // Создаем заглушку чтобы игра не падала
            this.tileSize = TILE_SIZE;
            this.width = Math.floor(CANVAS_WIDTH / TILE_SIZE);
            this.height = Math.floor(CANVAS_HEIGHT / TILE_SIZE);
            this.grid = Array(this.height).fill().map(() => Array(this.width).fill(0));
            this.brickTiles = new Map();
            this.basePosition = new Vector2(0, 0);
            this.baseDestroyed = false;
            return;
        }
        this.tileSize = TILE_SIZE;
        this.width = Math.floor(CANVAS_WIDTH / TILE_SIZE);
        this.height = Math.floor(CANVAS_HEIGHT / TILE_SIZE);
        this.grid = this.generateLevel(level);
        this.brickTiles = new Map();
        this.basePosition = new Vector2(Math.floor(this.width / 2), this.height - 2);
        this.baseDestroyed = false;

        this.initializeBrickTiles();
    }

    initializeBrickTiles() {
        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                if (this.grid[y][x] === TILE_TYPES.BRICK) {
                    const key = `${x},${y}`;
                    this.brickTiles.set(key, new BrickTile(x, y));
                }
            }
        }
    }

    generateLevel(level) {
        const grid = Array(this.height).fill().map(() => Array(this.width).fill(0));

        // Границы из бетона (непроходимые и непробиваемые)
        for (let i = 0; i < this.width; i++) {
            grid[0][i] = TILE_TYPES.CONCRETE;
            grid[this.height-1][i] = TILE_TYPES.CONCRETE;
        }
        for (let i = 0; i < this.height; i++) {
            grid[i][0] = TILE_TYPES.CONCRETE;
            grid[i][this.width-1] = TILE_TYPES.CONCRETE;
        }

        // Защищаем зоны спавна игрока (левый нижний угол)
        const playerSpawnArea = [
            [6, 22], [7, 22], [8, 22], [9, 22],
            [6, 23], [7, 23], [8, 23], [9, 23],
            [6, 24], [7, 24], [8, 24], [9, 24],
            [6, 25], [7, 25], [8, 25], [9, 25]
        ];

        playerSpawnArea.forEach(([x, y]) => {
            if (x >= 0 && x < this.width && y >= 0 && y < this.height) {
                grid[y][x] = TILE_TYPES.EMPTY;
            }
        });

        // Защищаем зоны спавна врагов
        const enemySpawnAreas = [
            // Центр
            [11, 1], [12, 1], [13, 1], [14, 1],
            [11, 2], [12, 2], [13, 2], [14, 2],
            [11, 3], [12, 3], [13, 3], [14, 3],
            // Право
            [21, 1], [22, 1], [23, 1], [24, 1],
            [21, 2], [22, 2], [23, 2], [24, 2],
            [21, 3], [22, 3], [23, 3], [24, 3],
            // Лево
            [1, 1], [2, 1], [3, 1], [4, 1],
            [1, 2], [2, 2], [3, 2], [4, 2],
            [1, 3], [2, 3], [3, 3], [4, 3]
        ];

        enemySpawnAreas.forEach(([x, y]) => {
            if (x >= 0 && x < this.width && y >= 0 && y < this.height) {
                grid[y][x] = TILE_TYPES.EMPTY;
            }
        });

        // Препятствия
        const obstacleCount = 12 + level * 3;
        for (let i = 0; i < obstacleCount; i++) {
            const x = Math.floor(Math.random() * (this.width - 8)) + 4;
            const y = Math.floor(Math.random() * (this.height - 12)) + 4;

            // Проверяем, не в зоне спавна ли
            let inSpawnArea = false;
            for (const [sx, sy] of playerSpawnArea.concat(enemySpawnAreas)) {
                if (x === sx && y === sy) {
                    inSpawnArea = true;
                    break;
                }
            }

            if (!inSpawnArea && grid[y][x] === TILE_TYPES.EMPTY) {
                // Разные типы препятствий в зависимости от уровня
                const rand = Math.random();
                if (rand < 0.6) grid[y][x] = TILE_TYPES.BRICK;
                else if (rand < 0.8) grid[y][x] = TILE_TYPES.WATER;
                else grid[y][x] = TILE_TYPES.CONCRETE;

                // Создаем небольшие группы из 4 сегментов
                if (Math.random() > 0.4) {
                    const segments = [
                        [x, y], [x+1, y],
                        [x, y+1], [x+1, y+1]
                    ];

                    segments.forEach(([sx, sy]) => {
                        if (sx >= 0 && sx < this.width && sy >= 0 && sy < this.height) {
                            // Проверяем, не в зоне спавна ли
                            let segInSpawnArea = false;
                            for (const [spx, spy] of playerSpawnArea.concat(enemySpawnAreas)) {
                                if (sx === spx && sy === spy) {
                                    segInSpawnArea = true;
                                    break;
                                }
                            }
                            if (!segInSpawnArea && grid[sy][sx] === TILE_TYPES.EMPTY) {
                                grid[sy][sx] = grid[y][x];
                            }
                        }
                    });
                }
            }
        }

        // Защита базы - кирпичные стены вокруг одного блока базы
        const baseX = Math.floor(this.width / 2);
        const baseY = this.height - 2;

        // Очищаем область вокруг базы (3x3)
        for (let dx = -1; dx <= 1; dx++) {
            for (let dy = -1; dy <= 1; dy++) {
                const x = baseX + dx, y = baseY + dy;
                if (x >= 0 && x < this.width && y >= 0 && y < this.height) {
                    grid[y][x] = TILE_TYPES.EMPTY;
                }
            }
        }

        // Создаем кирпичные стены вокруг базы (полный квадрат)
        const wallPositions = [
            // Левая стена
            [baseX - 1, baseY - 1], [baseX - 1, baseY], [baseX - 1, baseY + 1],
            // Правая стена
            [baseX + 1, baseY - 1], [baseX + 1, baseY], [baseX + 1, baseY + 1],
            // Верхняя стена
            [baseX, baseY - 1],
            // Нижняя стена
            [baseX, baseY + 1]
        ];

        wallPositions.forEach(([x, y]) => {
            if (x >= 0 && x < this.width && y >= 0 && y < this.height) {
                grid[y][x] = TILE_TYPES.BRICK;
            }
        });

        // База - один центральный блок
        grid[baseY][baseX] = TILE_TYPES.BASE;

        return grid;
    }

    checkCollision(rect) {
        const startX = Math.max(0, Math.floor(rect.x / this.tileSize));
        const startY = Math.max(0, Math.floor(rect.y / this.tileSize));
        const endX = Math.min(this.width-1, Math.floor((rect.x + rect.width) / this.tileSize));
        const endY = Math.min(this.height-1, Math.floor((rect.y + rect.height) / this.tileSize));

        for (let y = startY; y <= endY; y++) {
            for (let x = startX; x <= endX; x++) {
                const tile = this.grid[y][x];

                // Проверяем столкновение с обычными тайлами
                if (tile === TILE_TYPES.WATER || tile === TILE_TYPES.BASE || tile === TILE_TYPES.CONCRETE) {
                    const tileRect = new Rectangle(
                        x * this.tileSize,
                        y * this.tileSize,
                        this.tileSize,
                        this.tileSize
                    );
                    if (rect.intersects(tileRect)) {
                        return true;
                    }
                }
                // Проверяем столкновение с кирпичами и их осколками
                else if (tile === TILE_TYPES.BRICK) {
                    const key = `${x},${y}`;
                    if (this.brickTiles.has(key)) {
                        const brickTile = this.brickTiles.get(key);

                        if (!brickTile.isDestroyed) {
                            const tileRect = new Rectangle(
                                x * this.tileSize,
                                y * this.tileSize,
                                this.tileSize,
                                this.tileSize
                            );
                            if (rect.intersects(tileRect)) {
                                return true;
                            }
                        } else {
                            // Проверяем столкновение с осколками (только с активными)
                            for (const fragment of brickTile.fragments) {
                                if (fragment.active && rect.intersects(fragment.getBounds())) {
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

        const startX = Math.max(0, Math.floor(bulletBounds.x / this.tileSize));
        const startY = Math.max(0, Math.floor(bulletBounds.y / this.tileSize));
        const endX = Math.min(this.width-1, Math.floor((bulletBounds.x + bulletBounds.width) / this.tileSize));
        const endY = Math.min(this.height-1, Math.floor((bulletBounds.y + bulletBounds.height) / this.tileSize));

        for (let y = startY; y <= endY; y++) {
            for (let x = startX; x <= endX; x++) {
                const tile = this.grid[y][x];

                if (tile === TILE_TYPES.BASE) {
                    this.grid[y][x] = TILE_TYPES.EMPTY;
                    this.checkBaseDestruction();
                    return 'base';
                }
                else if (tile === TILE_TYPES.CONCRETE) {
                    return 'concrete';
                }
                else if (tile === TILE_TYPES.BRICK) {
                    const key = `${x},${y}`;
                    if (this.brickTiles.has(key)) {
                        const brickTile = this.brickTiles.get(key);
                        if (brickTile.checkBulletCollision(bullet)) {
                            if (brickTile.takeDamage()) {
                                // Звук разрушения кирпичной стены
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

        // Проверяем только один блок базы
        if (this.grid[baseY][baseX] !== TILE_TYPES.BASE) {
            this.baseDestroyed = true;
        }
    }

    isBaseDestroyed() {
        return this.baseDestroyed;
    }

    update(allTanks = []) {
        // Обновляем кирпичи и передаем информацию о танках
        this.brickTiles.forEach(brick => brick.update(allTanks));
    }

    draw(ctx) {
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

        // Рисуем границы из бетона
        ctx.fillStyle = '#FFFFFF';
        for (let i = 0; i < this.width; i++) {
            ctx.fillRect(i * TILE_SIZE, 0, TILE_SIZE, TILE_SIZE);
            ctx.fillRect(i * TILE_SIZE, (this.height-1) * TILE_SIZE, TILE_SIZE, TILE_SIZE);
        }
        for (let i = 0; i < this.height; i++) {
            ctx.fillRect(0, i * TILE_SIZE, TILE_SIZE, TILE_SIZE);
            ctx.fillRect((this.width-1) * TILE_SIZE, i * TILE_SIZE, TILE_SIZE, TILE_SIZE);
        }

        for (let y = 1; y < this.height - 1; y++) {
            for (let x = 1; x < this.width - 1; x++) {
                const tile = this.grid[y][x];
                const tileX = x * this.tileSize;
                const tileY = y * this.tileSize;

                switch(tile) {
                    case TILE_TYPES.EMPTY:
                        break;
                    case TILE_TYPES.BRICK:
                        const key = `${x},${y}`;
                        if (this.brickTiles.has(key)) {
                            this.brickTiles.get(key).draw(ctx);
                        }
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

                        // Глянцевый эффект
                        ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
                        ctx.beginPath();
                        ctx.moveTo(tileX, tileY);
                        ctx.lineTo(tileX + this.tileSize, tileY);
                        ctx.lineTo(tileX, tileY + this.tileSize);
                        ctx.fill();

                        // Текстура бетона
                        ctx.fillStyle = 'rgba(200, 200, 200, 0.2)';
                        for (let i = 0; i < 3; i++) {
                            for (let j = 0; j < 3; j++) {
                                if ((i + j) % 2 === 0) {
                                    ctx.fillRect(
                                        tileX + i * this.tileSize/3 + 2,
                                        tileY + j * this.tileSize/3 + 2,
                                        this.tileSize/4,
                                        this.tileSize/4
                                    );
                                }
                            }
                        }
                        break;
                }
            }
        }
    }
}
