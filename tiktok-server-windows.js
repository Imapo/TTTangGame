const { WebcastPushConnection } = require('tiktok-live-connector');
const WebSocket = require('ws');
const readline = require('readline');

class TikTokServer {
    constructor(port = 8080) {
        this.port = port;
        this.wss = null;
        this.tiktokConnection = null;
        this.clients = new Set();
    }

    // Запуск WebSocket сервера (идентично Linux версии)
    startWebSocketServer() {
        try {
            // 🔥 ПРИНИМАЕМ ВСЕ ПОДКЛЮЧЕНИЯ
            this.wss = new WebSocket.Server({
                port: this.port,
                host: '0.0.0.0'
            });

            console.log(`🌐 WebSocket сервер запущен на порту ${this.port}`);
            console.log('Доступен по:');
            console.log(`   - ws://localhost:${this.port}`);
            console.log(`   - ws://192.168.10.15:${this.port}`);

            this.wss.on('connection', (ws, req) => {
                const clientIP = req.socket.remoteAddress;
                console.log(`✅ Новое подключение к игре с IP: ${clientIP}`);
                this.clients.add(ws);

                ws.on('close', () => {
                    console.log(`🔌 Игра отключилась: ${clientIP}`);
                    this.clients.delete(ws);
                });

                ws.on('error', (error) => {
                    console.error('❌ WebSocket ошибка:', error);
                    this.clients.delete(ws);
                });
            });

        } catch (error) {
            console.error('❌ Ошибка сервера:', error.message);
            process.exit(1);
        }
    }

    // Отправка сообщения всем подключенным играм (идентично Linux)
    broadcast(data) {
        const message = JSON.stringify(data);
        this.clients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(message);
            }
        });
    }

    // Подключение к TikTok (идентично Linux)
    async connectToTikTok(username) {
        try {
            console.log(`[TikTok] Подключаемся к пользователю: ${username}`);

            this.tiktokConnection = new WebcastPushConnection(username, {
                enableExtendedGiftInfo: true,
                processInitialData: true
            });

            const state = await this.tiktokConnection.connect();
            console.log(`✅ [TikTok] Успешно подключились к комнате: ${state.roomId}`);
            console.log(`🎤 Стример: ${state.owner?.nickname || username}`);

            this.setupTikTokHandlers();
            return true;

        } catch (error) {
            console.error('❌ [TikTok] Ошибка подключения:', error.message);
            console.log('');
            console.log('Возможные причины:');
            console.log('1. Стример не в эфире');
            console.log('2. Неверное имя пользователя');
            console.log('3. Проблемы с сетью');
            return false;
        }
    }

    // Настройка обработчиков TikTok (ИДЕНТИЧНО LINUX ВЕРСИИ)
    setupTikTokHandlers() {
        // === КОММЕНТАРИИ ИЗ ЧАТА ===
        this.tiktokConnection.on('chat', data => {
            console.log(`💬 ${data.nickname}: ${data.comment}`);

            this.broadcast({
                type: 'chat',
                userId: data.uniqueId,
                username: data.nickname,
                message: data.comment,
                avatar: data.profilePictureUrl || ''
            });

            // Команда для спавна танка
            if (data.comment.toLowerCase().includes('!танк') ||
                data.comment.toLowerCase().includes('!tank')) {

                this.broadcast({
                    type: 'spawn_tank',
                    userId: data.uniqueId,
                    username: data.nickname,
                    avatar: data.profilePictureUrl || ''
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
                likeCount: data.likeCount,
                avatar: data.profilePictureUrl || ''
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
                    giftId: data.giftId,
                    avatar: data.profilePictureUrl || ''
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
                avatar: data.profilePictureUrl || ''
            });
        });

        // === ПОДПИСКИ ===
        this.tiktokConnection.on('subscribe', data => {
            console.log(`⭐ ${data.nickname} подписался(ась)!`);

            this.broadcast({
                type: 'subscribe',
                userId: data.uniqueId,
                username: data.nickname,
                avatar: data.profilePictureUrl || ''
            });
        });

        // === ОШИБКИ ===
        this.tiktokConnection.on('error', (err) => {
            console.error('❌ [TikTok] Ошибка:', err.message);
        });

        this.tiktokConnection.on('disconnected', () => {
            console.log('🔌 [TikTok] Соединение разорвано');
        });
    }

    // Запуск всего сервера (с улучшениями из Windows версии)
    async start(streamerUsername) {
        console.log('==============================');
        console.log('TIKTOK LIVE CONNECTOR - WINDOWS');
        console.log('==============================');
        console.log('');

        // Устанавливаем WebSocket
        this.startWebSocketServer();

        // Подключаемся к TikTok
        if (streamerUsername && streamerUsername !== 'test') {
            const connected = await this.connectToTikTok(streamerUsername);
            if (!connected) {
                console.log('');
                console.log('Использование:');
                console.log('  node tiktok-server.js streamer_username');
                console.log('  node tiktok-server.js username 8081 (если порт 8080 занят)');
                return;
            }
        } else if (streamerUsername === 'test') {
            console.log('🛠️ Режим тестирования без TikTok');
        }

        console.log('');
        console.log('🚀 СИСТЕМА ГОТОВА!');
        console.log('Откройте игру в браузере: http://localhost:3000');
        console.log('Зрители пишут "!танк" для создания танка');
        console.log('');
        console.log('==============================');
        console.log('Нажмите Ctrl+C для остановки сервера');
        console.log('==============================');
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
    const username = process.argv[2];
    const port = process.argv[3] || 8080;

    if (!username) {
        console.log('Укажите имя пользователя стримера!');
        console.log('');
        console.log('Примеры:');
        console.log('  node tiktok-server.js streamer_username');
        console.log('  node tiktok-server.js username 8081');
        console.log('');
        console.log('Как найти username:');
        console.log('  https://www.tiktok.com/@username/live');
        console.log('                        ^ здесь');
        console.log('');
        console.log('Для теста без TikTok:');
        console.log('  node tiktok-server.js test');
        process.exit(1);
    }

    const server = new TikTokServer(parseInt(port));

    // Обработка Ctrl+C для Windows
    if (process.platform === "win32") {
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });

        rl.on("SIGINT", () => {
            process.emit("SIGINT");
        });
    }

    process.on('SIGINT', () => {
        console.log('\n🛑 Получен SIGINT, останавливаем сервер...');
        server.stop();
        process.exit(0);
    });

    server.start(username);
}

module.exports = TikTokServer;
