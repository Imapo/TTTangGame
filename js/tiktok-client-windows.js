class TikTokClient {
    constructor(game) {
        this.game = game;
        this.ws = null;
        this.isConnected = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
    }

    connect() {
        try {
            console.log('🔗 Подключаемся к TikTok серверу...');
            this.ws = new WebSocket('ws://localhost:8080');

            this.ws.onopen = () => {
                console.log('✅ Подключено к TikTok серверу');
                this.isConnected = true;
                this.reconnectAttempts = 0;
            };

            this.ws.onmessage = (event) => {
                this.handleMessage(JSON.parse(event.data));
            };

            this.ws.onclose = () => {
                console.log('🔌 Соединение с TikTok сервером закрыто');
                this.isConnected = false;
                this.handleReconnect();
            };

            this.ws.onerror = (error) => {
                console.error('❌ WebSocket ошибка:', error);
            };

        } catch (error) {
            console.error('❌ Ошибка подключения WebSocket:', error);
        }
    }

    handleMessage(data) {
    console.log('📨 Обрабатываем сообщение TikTok:', data.type);
    
    if (!this.game.viewerSystem) {
        console.log('⚠️ viewerSystem не найден');
        return;
    }

    // 🔥 ОБРАБАТЫВАЕМ ВСЕ ТИПЫ СООБЩЕНИЙ
    switch (data.type) {
        case 'spawn_tank':
            console.log(`🎮 Спавним танк для ${data.username}`);
            this.game.viewerSystem.spawnViewerTank(
                data.userId,
                data.username,
                data.avatar || ''
            );
            break;

        case 'viewer_activity':
            console.log(`👤 Активность зрителя: ${data.username} - ${data.activity}`);
            
            // 🔥 ДОБАВЛЯЕМ ЗРИТЕЛЯ В СООТВЕТСТВУЮЩИЙ ПУЛ
            switch (data.activity) {
                case 'gift':
                    this.game.viewerSystem.addGiftViewer(
                        data.userId,
                        data.username,
                        data.avatar || ''
                    );
                    // Также обрабатываем подарок как бонус
                    this.game.viewerSystem.handleGiftFromViewer(
                        data.userId,
                        data.username,
                        data.giftName || 'gift'
                    );
                    break;
                    
                case 'like':
                    this.game.viewerSystem.addLikeViewer(
                        data.userId,
                        data.username,
                        data.avatar || ''
                    );
                    // Обрабатываем лайк
                    this.game.viewerSystem.handleLikeFromViewer(
                        data.userId,
                        data.username,
                        'like'
                    );
                    break;
                    
                case 'subscribe':
                    this.game.viewerSystem.addSubscriberViewer(
                        data.userId,
                        data.username,
                        data.avatar || ''
                    );
                    // Можно добавить бонус за подписку
                    this.game.viewerSystem.handleGiftFromViewer(
                        data.userId,
                        data.username,
                        'subscribe'
                    );
                    break;
                    
                case 'member':
                case 'chat':
                    this.game.viewerSystem.addActiveViewer(
                        data.userId,
                        data.username,
                        data.avatar || ''
                    );
                    break;
            }
            break;

        case 'chat':
            // Простое сообщение в чате
            console.log(`💬 ${data.username}: ${data.message}`);
            this.game.viewerSystem.addActiveViewer(
                data.userId,
                data.username,
                data.avatar || ''
            );
            
            // Проверяем команду !танк
            if (data.message && (data.message.toLowerCase().includes('!танк') || 
                                 data.message.toLowerCase().includes('!tank'))) {
                console.log(`🎮 Команда !танк от ${data.username}`);
                this.game.viewerSystem.spawnViewerTank(
                    data.userId,
                    data.username,
                    data.avatar || ''
                );
            }
            break;

        case 'welcome':
            console.log('👋 Приветствие от сервера:', data.message);
            break;

        default:
            console.log('⚠️ Неизвестный тип сообщения:', data.type, data);
    }
}

    handleReconnect() {
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            console.log(`🔄 Попытка переподключения ${this.reconnectAttempts}/${this.maxReconnectAttempts}`);
            setTimeout(() => this.connect(), 3000);
        }
    }

    disconnect() {
        if (this.ws) {
            this.ws.close();
        }
    }
}
