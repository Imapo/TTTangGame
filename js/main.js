// === ОСНОВНОЙ ФАЙЛ ИНИЦИАЛИЗАЦИИ ===
let game;

window.addEventListener('load', () => {
    try {
        game = new Game();

        // Обработчик сброса таблицы лидеров (один раз при загрузке)
        const resetButton = document.getElementById('resetLeaderboard');
        if (resetButton) {
            resetButton.addEventListener('click', () => {
                if (confirm('Очистить таблицу лидеров?')) {
                    game.resetLeaderboard();
                }
            });
        }

        // Обработчик переключения (в main.js)
        const toggleButton = document.getElementById('toggleLeaderboard');
        if (toggleButton) {
            toggleButton.onclick = () => {
                game.showFullLeaderboard = !game.showFullLeaderboard;
                game.updateLeaderboardUI();
            };
        }
    } catch (error) {
        console.error('Error initializing game:', error);
        alert('Ошибка загрузки игры: ' + error.message);
    }

    window.closeLevelStats = function() {
        if (game && game.closeLevelStats) {
            game.closeLevelStats();
        }
    };
});

// Предотвращаем прокрутку страницы при использовании стрелок и пробела
window.addEventListener('keydown', function(e) {
    if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code)) {
        e.preventDefault();
    }
}, false);
