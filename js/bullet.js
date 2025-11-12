// === КЛАСС ПУЛИ ===
class Bullet {
    constructor(x, y, direction, owner, size = 6) {
        this.position = new Vector2(x, y);
        this.direction = direction;
        this.speed = BULLET_SPEED;
        this.owner = owner;
        this.size = size; // Теперь размер можно задавать
        this.active = true;
    }

    update() {
        // Создаем Vector2 из обычного объекта направления
        const directionVector = new Vector2(this.direction.x, this.direction.y);
        this.position = this.position.add(directionVector.multiply(this.speed));

        // Проверка границ с непроходимыми стенами
        if (this.position.x < TILE_SIZE || this.position.x > CANVAS_WIDTH - TILE_SIZE ||
            this.position.y < TILE_SIZE || this.position.y > CANVAS_HEIGHT - TILE_SIZE) {
            this.active = false;
            }
    }

    draw(ctx) {
        ctx.fillStyle = this.owner === 'player' ? '#FFFF00' : '#FF4444';
        ctx.beginPath();
        ctx.arc(this.position.x, this.position.y, this.size / 2, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = '#000';
        ctx.lineWidth = 1;
        ctx.stroke();
    }

    getBounds() {
        return new Rectangle(
            this.position.x - this.size/2,
            this.position.y - this.size/2,
            this.size,
            this.size
        );
    }
}
