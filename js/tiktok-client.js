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
        if (!this.game.viewerSystem) return;

        switch (data.type) {
            case 'gift':
                console.log(`🎁 Обрабатываем подарок от ${data.username}`);
                this.game.viewerSystem.addGiftViewer(
                    data.userId,
                    data.username,
                    data.avatar || ''
                );
                this.game.viewerSystem.handleGiftFromViewer(
                    data.userId,
                    data.username,
                    data.giftName
                );
                break;

            case 'like':
                console.log(`💖 Обрабатываем лайк от ${data.username}`);
                this.game.viewerSystem.addLikeViewer(
                    data.userId,
                    data.username,
                    data.avatar || ''
                );
                this.game.viewerSystem.handleLikeFromViewer(
                    data.userId,
                    data.username,
                    'like'
                );
                break;

            case 'subscribe':
                console.log(`⭐ Обрабатываем подписку от ${data.username}`);
                this.game.viewerSystem.addSubscriberViewer(
                    data.userId,
                    data.username,
                    data.avatar || ''
                );
                break;

            case 'member':
                console.log(`👀 Новый зритель: ${data.username}`);
                this.game.viewerSystem.addActiveViewer(
                    data.userId,
                    data.username,
                    data.avatar || ''
                );
                break;

            case 'chat':
                // Добавляем в активные зрители при любом сообщении
                this.game.viewerSystem.addActiveViewer(
                    data.userId,
                    data.username,
                    data.avatar || ''
                );
                console.log(`💬 ${data.username}: ${data.message}`);
                break;
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
