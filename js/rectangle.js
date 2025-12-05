// === КЛАСС ПРЯМОУГОЛЬНИКА ДЛЯ КОЛЛИЗИЙ ===
class Rectangle {
    constructor(x, y, width, height) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
    }

    // 🔥 ДОБАВЛЯЕМ НОВЫЙ МЕТОД
    contains(pointX, pointY) {
        return pointX >= this.x &&
        pointX <= this.x + this.width &&
        pointY >= this.y &&
        pointY <= this.y + this.height;
    }

    // Если уже есть метод intersects, оставляем его
    intersects(other) {
        return this.x < other.x + other.width &&
        this.x + this.width > other.x &&
        this.y < other.y + other.height &&
        this.y + this.height > other.y;
    }

    containsPoint(point) {
        return point.x >= this.x && 
               point.x <= this.x + this.width &&
               point.y >= this.y && 
               point.y <= this.y + this.height;
    }
}
