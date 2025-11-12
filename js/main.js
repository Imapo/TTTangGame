// === ОСНОВНОЙ ФАЙЛ ИНИЦИАЛИЗАЦИИ ===
let game;

window.addEventListener('load', () => {
    // Просто создаем игру без сложных проверок
    try {
        game = new Game();
    } catch (error) {
        console.error('Error initializing game:', error);
        alert('Ошибка загрузки игры: ' + error.message);
    }
});

// Предотвращаем прокрутку страницы при использовании стрелок и пробела
window.addEventListener('keydown', function(e) {
    if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code)) {
        e.preventDefault();
    }
}, false);
