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
        if (!this.game.viewerSystem) {
            console.log('❌ viewerSystem не доступен!');
            return;
        }

        // 🔥 ДИАГНОСТИКА: выводим ID зрителя и список всех танков
        console.log(`🔍 Получено сообщение типа: ${data.type}`);
        console.log(`   Зритель: ${data.username} (ID: ${data.userId})`);

        if (this.game.viewerSystem && this.game.viewerSystem.game && this.game.viewerSystem.game.enemyManager) {
            const allTanks = this.game.viewerSystem.game.enemyManager.enemies;
            const viewerTanks = allTanks.filter(tank =>
            (tank.enemyType === 'VIEWER' || tank.isViewerTank) && !tank.isDestroyed
            );

            console.log(`📊 СТАТИСТИКА ТАНКОВ:`);
            console.log(`   Всего танков на поле: ${allTanks.length}`);
            console.log(`   Танков зрителей: ${viewerTanks.length}`);

            if (viewerTanks.length > 0) {
                viewerTanks.forEach((tank, index) => {
                    console.log(`   ${index + 1}. "${tank.username}" (ID: ${tank.userId || 'нет ID'})`);
                    console.log(`      userId танка: ${tank.userId}`);
                    console.log(`      userId зрителя: ${data.userId}`);
                    console.log(`      Совпадение: ${tank.userId === data.userId ? '✅ ДА' : '❌ НЕТ'}`);
                });
            }
        }

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
                // 🔥 ОБНОВЛЕННАЯ ЛОГИКА ДЛЯ СООБЩЕНИЙ ЧАТА (ТОЧНО КАК В LINUX)
                console.log(`💬 ${data.username}: ${data.message}`);

                // 🔥 ТЕСТОВЫЕ СООБЩЕНИЯ С ЭМОДЗИ
                if (data.message === '!testemoji') {
                    data.message = 'Привет! 😊 👍 🎮 💀 🏆';
                }

                // Добавляем в активные зрители при любом сообщении
                this.game.viewerSystem.addActiveViewer(
                    data.userId,
                    data.username,
                    data.avatar || ''
                );

                // 🔥 ВАЖНО: Вызываем handleChatMessage если метод существует
                if (this.game.viewerSystem.handleChatMessage) {
                    console.log(`🔄 Вызываем handleChatMessage для ${data.username}`);
                    this.game.viewerSystem.handleChatMessage(
                        data.userId,
                        data.username,
                        data.message
                    );
                } else {
                    console.log(`❌ У viewerSystem нет метода handleChatMessage!`);
                    console.log(`   Доступные методы у viewerSystem:`);
                    Object.getOwnPropertyNames(Object.getPrototypeOf(this.game.viewerSystem)).forEach(method => {
                        if (method !== 'constructor') {
                            console.log(`   - ${method}`);
                        }
                    });
                }

                // Проверяем команды для спавна танка
                if (data.message.toLowerCase().includes('!танк') ||
                    data.message.toLowerCase().includes('!tank')) {
                    console.log(`🎮 Команда на спавн танка от ${data.username}`);

                if (this.game.viewerSystem.spawnViewerTank) {
                    this.game.viewerSystem.spawnViewerTank(
                        data.userId,
                        data.username,
                        data.avatar || ''
                    );
                }
                    }
                    break;

            default:
                console.log(`⚠️ Неизвестный тип сообщения: ${data.type}`);
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
