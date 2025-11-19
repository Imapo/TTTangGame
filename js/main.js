// === ОСНОВНОЙ ФАЙЛ ИНИЦИАЛИЗАЦИИ ===
let game;

window.addEventListener('load', () => {
    try {
        game = new Game();

        // Обработчики кнопок
        document.getElementById('resetLeaderboard')?.addEventListener('click', () => {
            if (confirm('Очистить таблицу лидеров?')) game.resetLeaderboard();
        });

            document.getElementById('toggleLeaderboard')?.addEventListener('click', () => {
                game.showFullLeaderboard = !game.showFullLeaderboard;
                game.updateLeaderboardUI();
            });
    } catch (error) {
        console.error('Error initializing game:', error);
        alert('Ошибка загрузки игры: ' + error.message);
    }

    window.closeLevelStats = () => game?.closeLevelStats?.();
});

// Предотвращаем прокрутку страницы при использовании стрелок и пробела
window.addEventListener('keydown', (e) => {
    if (['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code)) {
        e.preventDefault();
    }
}, false);
