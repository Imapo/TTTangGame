const { WebcastPushConnection } = require('tiktok-live-connector');

class TikTokIntegration {
    constructor(viewerSystem) {
        this.viewerSystem = viewerSystem;
        this.connection = null;
        this.isConnected = false;
    }

    // Метод для подключения к трансляции
    async connectToStream(uniqueId) {
        try {
            console.log(`[TikTok] Пытаемся подключиться к пользователю: ${uniqueId}`);

            this.connection = new WebcastPushConnection(uniqueId, {
                enableExtendedGiftInfo: true,
                processInitialData: true
            });

            // Подключаемся к трансляции
            const state = await this.connection.connect();
            this.isConnected = true;

            console.log(`✅ [TikTok] Успешно подключились к комнате: ${state.roomId}`);
            console.log(`📺 [TikTok] Стример: ${state.owner.nickname}`);

            // Настраиваем обработчики событий
            this.setupEventHandlers();

            return true;

        } catch (error) {
            console.error('❌ [TikTok] Ошибка подключения:', error.message);
            this.isConnected = false;
            return false;
        }
    }

    setupEventHandlers() {
        if (!this.connection) return;

        // === КОММЕНТАРИИ ИЗ ЧАТА ===
        this.connection.on('chat', data => {
            console.log(`💬 ${data.nickname}: ${data.comment}`);

            // Если комментарий содержит команду для спавна танка
            if (data.comment.toLowerCase().includes('!танк') ||
                data.comment.toLowerCase().includes('!tank')) {

                console.log(`🎮 Запрос на создание танка от ${data.nickname}`);

            // Вызываем метод спавна танка из viewerSystem
            if (this.viewerSystem && this.viewerSystem.spawnViewerTank) {
                this.viewerSystem.spawnViewerTank(
                    data.uniqueId,
                    data.nickname,
                    data.profilePictureUrl || ''
                );
            }
                }
        });

        // === ЛАЙКИ ===
        this.connection.on('like', data => {
            console.log(`💖 ${data.nickname} поставил(а) лайк! (всего: ${data.totalLikeCount})`);

            // Передаем лайк в систему зрителей
            if (this.viewerSystem && this.viewerSystem.handleLikeFromViewer) {
                this.viewerSystem.handleLikeFromViewer(
                    data.uniqueId,
                    data.nickname,
                    'like'
                );
            }
        });

        // === ПОДАРКИ ===
        this.connection.on('gift', data => {
            console.log(`🎁 ${data.nickname} отправил(а) подарок: ${data.giftName} (x${data.repeatCount})`);

            // Обрабатываем только одиночные подарки (не комбо)
            if (data.repeatEnd || data.repeatCount === 1) {
                if (this.viewerSystem && this.viewerSystem.handleGiftFromViewer) {
                    this.viewerSystem.handleGiftFromViewer(
                        data.uniqueId,
                        data.nickname,
                        data.giftName
                    );
                }
            }
        });

        // === ЗРИТЕЛИ ПРИСОЕДИНЯЮТСЯ ===
        this.connection.on('member', data => {
            console.log(`👋 ${data.nickname} присоединился(ась) к стриму`);

            // Автоматически создаем танк для новых зрителей (опционально)
            if (this.viewerSystem && this.viewerSystem.spawnViewerTank) {
                setTimeout(() => {
                    this.viewerSystem.spawnViewerTank(
                        data.uniqueId,
                        data.nickname,
                        data.profilePictureUrl || ''
                    );
                }, 2000); // Задержка 2 секунды
            }
        });

        // === ПОДПИСКИ ===
        this.connection.on('subscribe', data => {
            console.log(`⭐ ${data.nickname} подписался(ась)!`);

            // Можно добавить специальный бонус за подписку
            if (this.viewerSystem && this.viewerSystem.handleGiftFromViewer) {
                this.viewerSystem.handleGiftFromViewer(
                    data.uniqueId,
                    data.nickname,
                    'subscribe'
                );
            }
        });

        // === ОШИБКИ И ОТКЛЮЧЕНИЯ ===
        this.connection.on('disconnected', () => {
            console.log('🔌 [TikTok] Соединение разорвано');
            this.isConnected = false;
        });

        this.connection.on('error', (err) => {
            console.error('❌ [TikTok] Ошибка:', err);
            this.isConnected = false;
        });

        console.log('✅ [TikTok] Обработчики событий настроены');
    }

    // Метод для отключения
    disconnect() {
        if (this.connection) {
            this.connection.disconnect();
            this.isConnected = false;
            console.log('🔌 [TikTok] Соединение закрыто');
        }
    }

    // Получение статуса подключения
    getStatus() {
        return {
            isConnected: this.isConnected,
            roomId: this.connection?.roomId || null
        };
    }
}

module.exports = TikTokIntegration;
