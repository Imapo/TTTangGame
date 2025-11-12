// === КЛАСС ВЕКТОРА ===
class Vector2 {
    constructor(x = 0, y = 0) {
        this.x = x;
        this.y = y;
    }

    add(other) {
        return new Vector2(this.x + other.x, this.y + other.y);
    }

    multiply(scalar) {
        return new Vector2(this.x * scalar, this.y * scalar);
    }

    equals(other) {
        return this.x === other.x && this.y === other.y;
    }

    clone() {
        return new Vector2(this.x, this.y);
    }
}