// === КЛАСС БОНУСА ===
class Bonus {
    constructor(x, y, type) {
        this.position = new Vector2(x, y);
        this.type = type;
        this.size = TILE_SIZE - 10;
        this.active = true;
        this.blinkTimer = 0;
        this.visible = true;
    }

    update() {
        // Мигание бонуса
        this.blinkTimer++;
        if (this.blinkTimer >= BONUS_BLINK_INTERVAL) {
            this.blinkTimer = 0;
            this.visible = !this.visible;
        }
    }

    draw(ctx) {
        if (!this.active || !this.visible) return;

        ctx.save();
        ctx.translate(this.position.x, this.position.y);

        switch(this.type) {
            case BONUS_TYPES.STAR:
                this.drawStar(ctx);
                break;
            case BONUS_TYPES.FREEZE:
                this.drawFreeze(ctx);
                break;
        }

        ctx.restore();
    }

    drawStar(ctx) {
        // Рисуем звезду
        ctx.fillStyle = '#FFD700';
        ctx.strokeStyle = '#FFA500';
        ctx.lineWidth = 2;

        const spikes = 5;
        const outerRadius = this.size / 2;
        const innerRadius = outerRadius / 2;

        ctx.beginPath();
        for (let i = 0; i < spikes * 2; i++) {
            const radius = i % 2 === 0 ? outerRadius : innerRadius;
            const angle = (Math.PI / spikes) * i;
            const x = Math.cos(angle) * radius;
            const y = Math.sin(angle) * radius;

            if (i === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
    }

    drawFreeze(ctx) {
        // Рисуем снежинку (заморозка)
        ctx.fillStyle = '#00FFFF';
        ctx.strokeStyle = '#0088FF';
        ctx.lineWidth = 2;

        ctx.beginPath();
        ctx.arc(0, 0, this.size / 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Лучи снежинки
        for (let i = 0; i < 6; i++) {
            const angle = (Math.PI / 3) * i;
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(Math.cos(angle) * this.size / 2, Math.sin(angle) * this.size / 2);
            ctx.stroke();
        }
    }

    getBounds() {
        return new Rectangle(
            this.position.x - this.size / 2,
            this.position.y - this.size / 2,
            this.size,
            this.size
        );
    }

    collect() {
        this.active = false;
        return this.type;
    }
}
