const TikTokIntegration = require('./tiktok-integration');
const { Game } = require('./game'); // Импортируйте ваш основной класс Game
const ViewerSystem = require('./viewer-system'); // Импортируйте ViewerSystem

class TikTokBridge {
    constructor() {
        this.game = null;
        this.viewerSystem = null;
        this.tiktok = null;
    }

    async initialize() {
        console.log('🎮 Инициализация TikTok Bridge...');

        try {
            // Инициализируем игру (адаптируйте под вашу структуру)
            this.game = new Game();
            await this.game.initialize();

            // Инициализируем систему зрителей
            this.viewerSystem = this.game.viewerSystem || new ViewerSystem(this.game);

            // Создаем и настраиваем TikTok интеграцию
            this.tiktok = new TikTokIntegration(this.viewerSystem);
            this.viewerSystem.setTikTokIntegration(this.tiktok);

            console.log('✅ Все системы инициализированы');
            return true;

        } catch (error) {
            console.error('❌ Ошибка инициализации:', error);
            return false;
        }
    }

    async start(streamerUsername) {
        if (!streamerUsername) {
            console.error('❌ Не указано имя стримера');
            return false;
        }

        const initialized = await this.initialize();
        if (!initialized) return false;

        console.log(`🎯 Подключаемся к стримеру: ${streamerUsername}`);

        const connected = await this.tiktok.connectToStream(streamerUsername);
        if (connected) {
            console.log('🎉 TikTok Bridge запущен и работает!');
            console.log('📝 Зрители могут писать в чат "!танк" для создания своего танка');
            console.log('💖 Лайки и подарки автоматически влияют на игровой процесс');
            return true;
        } else {
            console.error('❌ Не удалось подключиться к трансляции');
            return false;
        }
    }

    stop() {
        if (this.tiktok) {
            this.tiktok.disconnect();
        }
        console.log('🛑 TikTok Bridge остановлен');
    }
}

// Запуск приложения
if (require.main === module) {
    const bridge = new TikTokBridge();

    // Получаем имя стримера из аргументов командной строки
    const streamerUsername = process.argv[2];

    if (!streamerUsername) {
        console.log('❌ Использование: node tiktok-bridge.js <username_стримера>');
        console.log('💡 Пример: node tiktok-bridge.js officialgeilegisela');
        process.exit(1);
    }

    bridge.start(streamerUsername).then(success => {
        if (!success) {
            process.exit(1);
        }
    });

    // Обработка graceful shutdown
    process.on('SIGINT', () => {
        console.log('\n🛑 Получен SIGINT, останавливаем...');
        bridge.stop();
        process.exit(0);
    });
}

module.exports = TikTokBridge;
