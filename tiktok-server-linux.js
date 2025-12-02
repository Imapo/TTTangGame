const { WebcastPushConnection } = require('tiktok-live-connector');
const WebSocket = require('ws');

class TikTokServer {
    constructor(port = 8080) {
        this.port = port;
        this.wss = null;
        this.tiktokConnection = null;
        this.clients = new Set();
    }

    // Запуск WebSocket сервера
    startWebSocketServer() {
        this.wss = new WebSocket.Server({ port: this.port });

        this.wss.on('connection', (ws) => {
            console.log('✅ Новое подключение к игре');
            this.clients.add(ws);

            ws.on('close', () => {
                console.log('🔌 Игра отключилась');
                this.clients.delete(ws);
            });

            ws.on('error', (error) => {
                console.error('❌ WebSocket ошибка:', error);
                this.clients.delete(ws);
            });
        });

        console.log(`🌐 WebSocket сервер запущен на порту ${this.port}`);
    }

    // Отправка сообщения всем подключенным играм
    broadcast(data) {
        const message = JSON.stringify(data);
        this.clients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(message);
            }
        });
    }

    // Подключение к TikTok
    async connectToTikTok(username) {
        try {
            console.log(`[TikTok] Подключаемся к пользователю: ${username}`);

            this.tiktokConnection = new WebcastPushConnection(username, {
                enableExtendedGiftInfo: true,
                processInitialData: true
            });

            const state = await this.tiktokConnection.connect();
            console.log(`✅ [TikTok] Успешно подключились к комнате: ${state.roomId}`);

            this.setupTikTokHandlers();
            return true;

        } catch (error) {
            console.error('❌ [TikTok] Ошибка подключения:', error.message);
            return false;
        }
    }

    setupTikTokHandlers() {
        // === КОММЕНТАРИИ ИЗ ЧАТА ===
        this.tiktokConnection.on('chat', data => {
            console.log(`💬 ${data.nickname}: ${data.comment}`);

            this.broadcast({
                type: 'chat',
                userId: data.uniqueId,
                username: data.nickname,
                message: data.comment,
                avatar: data.profilePictureUrl
            });

            // Команда для спавна танка
            if (data.comment.toLowerCase().includes('!танк') ||
                data.comment.toLowerCase().includes('!tank')) {

                this.broadcast({
                    type: 'spawn_tank',
                    userId: data.uniqueId,
                    username: data.nickname,
                    avatar: data.profilePictureUrl
                });
                }
        });

        // === ЛАЙКИ ===
        this.tiktokConnection.on('like', data => {
            console.log(`💖 ${data.nickname} поставил(а) лайк!`);

            this.broadcast({
                type: 'like',
                userId: data.uniqueId,
                username: data.nickname,
                likeCount: data.likeCount
            });
        });

        // === ПОДАРКИ ===
        this.tiktokConnection.on('gift', data => {
            console.log(`🎁 ${data.nickname} отправил(а) подарок: ${data.giftName}`);

            // Обрабатываем только одиночные подарки (не комбо)
            if (data.repeatEnd || data.repeatCount === 1) {
                this.broadcast({
                    type: 'gift',
                    userId: data.uniqueId,
                    username: data.nickname,
                    giftName: data.giftName,
                    giftId: data.giftId
                });
            }
        });

        // === НОВЫЕ ЗРИТЕЛИ ===
        this.tiktokConnection.on('member', data => {
            console.log(`👋 ${data.nickname} присоединился(ась) к стриму`);

            this.broadcast({
                type: 'member',
                userId: data.uniqueId,
                username: data.nickname,
                avatar: data.profilePictureUrl
            });
        });

        // === ОШИБКИ ===
        this.tiktokConnection.on('error', (err) => {
            console.error('❌ [TikTok] Ошибка:', err);
        });

        this.tiktokConnection.on('disconnected', () => {
            console.log('🔌 [TikTok] Соединение разорвано');
        });
    }

    // Запуск всего сервера
    async start(streamerUsername) {
        // Устанавливаем WebSocket
        this.startWebSocketServer();

        // Подключаемся к TikTok
        if (streamerUsername) {
            await this.connectToTikTok(streamerUsername);
        }

        console.log('🚀 TikTok Server запущен!');
        console.log('📝 Зрители могут писать "!танк" для создания танка');
    }

    // Остановка сервера
    stop() {
        if (this.tiktokConnection) {
            this.tiktokConnection.disconnect();
        }
        if (this.wss) {
            this.wss.close();
        }
        console.log('🛑 TikTok Server остановлен');
    }
}

// Запуск из командной строки
if (require.main === module) {
    const server = new TikTokServer();
    const streamerUsername = process.argv[2];

    if (!streamerUsername) {
        console.log('❌ Использование: node tiktok-server.js <username_стримера>');
        console.log('💡 Пример: node tiktok-server.js officialgeilegisela');
        process.exit(1);
    }

    server.start(streamerUsername);

    // Graceful shutdown
    process.on('SIGINT', () => {
        console.log('\n🛑 Получен SIGINT, останавливаем сервер...');
        server.stop();
        process.exit(0);
    });
}

module.exports = TikTokServer;
