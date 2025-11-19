class StreamInteractionManager {
    constructor(game) {
        this.game = game;
        this.viewerTanks = new Map(); // username -> tank object
        this.activeViewerTank = null;
        this.viewerTankSpawnedThisRound = false;
        this.likesCount = 0;
        this.giftsCount = 0;

        // Эмуляция чата для тестирования
        this.setupTestChat();
    }

    // Обработка сообщений из чата
    handleChatMessage(username, message, isSub = false, isGift = false) {
        const cleanMessage = message.trim().toLowerCase();

        // Команда спавна танка
        if (cleanMessage.startsWith(TWITCH_CONFIG.COMMAND_PREFIX + TWITCH_CONFIG.VIEWER_TANK.SPAWN_COMMAND)) {
            this.handleTankSpawnCommand(username);
            return;
        }

        // Обработка лайков
        if (this.isLikeMessage(cleanMessage)) {
            this.handleLike(username);
            return;
        }

        // Обработка подарков
        if (isGift) {
            this.handleGift(username, message);
            return;
        }

        // Обработка подписки
        if (isSub) {
            this.handleSubscription(username);
            return;
        }
    }

    // Команда спавна танка зрителя
    handleTankSpawnCommand(username) {
        if (this.viewerTankSpawnedThisRound) {
            this.sendChatMessage(`${username}, танк зрителя уже заспавнен в этом раунде!`);
            return;
        }

        if (this.activeViewerTank && !this.activeViewerTank.isDestroyed) {
            this.sendChatMessage(`${username}, танк зрителя уже на поле!`);
            return;
        }

        this.spawnViewerTank(username);
        this.sendChatMessage(`🎮 ${username} вступает в битву! Управляйте танком с помощью чата!`);
    }

    // Спавн танка зрителя
    spawnViewerTank(username) {
        const spawnPoint = this.findSafeSpawnPoint();
        if (!spawnPoint) {
            this.sendChatMessage(`${username}, нет свободного места для спавна!`);
            return;
        }

        const viewerTank = new Tank(
            spawnPoint.x,
            spawnPoint.y,
            'enemy', // Используем тип 'enemy' чтобы танк работал с существующей логикой
            1,
            'VIEWER' // Специальный тип для зрителей
        );

        // Кастомизация танка зрителя
        viewerTank.username = username;
        viewerTank.viewerName = username;
        viewerTank.hasAutoAim = true;
        viewerTank.autoAimDuration = 30000;

        // Отключаем ИИ для танка зрителя
        viewerTank.ai = null;

        this.activeViewerTank = viewerTank;
        this.viewerTankSpawnedThisRound = true;
        this.viewerTanks.set(username, viewerTank);

        // Добавляем в менеджер врагов для обновления
        this.game.enemyManager.enemies.push(viewerTank);

        // Эффект спавна
        this.game.effectManager.addExplosion(spawnPoint.x, spawnPoint.y, 'bonus');
        this.game.screenShake = 15;
    }

    // Обработка лайков
    handleLike(username) {
        this.likesCount++;

        if (this.game.player && !this.game.player.isDestroyed) {
            // Добавляем опыт игроку за лайк
            const expGained = TWITCH_CONFIG.INTERACTIONS.LIKE_EXP;
            this.game.player.experience += expGained;
            this.game.playerExperience = this.game.player.experience;

            // Проверяем уровень ап
            this.game.player.checkLevelUp();

            // Визуальный эффект
            this.createFloatingText(this.game.player.position.x, this.game.player.position.y, `+${expGained} XP 💖`);

            this.sendChatMessage(`💖 ${username} лайкнул! Игрок получает +${expGained} опыта!`);
        }
    }

    // Обработка подарков
    handleGift(username, giftType) {
        this.giftsCount++;

        if (Math.random() < TWITCH_CONFIG.INTERACTIONS.GIFT_POWERUP_CHANCE) {
            this.spawnGiftPowerup(username, giftType);
        }

        // Бонус игроку
        if (this.game.player && !this.game.player.isDestroyed) {
            this.game.player.activateShield(8000);
            this.createFloatingText(this.game.player.position.x, this.game.player.position.y, `ЩИТ 🎁`);
        }

        this.sendChatMessage(`🎁 ${username} отправил подарок! Спасибо!`);
    }

    // Обработка подписки
    handleSubscription(username) {
        if (this.game.player && !this.game.player.isDestroyed) {
            const expBonus = TWITCH_CONFIG.INTERACTIONS.SUBSCRIPTION_BONUS;
            this.game.player.experience += expBonus;
            this.game.playerExperience = this.game.player.experience;
            this.game.player.checkLevelUp();

            this.createFloatingText(this.game.player.position.x, this.game.player.position.y, `+${expBonus} XP ⭐`);
            this.sendChatMessage(`⭐ ${username} подписался! Игрок получает +${expBonus} опыта!`);
        }
    }

    // Спавн паверапа за подарок
    spawnGiftPowerup(username, giftType) {
        const position = this.game.bonusManager.findFreeBonusPosition();
        if (!position) return;

        // Создаем специальный паверап для подарков
        const giftBonus = new Bonus(
            position.x,
            position.y,
            {
                id: 'GIFT_' + giftType,
                symbol: '🎁',
                color: '#FFD700',
                duration: 15000
            },
            this.game
        );

        // Увеличиваем время жизни паверапа
        giftBonus.lifetime = 15000;
        giftBonus.giftedBy = username;

        this.game.bonusManager.bonuses.push(giftBonus);
    }

    // Управление танком зрителя через чат
    handleViewerTankControl(username, directionCommand) {
        if (!this.activeViewerTank || this.activeViewerTank.isDestroyed) return;
        if (this.activeViewerTank.viewerName !== username) return;

        const directionMap = {
            'вверх': DIRECTIONS.UP,
            'верх': DIRECTIONS.UP,
            'up': DIRECTIONS.UP,
            'вниз': DIRECTIONS.DOWN,
            'down': DIRECTIONS.DOWN,
            'налево': DIRECTIONS.LEFT,
            'влево': DIRECTIONS.LEFT,
            'left': DIRECTIONS.LEFT,
            'направо': DIRECTIONS.RIGHT,
            'вправо': DIRECTIONS.RIGHT,
            'right': DIRECTIONS.RIGHT
        };

        const direction = directionMap[directionCommand.toLowerCase()];
        if (direction) {
            this.activeViewerTank.direction = direction;

            // Пытаемся двигаться
            const allTanks = [this.game.player, ...this.game.enemyManager.enemies];
            const allFragments = this.game.getAllFragments();
            this.activeViewerTank.move(direction, this.game.map, allTanks, allFragments);
        }

        // Команда стрельбы
        if (directionCommand.toLowerCase() === 'стрелять' || directionCommand.toLowerCase() === 'fire') {
            if (this.activeViewerTank.canShoot) {
                const bullet = this.activeViewerTank.shoot();
                if (bullet) {
                    this.game.bullets.push(bullet);
                    this.game.soundManager.play('playerShot');
                }
            }
        }
    }

    // Поиск безопасной точки для спавна
    findSafeSpawnPoint() {
        const spawnPoints = [
            { x: 100, y: 100 },
            { x: CANVAS_WIDTH - 100, y: 100 },
            { x: CANVAS_WIDTH / 2, y: 100 },
            { x: 100, y: CANVAS_HEIGHT - 100 },
            { x: CANVAS_WIDTH - 100, y: CANVAS_HEIGHT - 100 }
        ];

        for (let point of spawnPoints) {
            const bounds = new Rectangle(
                point.x - TWITCH_CONFIG.VIEWER_TANK.SIZE/2,
                point.y - TWITCH_CONFIG.VIEWER_TANK.SIZE/2,
                TWITCH_CONFIG.VIEWER_TANK.SIZE,
                TWITCH_CONFIG.VIEWER_TANK.SIZE
            );

            if (!this.game.map.checkCollision(bounds) &&
                !this.checkTankCollision(bounds)) {
                return point;
                }
        }
        return null;
    }

    checkTankCollision(bounds) {
        if (!this.game.player.isDestroyed && bounds.intersects(this.game.player.getBounds())) {
            return true;
        }

        return this.game.enemyManager.enemies.some(enemy =>
        bounds.intersects(enemy.getBounds())
        );
    }

    // Создание всплывающего текста
    createFloatingText(x, y, text, color = '#FFFFFF') {
        if (!this.game.floatingTexts) this.game.floatingTexts = [];

        this.game.floatingTexts.push({
            x: x,
            y: y,
            text: text,
            color: color,
            lifetime: 120,
            alpha: 1.0,
            velocity: new Vector2(0, -1)
        });
    }

    // Сброс состояния для нового раунда
    resetForNewRound() {
        this.viewerTankSpawnedThisRound = false;
        this.activeViewerTank = null;
    }

    // Обновление системы
    update() {
        // Обновляем всплывающие тексты
        if (this.game.floatingTexts) {
            for (let i = this.game.floatingTexts.length - 1; i >= 0; i--) {
                const text = this.game.floatingTexts[i];
                text.lifetime--;
                text.alpha = text.lifetime / 120;
                text.y += text.velocity.y;

                if (text.lifetime <= 0) {
                    this.game.floatingTexts.splice(i, 1);
                }
            }
        }
    }

    // Отрисовка всплывающих текстов
    drawFloatingTexts(ctx) {
        if (!this.game.floatingTexts) return;

        ctx.save();
        ctx.font = 'bold 14px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        this.game.floatingTexts.forEach(text => {
            ctx.fillStyle = text.color.replace(')', `, ${text.alpha})`).replace('rgb', 'rgba');
            ctx.fillText(text.text, text.x, text.y);
        });

        ctx.restore();
    }

    // Вспомогательные методы
    isLikeMessage(message) {
        const likeKeywords = ['лайк', 'like', '❤️', '💖', '👍'];
        return likeKeywords.some(keyword => message.includes(keyword));
    }

    sendChatMessage(message) {
        // Эмуляция отправки сообщения в чат
        console.log(`[CHAT]: ${message}`);

        // В реальном приложении здесь будет интеграция с Twitch API
        if (typeof window !== 'undefined' && window.displayChatMessage) {
            window.displayChatMessage(message);
        }
    }

    // Тестовый чат для демонстрации
    setupTestChat() {
        if (typeof window !== 'undefined') {
            window.testChat = (username, message) => {
                this.handleChatMessage(username, message);
            };

            // Тестовые команды
            console.log('Тестовые команды чата:');
            console.log('testChat("Viewer1", "!танк") - заспавнить танк');
            console.log('testChat("Viewer2", "лайк") - отправить лайк');
            console.log('testChat("Viewer3", "подарок") - отправить подарок');
        }
    }
}
