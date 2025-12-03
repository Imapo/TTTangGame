// === СИСТЕМА ВЗАИМОДЕЙСТВИЯ СО ЗРИТЕЛЯМИ ===
class ViewerSystem {
    constructor(game) {
        this.game = game;
        this.destroyedViewerTanks = new Set();
        this.avatarCache = new Map();
        this.avatarLoadCallbacks = new Map();
        this.floatingTexts = [];

        // 🔥 ДОБАВЛЯЕМ onlineViewers В КОНСТРУКТОР
        this.onlineViewers = new Map();

        // 🔥 ПРИОРИТЕТНЫЕ МАССИВЫ ЗРИТЕЛЕЙ
        this.viewerPools = {
            gifts: [],      // 10 последних дарителей подарков
            likes: [],      // 10 последних поставивших лайки
            subscribers: [], // 10 последних подписчиков
            viewers: []      // 10 последних активных зрителей
        };

        this.usedInRound = new Set(); // Зрители, уже игравшие в этом раунде
        this.maxPoolSize = 10;

        this.initGiftSystem();
    }

    // === МЕТОД ОБРАБОТКИ СООБЩЕНИЙ ИЗ ЧАТА ===
    handleChatMessage(userId, username, message) {
        console.log(`💬 [ViewerSystem.handleChatMessage] ${username} (${userId}): ${message}`);

        // Добавляем зрителя в активные
        this.addActiveViewer(userId, username, '');

        // Ищем танк этого зрителя на поле
        console.log(`🔍 Ищем танк для userID: ${userId}`);
        const viewerTank = this.findViewerTankByUserId(userId);

        if (viewerTank) {
            console.log(`✅ Найден танк: "${viewerTank.username}"`);
            console.log(`   Тип танка: ${viewerTank.enemyType}, isViewerTank: ${viewerTank.isViewerTank}`);
            console.log(`   Метод addChatMessage доступен: ${!!viewerTank.addChatMessage}`);

            // Добавляем сообщение в танк
            if (viewerTank.addChatMessage) {
                viewerTank.addChatMessage(username, message);
                console.log(`💬 Сообщение добавлено в танк "${viewerTank.username}"`);

                // 🔥 ДИАГНОСТИКА: вызываем метод debugChatMessages если он есть
                if (viewerTank.debugChatMessages) {
                    viewerTank.debugChatMessages();
                }
            } else {
                console.log(`❌ У танка нет метода addChatMessage!`);
            }
        } else {
            console.log(`❌ Танк зрителя ${username} не найден на поле`);
            console.log(`   Возможные причины:`);
            console.log(`   1. Танк еще не создан`);
            console.log(`   2. Танк уже уничтожен`);
            console.log(`   3. userId не совпадает`);

            // 🔥 Создаем танк автоматически, если его нет?
            if (message.toLowerCase().includes('!танк') || message.toLowerCase().includes('!tank')) {
                console.log(`🎮 Автоматически создаем танк для ${username}`);
                this.spawnViewerTank(userId, username, '');
            }
        }

        // Проверяем, есть ли команды в сообщении
        this.checkChatCommands(userId, username, message);
    }

    checkChatCommands(userId, username, message) {
        const lowerMessage = message.toLowerCase();

        // Команда для спавна танка
        if (lowerMessage.includes('!танк') || lowerMessage.includes('!tank')) {
            console.log(`🎮 Команда на создание танка от ${username}`);

            if (this.canSpawnViewerTank()) {
                this.spawnViewerTank(userId, username, '');
            }
        }

        // Команда для лайка (если нет системы лайков)
        if (lowerMessage.includes('!лайк') || lowerMessage.includes('!like')) {
            console.log(`💖 Виртуальный лайк от ${username}`);
            this.handleLikeFromViewer(userId, username, 'chat_like');
        }
    }

    // === ПОИСК ТАНКА ЗРИТЕЛЯ ПО USER ID ===
    findViewerTankByUserId(userId) {
        if (!this.game || !this.game.enemyManager) {
            console.log(`❌ Не могу искать танк: game или enemyManager не доступны`);
            return null;
        }

        const allTanks = this.game.enemyManager.enemies;
        console.log(`🔍 Поиск танка для userId: ${userId}`);
        console.log(`   Всего танков: ${allTanks.length}`);

        // Ищем живой танк зрителя с нужным userId
        for (let i = 0; i < allTanks.length; i++) {
            const tank = allTanks[i];

            // Пропускаем уничтоженные танки
            if (tank.isDestroyed) continue;

            const isViewer = tank.enemyType === 'VIEWER' || tank.isViewerTank;

            if (isViewer && tank.userId === userId) {
                console.log(`   ✅ Найден танк на позиции ${i}: "${tank.username}"`);
                console.log(`      userId танка: "${tank.userId}"`);
                console.log(`      userId зрителя: "${userId}"`);
                console.log(`      Совпадение: ${tank.userId === userId}`);
                return tank;
            }
        }

        console.log(`❌ Танк с userId: "${userId}" не найден`);

        // Выводим список всех танков зрителей для отладки
        const viewerTanks = allTanks.filter(tank =>
        (tank.enemyType === 'VIEWER' || tank.isViewerTank) && !tank.isDestroyed
        );

        if (viewerTanks.length > 0) {
            console.log(`   Доступные танки зрителей:`);
            viewerTanks.forEach((tank, index) => {
                console.log(`   ${index}. "${tank.username}" - userId: "${tank.userId}"`);
            });
        } else {
            console.log(`   На поле нет танков зрителей`);
        }

        return null;
    }

    // 🔥 ПРОСТОЙ МЕТОД ДЛЯ СПАВНА ЗРИТЕЛЯ
    trySpawnViewerTank() {
        // ПРОВЕРКА НА ЗАВЕРШЕНИЕ РАУНДА
        if (this.game.levelComplete || this.game.gameOver) {
            return false;
        }

        // ВЫБИРАЕМ СЛУЧАЙНОГО ЗРИТЕЛЯ
        const selectedViewer = this.selectRandomViewer();

        if (!selectedViewer) {
            return false; // Нет доступных зрителей
        }

        // ДОБАВЛЯЕМ В ИГРАВШИХ В РАУНДЕ
        this.usedInRound.add(selectedViewer.userId);

        console.log(`🎮 Спавним танк зрителя: ${selectedViewer.username}`);

        // ИСПОЛЬЗУЕМ СУЩЕСТВУЮЩУЮ СИСТЕМУ СПАВНА
        this.spawnViewerTank(
            selectedViewer.userId,
            selectedViewer.username,
            selectedViewer.avatarUrl
        );

        return true;
    }

    // === ОБНОВЛЯЕМ ДОБАВЛЕНИЕ В МАССИВЫ ===
    addGiftViewer(userId, username, avatarUrl) {
        this.addOnlineViewer(userId, username, avatarUrl); // 🔥 ДОБАВЛЯЕМ В ОНЛАЙН
        this.addToPool('gifts', userId, username, avatarUrl);
        console.log(`🎁 Добавлен даритель: ${username}`);
    }

    addLikeViewer(userId, username, avatarUrl) {
        this.addOnlineViewer(userId, username, avatarUrl); // 🔥 ДОБАВЛЯЕМ В ОНЛАЙН
        this.addToPool('likes', userId, username, avatarUrl);
        console.log(`💖 Добавлен лайкер: ${username}`);
    }

    addSubscriberViewer(userId, username, avatarUrl) {
        this.addOnlineViewer(userId, username, avatarUrl); // 🔥 ДОБАВЛЯЕМ В ОНЛАЙН
        this.addToPool('subscribers', userId, username, avatarUrl);
        console.log(`⭐ Добавлен подписчик: ${username}`);
    }

    addActiveViewer(userId, username, avatarUrl) {
        this.addOnlineViewer(userId, username, avatarUrl); // 🔥 ДОБАВЛЯЕМ В ОНЛАЙН
        this.addToPool('viewers', userId, username, avatarUrl);
        console.log(`👀 Добавлен активный зритель: ${username}`);
    }

    // === ОБЩИЙ МЕТОД ДОБАВЛЕНИЯ В МАССИВ ===
    addToPool(poolName, userId, username, avatarUrl) {
        const pool = this.viewerPools[poolName];

        // Удаляем если уже есть (чтобы не было дубликатов)
        const existingIndex = pool.findIndex(viewer => viewer.userId === userId);
        if (existingIndex !== -1) {
            pool.splice(existingIndex, 1);
        }

        // Добавляем в начало
        pool.unshift({
            userId,
            username,
            avatarUrl,
            timestamp: Date.now()
        });

        // Ограничиваем размер массива
        if (pool.length > this.maxPoolSize) {
            pool.pop();
        }

        console.log(`📊 ${poolName}: ${pool.length}/${this.maxPoolSize}`);
    }

    // === ВЫБОР СЛУЧАЙНОГО ЗРИТЕЛЯ ПО ПРИОРИТЕТУ ===
    selectRandomViewer() {
        const priorityPools = ['gifts', 'likes', 'subscribers', 'viewers'];

        for (const poolName of priorityPools) {
            const pool = this.viewerPools[poolName];

            // Если массив не пустой
            if (pool.length > 0) {
                // 🔥 "Орёл или решка" - 50% шанс выбрать из этого массива
                if (Math.random() < 0.5) {
                    // Ищем доступного зрителя в этом массиве
                    const availableViewer = this.findAvailableViewer(pool);
                    if (availableViewer) {
                        console.log(`🎲 Выбран из ${poolName}: ${availableViewer.username}`);
                        return availableViewer;
                    }
                }
                // Если не выбрали (выпал 0 или нет доступных), переходим к следующему массиву
            }
        }

        // 🔥 Если ни в одном массиве не выбрали - ищем любого доступного зрителя
        for (const poolName of priorityPools) {
            const pool = this.viewerPools[poolName];
            const availableViewer = this.findAvailableViewer(pool);
            if (availableViewer) {
                console.log(`🎲 Выбран (без монетки) из ${poolName}: ${availableViewer.username}`);
                return availableViewer;
            }
        }

        return null; // Нет доступных зрителей
    }

    // === СПАВН ТАНКА ЗРИТЕЛЯ ===
    spawnViewerTankInsteadOfRegular() {
        // 🔥 ПРОВЕРЯЕМ ЛИМИТ ПОЛЯ
        if (this.game.enemyManager.enemies.length >= MAX_ENEMIES_ON_SCREEN) {
            return false;
        }

        // 🔥 ВЫБИРАЕМ СЛУЧАЙНОГО ЗРИТЕЛЯ
        const selectedViewer = this.selectRandomViewer();

        if (!selectedViewer) {
            console.log('📭 Нет доступных зрителей для спавна');
            return false;
        }

        // 🔥 ДОБАВЛЯЕМ В ИГРАВШИХ В РАУНДЕ
        this.usedInRound.add(selectedViewer.userId);

        console.log(`🎮 Спавним танк зрителя: ${selectedViewer.username}`);

        // 🔥 НЕПОСРЕДСТВЕННО СПАВНИМ ТАНК (без анимации через EnemyManager)
        this.executeSpawn(
            selectedViewer.userId,
            selectedViewer.username,
            selectedViewer.avatarUrl
        );

        return true;
    }

    // === ПОИСК ДОСТУПНОГО ЗРИТЕЛЯ (не игравшего в раунде) ===
    findAvailableViewer(pool) {
        const availableViewers = pool.filter(viewer =>
        !this.usedInRound.has(viewer.userId)
        );

        if (availableViewers.length === 0) return null;

        // Случайный выбор из доступных
        const randomIndex = Math.floor(Math.random() * availableViewers.length);
        return availableViewers[randomIndex];
    }

    // === ДОБАВЛЯЕМ ЗРИТЕЛЯ В ОНЛАЙН ===
    addOnlineViewer(userId, username, avatarUrl) {
        // 🔥 ТЕПЕРЬ this.onlineViewers ОПРЕДЕЛЕН
        if (!this.onlineViewers.has(userId)) {
            this.onlineViewers.set(userId, {
                userId,
                username,
                avatarUrl,
                joinTime: Date.now()
            });
            console.log(`👋 ${username} в онлайн (всего: ${this.onlineViewers.size})`);
        }
    }

    // Добавляем метод для установки TikTok интеграции
    setTikTokIntegration(tiktokIntegration) {
        this.tikTokIntegration = tiktokIntegration;
        this.isTikTokConnected = true;
        console.log('✅ TikTok интеграция установлена в ViewerSystem');
    }

    // 🔥 ОСНОВНОЙ МЕТОД СПАВНА (КОТОРЫЙ УЖЕ РАБОТАЕТ)
    spawnViewerTank(userId, username, avatarUrl) {
        // ПРОВЕРКА НА ЗАВЕРШЕНИЕ РАУНДА
        if (this.game.levelComplete || this.game.gameOver) {
            console.log('🚫 Раунд завершен!');
            return;
        }

        // ПРОВЕРКА НА ДУБЛИКАТ
        const existingViewerTank = this.game.enemyManager.enemies.find(enemy =>
        (enemy.enemyType === 'VIEWER' || enemy.isViewerTank) && enemy.userId === userId
        );

        if (existingViewerTank) {
            console.log(`🎮 Танк зрителя ${username} уже существует!`);
            return;
        }

        // ПРОВЕРКА НА УНИЧТОЖЕНИЕ В ЭТОМ РАУНДЕ
        if (this.destroyedViewerTanks.has(userId)) {
            console.log(`🎮 Танк зрителя ${username} уже был уничтожен!`);
            return;
        }

        // ДОБАВЛЯЕМ В ОНЛАЙН И СПАВНИМ
        this.addOnlineViewer(userId, username, avatarUrl);
        this.executeSpawn(userId, username, avatarUrl);
    }

    // === СЛУЧАЙНЫЙ ВЫБОР ПРИ ОБЫЧНОМ СПАВНЕ ===
    trySpawnRandomViewer() {
        // 🔥 ПРОВЕРЯЕМ ЛИМИТ ПОЛЯ
        if (this.game.enemyManager.enemies.length >= MAX_ENEMIES_ON_SCREEN) {
            console.log('🚫 Лимит поля достигнут');
            return false;
        }

        // 🔥 ДИАГНОСТИКА: сколько всего зрителей онлайн
        console.log(`🔍 ДИАГНОСТИКА: Всего онлайн: ${this.onlineViewers.size}`);

        // 🔥 ИЩЕМ ДОСТУПНЫХ ЗРИТЕЛЕЙ
        const availableViewers = Array.from(this.onlineViewers.values()).filter(viewer => {
            const wasDestroyed = this.destroyedViewerTanks.has(viewer.userId);
            const isOnField = this.game.enemyManager.enemies.find(enemy =>
            (enemy.enemyType === 'VIEWER' || enemy.isViewerTank) &&
            enemy.userId === viewer.userId
            );

            console.log(`🔍 ${viewer.username}: уничтожен=${wasDestroyed}, на поле=${!!isOnField}`);

            return !wasDestroyed && !isOnField;
        });

        console.log(`🔍 Доступно зрителей: ${availableViewers.length}`);

        if (availableViewers.length === 0) {
            console.log('📭 Нет доступных зрителей для спавна');
            return false;
        }

        // 🔥 ВЫБИРАЕМ СЛУЧАЙНОГО ЗРИТЕЛЯ
        const randomIndex = Math.floor(Math.random() * availableViewers.length);
        const selectedViewer = availableViewers[randomIndex];

        console.log(`🎲 Случайный выбор: ${selectedViewer.username}`);

        // СПАВНИМ ВЫБРАННОГО ЗРИТЕЛЯ
        this.executeSpawn(
            selectedViewer.userId,
            selectedViewer.username,
            selectedViewer.avatarUrl
        );

        return true;
    }

    // === ПРОСТАЯ ПРОВЕРКА ДОСТУПНОСТИ ===
    canSpawnViewerTank() {
        // 1. Проверяем лимит поля
        if (this.game.enemyManager.enemies.length >= MAX_ENEMIES_ON_SCREEN) {
            return false;
        }

        // 2. Проверяем лимит раунда
        const totalCreated = (this.game.enemyManager.destroyedEnemies || 0) + this.game.enemyManager.enemies.length;
        if (totalCreated >= TOTAL_ENEMIES_PER_LEVEL) {
            return false;
        }

        return true;
    }

    // === ДОБАВИМ ДЕБАГ ИНФОРМАЦИЮ ===
    getDebugInfo() {
        const regularEnemies = this.game.enemyManager.enemies.filter(enemy =>
        !enemy.isViewerTank && enemy.enemyType !== 'VIEWER'
        );
        const viewerTanks = this.game.enemyManager.enemies.filter(enemy =>
        enemy.isViewerTank || enemy.enemyType === 'VIEWER'
        );

        return {
            regularEnemies: regularEnemies.length,
            viewerTanks: viewerTanks.length,
            currentViewerTanks: this.currentViewerTanks,
            maxViewerTanks: this.maxViewerTanks,
            pendingSpawns: this.pendingSpawns.length,
            destroyedViewerTanks: this.destroyedViewerTanks.size
        };
    }

    // === ОБНОВЛЯЕМ executeSpawn (где вызывается этот метод) ===
    executeSpawn(userId, username, avatarUrl) {
        const spawnPoint = this.game.enemyManager.getNextSpawnPoint();

        // Создаем анимацию спавна
        const spawnAnimation = new SpawnAnimation(spawnPoint.x, spawnPoint.y);
        this.game.enemyManager.spawnAnimations.push(spawnAnimation);

        // ПРЕДЗАГРУЗКА АВАТАРКИ
        if (avatarUrl && avatarUrl !== '') {
            this.preloadAvatar(userId, avatarUrl);
        }

        // Сохраняем оригинальный метод
        const originalComplete = this.game.enemyManager.completeSpawnAnimation.bind(this.game.enemyManager);

        // Временно заменяем метод completeSpawnAnimation
        this.game.enemyManager.completeSpawnAnimation = (position) => {
            // Восстанавливаем оригинальный метод
            this.game.enemyManager.completeSpawnAnimation = originalComplete;

            // 🔴 УБИРАЕМ ПРОВЕРКУ НА timeStopActive здесь!
            // ФИНАЛЬНАЯ ПРОВЕРКА
            const duplicateCheck = this.game.enemyManager.enemies.find(enemy =>
                (enemy.enemyType === 'VIEWER' || enemy.isViewerTank) && enemy.userId === userId
            );

            if (duplicateCheck) {
                console.log(`🎮 Танк зрителя ${username} уже создан! Отмена спавна.`);
                return;
            }

            if (this.destroyedViewerTanks.has(userId)) {
                console.log(`🎮 Танк зрителя ${username} был уничтожен! Отмена спавна.`);
                return;
            }

            // Создаем танк зрителя
            const viewerTank = new Tank(position.x, position.y, "enemy", this.game.level, 'VIEWER');

            // Кастомизация для зрителя
            viewerTank.username = username;
            viewerTank.userId = userId;
            viewerTank.avatarUrl = avatarUrl;
            viewerTank.viewerName = username;
            viewerTank.color = this.getViewerColor(userId);
            viewerTank.health = 2;
            viewerTank.isViewerTank = true;

            // 🔴 ВАЖНО: ПРИМЕНЯЕМ ЭФФЕКТ "СТОП-ВРЕМЕНИ" ЕСЛИ ОН АКТИВЕН
            // ТОЧНО ТАК ЖЕ КАК ДЛЯ ИИ ТАНКОВ!
            if (this.game.timeStopActive) {
                const remainingTime = this.game.timeStopDuration - (Date.now() - this.game.timeStopStartTime);
                if (remainingTime > 0) {
                    viewerTank.freeze(remainingTime);
                    console.log(`⏰ Танк зрителя ${username} заморожен на ${remainingTime}мс`);
                }
            }

            // ОПТИМИЗИРОВАННАЯ ЗАГРУЗКА АВАТАРКИ
            this.setupViewerTankAvatar(viewerTank, userId, avatarUrl);

            // 🔥 ДОБАВЛЯЕМ РЕГИСТРАЦИЮ ЗДЕСЬ
            if (this.game && this.game.currentRoundEnemies) {
                this.game.currentRoundEnemies.set(username, {
                    enemy: viewerTank,
                    spawnTime: Date.now(),
                    destroyed: false,
                    destroyTime: null,
                    finalStats: null
                });
            }

            // Добавляем в список врагов
            this.game.enemyManager.enemies.push(viewerTank);

            console.log(`🎮 Танк зрителя "${username}" создан!`);

            // Визуальный эффект
            this.game.effectManager.addExplosion(position.x, position.y, 'bonus');
            this.game.screenShake = 10;

            // 🔥 НАСТРАИВАЕМ ОБРАБОТЧИК УНИЧТОЖЕНИЯ
            this.setupTankDestructionHandler(viewerTank, userId, username);
        };

        let spawnDelay = 3000;

        if (this.game.timeStopActive) {
            spawnDelay = 3500;
            console.log(`⏰ Анимация спавна танка ${username} замедлена`);
        }

        // 🔴 УПРОЩАЕМ ТАЙМЕР: всегда вызываем completeSpawnAnimation
        setTimeout(() => {
            const index = this.game.enemyManager.spawnAnimations.indexOf(spawnAnimation);
            if (index !== -1) {
                this.game.enemyManager.spawnAnimations.splice(index, 1);

                // 🔴 ВСЕГДА ВЫЗЫВАЕМ, НЕ ЗАВИСИМО ОТ timeStopActive!
                this.game.enemyManager.completeSpawnAnimation(spawnPoint);
            }
        }, spawnDelay);
    }

    // === ДОБАВЛЯЕМ ОБРАБОТЧИК УНИЧТОЖЕНИЯ ТАНКА ===
    setupTankDestructionHandler(tank, userId, username) {
        const originalTakeDamage = tank.takeDamage.bind(tank);

        tank.takeDamage = function() {
            const result = originalTakeDamage();

            if (result && this.isDestroyed) {
                console.log(`💀 Уничтожен танк зрителя: ${username}`);

                // 🔥 ПРОСТО ОТМЕЧАЕМ КАК УНИЧТОЖЕННЫЙ
                if (game.viewerSystem) {
                    game.viewerSystem.destroyedViewerTanks.add(userId);
                    // Больше ничего не делаем - система сама будет спавнить через EnemyManager
                }
            }

            return result;
        };
    }

    // === ОБНОВЛЯЕМ ОТРИСОВКУ ИНФОРМАЦИИ ===
    drawViewerLimitInfo(ctx) {
        try {
            ctx.save();

            // Фон
            ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
            ctx.fillRect(10, CANVAS_HEIGHT - 120, 350, 110);

            // Заголовок
            ctx.fillStyle = '#FFFFFF';
            ctx.font = 'bold 14px Arial';
            ctx.textAlign = 'left';
            ctx.fillText('🎮 СИСТЕМА ЗРИТЕЛЕЙ', 20, CANVAS_HEIGHT - 100);

            // Статистика массивов
            ctx.font = '12px Arial';

            ctx.fillStyle = '#FF69B4';
            ctx.fillText(`🎁 Дарители: ${this.viewerPools.gifts.length}`, 20, CANVAS_HEIGHT - 80);

            ctx.fillStyle = '#FF4444';
            ctx.fillText(`💖 Лайкеры: ${this.viewerPools.likes.length}`, 20, CANVAS_HEIGHT - 60);

            ctx.fillStyle = '#FFD700';
            ctx.fillText(`⭐ Подписчики: ${this.viewerPools.subscribers.length}`, 20, CANVAS_HEIGHT - 40);

            ctx.fillStyle = '#00FF00';
            ctx.fillText(`👀 Активные: ${this.viewerPools.viewers.length}`, 20, CANVAS_HEIGHT - 20);

            ctx.restore();
        } catch (error) {
            console.error('❌ Ошибка в drawViewerLimitInfo:', error);
        }
    }

    // === ИСПРАВЛЕННЫЙ МЕТОД ОБНОВЛЕНИЯ ЛИМИТА ===
    updateViewerTankLimit() {
        if (!this.game.enemyManager) return;

        const MAX_ON_FIELD = MAX_ENEMIES_ON_SCREEN; // 1
        const TOTAL_PER_LEVEL = TOTAL_ENEMIES_PER_LEVEL; // 4

        // 1. Считаем сколько УЖЕ СОЗДАНО за раунд
        const destroyedCount = this.game.enemyManager.destroyedEnemies || 0;
        const onFieldCount = this.game.enemyManager.enemies.length;
        const totalCreated = destroyedCount + onFieldCount;

        // 2. Сколько ОСТАЛОСЬ СОЗДАТЬ до лимита раунда
        const remainingInRound = Math.max(0, TOTAL_PER_LEVEL - totalCreated);

        // 3. Сколько МЕСТ НА ПОЛЕ прямо сейчас
        const freeFieldSlots = Math.max(0, MAX_ON_FIELD - onFieldCount);

        // 4. 🔥 ВАЖНО: резервируем 1 слот для обычных врагов
        const reservedForRegular = 1;
        const availableForViewers = Math.max(0, freeFieldSlots - reservedForRegular);

        // 5. Лимит зрителей = минимум из: оставшихся в раунде и доступных слотов
        this.maxViewerTanks = Math.min(5, Math.min(remainingInRound, availableForViewers));

        this.currentViewerTanks = this.game.enemyManager.enemies.filter(e =>
        e.isViewerTank || e.enemyType === 'VIEWER'
        ).length;

        console.log(`🎯 Раунд: ${totalCreated}/${TOTAL_PER_LEVEL}, осталось: ${remainingInRound}`);
        console.log(`🎯 Поле: ${onFieldCount}/${MAX_ON_FIELD}, свободно: ${freeFieldSlots}`);
        console.log(`🎯 Для зрителей: ${availableForViewers} слотов`);
        console.log(`🎮 Лимит зрителей: ${this.currentViewerTanks}/${this.maxViewerTanks}`);
    }

    getRemainingEnemiesFromCounter() {
        // Парсим текст из UI счётчика "4 из 20"
        const tankCounter = document.getElementById('tanksLeft');
        if (tankCounter) {
            const text = tankCounter.textContent;
            const match = text.match(/(\d+)\s*\/\s*(\d+)/);
            if (match) {
                return parseInt(match[1]);
            }
        }

        // Если не получилось распарсить, используем логику из EnemyManager
        const totalEnemiesPerLevel = 20;
        const totalSpawnedSoFar = (this.game.enemyManager.destroyedEnemies || 0) + this.game.enemyManager.enemies.length;
        return Math.max(0, totalEnemiesPerLevel - totalSpawnedSoFar);
    }

    debugTankInfo(remainingEnemies, totalSpawnedSoFar) {
        const regularTanks = this.game.enemyManager.enemies.filter(e => !e.isViewerTank).length;
        const viewerTanks = this.game.enemyManager.enemies.filter(e => e.isViewerTank).length;

        console.log('🐛 ДЕТАЛЬНЫЙ ДЕБАГ:');
        console.log(`- Всего создано: ${totalSpawnedSoFar}`);
        console.log(`- Осталось создать: ${remainingEnemies}`);
        console.log(`- На поле: ${this.game.enemyManager.enemies.length} танков`);
        console.log(`  → Обычных: ${regularTanks}`);
        console.log(`  → Зрителей: ${viewerTanks}`);
        console.log(`- Текущие зрители: ${this.currentViewerTanks}/${this.maxViewerTanks}`);
        console.log(`- В очереди: ${this.pendingSpawns.length}`);
    }

    // === СИСТЕМА АВАТАРОК ===
    preloadAvatar(userId, avatarUrl) {
        if (!avatarUrl || this.avatarCache.has(userId)) return;

        console.log(`🔄 Предзагрузка аватарки для ${userId}`);
        const img = new Image();
        img.crossOrigin = "anonymous";

        img.onload = () => {
            console.log(`✅ Аватарка предзагружена для ${userId}`);
            this.avatarCache.set(userId, img);
            // Вызываем колбэки ожидающих танков
            if (this.avatarLoadCallbacks.has(userId)) {
                this.avatarLoadCallbacks.get(userId).forEach(callback => callback(img));
                this.avatarLoadCallbacks.delete(userId);
            }
        };

        img.onerror = () => {
            console.log(`❌ Ошибка предзагрузки аватарки для ${userId}`);
            this.avatarCache.set(userId, null); // Помечаем как неудачную загрузку
        };

        img.src = avatarUrl;
    }

    getCachedAvatar(userId) {
        return this.avatarCache.get(userId);
    }

    waitForAvatar(userId, callback) {
        if (this.avatarCache.has(userId)) {
            callback(this.avatarCache.get(userId));
        } else {
            if (!this.avatarLoadCallbacks.has(userId)) {
                this.avatarLoadCallbacks.set(userId, []);
            }
            this.avatarLoadCallbacks.get(userId).push(callback);
        }
    }

    setupViewerTankAvatar(tank, userId, avatarUrl) {
        tank.avatarLoaded = false;
        tank.avatarError = false;

        if (!avatarUrl || avatarUrl === '') {
            tank.avatarError = true;
            return;
        }

        // Пытаемся использовать кэшированную аватарку
        const cachedAvatar = this.getCachedAvatar(userId);
        if (cachedAvatar) {
            console.log(`✅ Используем кэшированную аватарку для ${tank.username}`);
            tank.avatarImage = cachedAvatar;
            tank.avatarLoaded = true;
        } else if (cachedAvatar === null) {
            // Помечаем как ошибку если загрузка ранее не удалась
            tank.avatarError = true;
        } else {
            // Ждем загрузки аватарки
            console.log(`⏳ Ожидаем загрузку аватарки для ${tank.username}`);
            this.waitForAvatar(userId, (loadedAvatar) => {
                if (loadedAvatar) {
                    tank.avatarImage = loadedAvatar;
                    tank.avatarLoaded = true;
                    console.log(`✅ Аватарка загружена для ${tank.username}`);
                } else {
                    tank.avatarError = true;
                    console.log(`❌ Аватарка не загрузилась для ${tank.username}`);
                }
            });
        }
    }

    // === СИСТЕМА ЛАЙКОВ ===
    handleLikeFromViewer(userId, username, message) {
        if (!this.game.player || this.game.player.isDestroyed) {
            console.log(`💖 ${username} лайкнул, но игрок уничтожен`);
            return;
        }

        // Добавляем опыт игроку за лайк
        const expGained = 5; // Опыт за лайк
        this.game.player.experience += expGained;
        this.game.playerExperience = this.game.player.experience;

        // Проверяем уровень ап
        const levelBefore = this.game.player.playerLevel;
        this.game.player.checkLevelUp();
        const levelAfter = this.game.player.playerLevel;

        // Визуальный эффект с именем отправителя
        const likeText = levelAfter > levelBefore
        ? `УРОВЕНЬ ${levelAfter}! ⭐`
        : `+${expGained} XP 💖`;

        this.createFloatingText(
            this.game.player.position.x,
            this.game.player.position.y - 20,
            `${username}: ${likeText}`,
            '#FF69B4'
        );

        // Дополнительный эффект при уровнепе
        if (levelAfter > levelBefore) {
            this.game.effectManager.addExplosion(this.game.player.position.x, this.game.player.position.y, 'bonus');
            this.game.screenShake = 15;
            console.log(`⭐ Игрок достиг уровня ${levelAfter}! Спасибо ${username} за лайки!`);
        }

        console.log(`💖 ${username} лайкнул! Игрок получает +${expGained} опыта!`);

        // Сохраняем прогресс
        this.game.savePlayerProgress();
        this.game.updatePlayerStats();
    }

    // === СИСТЕМА ПОДАРКОВ ===
    initGiftSystem() {
        // Инициализация системы подарков (если нужны дополнительные настройки)
        console.log('🎁 Система подарков инициализирована');
    }

    // ОБНОВИМ МЕТОД ОБРАБОТКИ ПОДАРКОВ
    handleGiftFromViewer(userId, username, message) {
        if (!this.game.player || this.game.player.isDestroyed) {
            console.log(`🎁 ${username} отправил подарок, но игрок уничтожен`);
            return;
        }

        // Определяем тип подарка из сообщения
        const giftType = this.detectGiftType(message);

        if (!giftType) {
            this.handleRandomGift(userId, username);
            return;
        }

        const giftConfig = GIFT_BONUSES[giftType];
        if (!giftConfig) {
            this.handleRandomGift(userId, username);
            return;
        }

        console.log(`🎁 ${username} отправил подарок: ${giftType}`);

        // ПРОВЕРЯЕМ - ЭТО ПРОКЛЯТИЕ ИЛИ БОНУС?
        if (giftConfig.isCurse) {
            this.handleCurseGift(userId, username, giftType, giftConfig);
        } else {
            this.handlePowerupGift(userId, username, giftType, giftConfig);
        }
    }

    // НОВЫЙ МЕТОД ДЛЯ ПРОКЛЯТИЙ
    handleCurseGift(userId, username, giftType, giftConfig) {
        if (giftConfig.bonusType === 'CURSE_FREEZE') {
            // ЗАМОРОЗКА
            this.freezePlayer(giftConfig.duration);
            this.createFloatingText(
                this.game.player.position.x,
                this.game.player.position.y - 40,
                `${giftConfig.message} ${username}`,
                '#00B4FF'
            );
            this.game.screenShake = 15;
            this.game.soundManager.play('playerFreeze');

        } else if (giftConfig.bonusType === 'CURSE_REVERSE') {
            // РЕВЕРС ДВИЖЕНИЯ
            this.reversePlayer(giftConfig.duration);
            this.createFloatingText(
                this.game.player.position.x,
                this.game.player.position.y - 40,
                `${giftConfig.message} ${username}`,
                '#00FF00'
            );
            this.game.screenShake = 10;
            this.game.soundManager.play('playerReverse');
        }

        console.log(`💀 Эффект "${giftConfig.bonusType}" на ${giftConfig.duration}мс от ${username}`);
    }

    // === СИСТЕМА РЕВЕРСА ДВИЖЕНИЯ ===
    reversePlayer(duration) {
        if (!this.game.player) return;

        this.playerReversed = true;
        this.reverseStartTime = Date.now();
        this.reverseDuration = duration;

        // ПОЛНАЯ СИНХРОНИЗАЦИЯ С ТАНКОМ (как в заморозке)
        this.game.player.isReversed = true;
        this.game.player.reverseStartTime = Date.now();
        this.game.player.reverseDuration = duration;
        this.game.player.originalSpeed = this.game.player.speed;
        this.game.player.originalCanShoot = this.game.player.canShoot;

        console.log('💀 Реверс движения активирован на ' + duration + 'мс!');
    }

    // МЕТОД ДЛЯ ПОЛУЧЕНИЯ НАПРАВЛЕНИЯ С УЧЕТОМ РЕВЕРСА
    getReversedDirection() {
        if (!this.playerReversed) return null;

        const originalDirection = this.game.getCurrentDirection();
        if (!originalDirection) return null;

        // ИНВЕРТИРУЕМ НАПРАВЛЕНИЕ
        return {
            UP: DIRECTIONS.DOWN,
            DOWN: DIRECTIONS.UP,
            LEFT: DIRECTIONS.RIGHT,
            RIGHT: DIRECTIONS.LEFT
        }[this.getDirectionName(originalDirection)];
    }

    // ВСПОМОГАТЕЛЬНЫЙ МЕТОД ДЛЯ ПОЛУЧЕНИЯ ИМЕНИ НАПРАВЛЕНИЯ
    getDirectionName(direction) {
        if (direction.x === 0 && direction.y === -1) return 'UP';
        if (direction.x === 0 && direction.y === 1) return 'DOWN';
        if (direction.x === -1 && direction.y === 0) return 'LEFT';
        if (direction.x === 1 && direction.y === 0) return 'RIGHT';
        return 'UNKNOWN';
    }

    // СОХРАНЕНИЕ ОРИГИНАЛЬНЫХ НАСТРОЕК КЛАВИШ
    saveOriginalKeyBindings() {
        this.originalKeys = {
            ArrowUp: this.game.keys['ArrowUp'],
            ArrowDown: this.game.keys['ArrowDown'],
            ArrowLeft: this.game.keys['ArrowLeft'],
            ArrowRight: this.game.keys['ArrowRight'],
            KeyW: this.game.keys['KeyW'],
            KeyS: this.game.keys['KeyS'],
            KeyA: this.game.keys['KeyA'],
            KeyD: this.game.keys['KeyD']
        };
    }

    // ПРИМЕНЕНИЕ РЕВЕРСНЫХ НАСТРОЕК КЛАВИШ
    applyReverseKeyBindings() {
        // Временно меняем обработку клавиш в игровом объекте
        const tempKeys = {...this.game.keys};

        // Перебинживаем стрелки
        tempKeys['ArrowUp'] = this.originalKeys['ArrowDown'];
        tempKeys['ArrowDown'] = this.originalKeys['ArrowUp'];
        tempKeys['ArrowLeft'] = this.originalKeys['ArrowRight'];
        tempKeys['ArrowRight'] = this.originalKeys['ArrowLeft'];

        // Перебинживаем WASD
        tempKeys['KeyW'] = this.originalKeys['KeyS'];
        tempKeys['KeyS'] = this.originalKeys['KeyW'];
        tempKeys['KeyA'] = this.originalKeys['KeyD'];
        tempKeys['KeyD'] = this.originalKeys['KeyA'];

        this.game.keys = tempKeys;
    }

    // ВОССТАНОВЛЕНИЕ ОРИГИНАЛЬНЫХ НАСТРОЕК КЛАВИШ
    restoreOriginalKeyBindings() {
        if (this.originalKeys) {
            this.game.keys = {...this.originalKeys};
            this.originalKeys = null;
        }
    }

    // СОЗДАНИЕ ЧАСТИЦ ОТРАВЛЕНИЯ
    createReverseParticles() {
        this.reverseParticles = [];

        // Сразу создаем много частиц для непрерывного эффекта
        for (let i = 0; i < 30; i++) {
            this.addReverseParticle();
        }
    }

    addReverseParticle() {
        const angle = Math.random() * Math.PI * 2;
        const distance = 20 + Math.random() * 40;

        this.reverseParticles.push({
            x: Math.cos(angle) * distance,
                                   y: Math.sin(angle) * distance,
                                   size: 2 + Math.random() * 4,
                                   startSize: 2 + Math.random() * 4,
                                   life: 1.0,
                                   maxLife: 60 + Math.random() * 60,
                                   speed: 0.2 + Math.random() * 0.3,
                                   angle: angle,
                                   rotation: Math.random() * Math.PI * 2,
                                   alpha: 0.6 + Math.random() * 0.4
        });
    }



    // ОБНОВЛЕНИЕ СОСТОЯНИЯ РЕВЕРСА
    updateReverseState() {
        if (!this.playerReversed) return;

        const currentTime = Date.now();
        const elapsed = currentTime - this.reverseStartTime;
        const progress = elapsed / this.reverseDuration;

        // СОЗДАЕМ ЧАСТИЦЫ ПОСТОЯННО (как в заморозке)
        if (Math.random() < 0.05) {
            this.createReverseParticle();
        }

        // ОБНОВЛЯЕМ ЧАСТИЦЫ
        for (let i = this.reverseParticles.length - 1; i >= 0; i--) {
            const particle = this.reverseParticles[i];
            particle.life -= 0.008;

            if (particle.life <= 0) {
                this.reverseParticles.splice(i, 1);
            } else {
                particle.alpha = particle.life;
                particle.rotation += 0.02;
                // Легкое движение частиц
                particle.y -= 0.5;
                particle.x += Math.sin(particle.wave) * 0.3;
            }
        }

        // ЗАВЕРШЕНИЕ ТОЛЬКО ПО ТАЙМЕРУ (как в заморозке)
        if (progress >= 1) {
            this.unreversePlayer();
        }
    }


    spawnParticlesBatch() {
        if (!this.game.player || this.game.player.isDestroyed) return;

        // ОПРЕДЕЛЯЕМ КОЛИЧЕСТВО ЧАСТИЦ: 1-5
        const minParticles = 1;
        const maxParticles = this.game.isPlayerMoving ? 5 : 3;
        const particleCount = minParticles + Math.floor(Math.random() * (maxParticles - minParticles + 1));

        console.log(`🎯 Создаем ${particleCount} частиц реверса`);

        for (let i = 0; i < particleCount; i++) {
            this.createSmokeParticle();
        }
    }

    createSmokeParticle() {
        const currentTime = Date.now();
        const offsetX = (Math.random() - 0.5) * this.game.player.size * 0.8;
        const offsetY = (Math.random() - 0.5) * this.game.player.size * 0.6 - this.game.player.size * 0.3;

        this.reverseParticles.push({
            x: offsetX,
            y: offsetY,
            size: 4 + Math.random() * 3,
                                   startSize: 4 + Math.random() * 3,
                                   life: 1.0,
                                   speed: 0.15 + Math.random() * 0.25,
                                   wave: Math.random() * Math.PI * 2,
                                   rotation: Math.random() * Math.PI * 2,
                                   alpha: 0.8,
                                   spawnTime: currentTime, // ВРЕМЯ СОЗДАНИЯ
                                   type: 'smoke_ring'
        });
    }

    startReverseEnding() {
        this.playerReversed = false;
        this.reverseEnding = true;
        this.reverseEndTime = Date.now();

        // УБИРАЕМ ЭФФЕКТ С ТАНКА
        if (this.game.player) {
            this.game.player.isReversed = false;
        }

        console.log('💫 Начинаем плавное завершение реверса...');
    }

    completeReverseEnding() {
        this.playerReversed = false;
        this.reverseShouldEnd = false;
        this.reverseParticles = [];

        // УБИРАЕМ ЭФФЕКТ С ТАНКА
        if (this.game.player) {
            this.game.player.isReversed = false;
        }

        this.game.soundManager.play('playerUnfreeze');

        this.createFloatingText(
            this.game.player.position.x,
            this.game.player.position.y - 20,
            '🔄 Управление восстановлено!',
            '#00FF00'
        );

        console.log('🔄 Реверс движения полностью завершен!');
    }

    // ФИНАЛЬНЫЙ ЭФФЕКТ ПРЕКРАЩЕНИЯ РЕВЕРСА
    startReverseEndEffect() {
        this.reverseEndEffect = true;
        this.reverseEndStartTime = Date.now();

        // Создаем взрыв частиц для финального эффекта
        for (let i = 0; i < 15; i++) {
            this.createReverseEndParticle();
        }

        console.log('💫 Запускаем финальный эффект реверса...');
    }

    // ОБНОВЛЕНИЕ ФИНАЛЬНОГО ЭФФЕКТА
    updateReverseEndEffect() {
        if (!this.reverseEndEffect) return;

        const elapsed = Date.now() - this.reverseEndStartTime;

        // Финальный эффект длится 1 секунду
        if (elapsed >= 1000) {
            this.reverseEndEffect = false;
        }
    }

    // ЧАСТИЦЫ ДЛЯ ФИНАЛЬНОГО ЭФФЕКТА
    createReverseEndParticle() {
        const angle = Math.random() * Math.PI * 2;
        const speed = 2 + Math.random() * 2;

        this.reverseParticles.push({
            x: 0,
            y: 0,
            size: 4 + Math.random() * 4,
                                   startSize: 4 + Math.random() * 4,
                                   life: 1.0,
                                   speed: speed,
                                   angle: angle,
                                   rotation: Math.random() * Math.PI * 2,
                                   alpha: 1.0,
                                   type: 'end_ring' // Особый тип для финальных частиц
        });
    }

    createReverseParticle() {
        if (!this.game.player || this.reverseParticles.length > 40) return;

        const offsetX = (Math.random() - 0.5) * this.game.player.size * 1.2;
        const offsetY = (Math.random() - 0.5) * this.game.player.size * 1.2;

        this.reverseParticles.push({
            x: offsetX,
            y: offsetY,
            size: 4 + Math.random() * 4,
                                   life: 0.8 + Math.random() * 0.4,
                                   rotation: Math.random() * Math.PI * 2,
                                   alpha: 1.0,
                                   wave: Math.random() * Math.PI * 2
        });
    }

    // ЗАВЕРШЕНИЕ РЕВЕРСА
    unreversePlayer() {
        this.playerReversed = false;

        // ПОЛНАЯ СИНХРОНИЗАЦИЯ С ТАНКОМ (как в заморозке)
        if (this.game.player) {
            this.game.player.isReversed = false;
            this.game.player.speed = this.game.player.originalSpeed;
            this.game.player.canShoot = this.game.player.originalCanShoot;
        }

        this.reverseParticles = [];

        this.game.soundManager.play('playerUnfreeze');

        this.createFloatingText(
            this.game.player.position.x,
            this.game.player.position.y - 20,
            '🔄 Управление восстановлено!',
            '#00FF00'
        );

        console.log('🔄 Реверс движения завершен!');
    }

    // ЦВЕТ ДЛЯ ПРОКЛЯТИЙ
    getCurseColor(giftType) {
        const colors = {
            'ice': '#00B4FF',
            'skull': '#FF4444'
        };
        return colors[giftType] || '#FF4444';
    }

    // МЕТОД ЗАМОРОЗКИ ИГРОКА
    freezePlayer(duration) {
        this.playerFrozen = true;
        this.freezeStartTime = Date.now();
        this.freezeDuration = duration;

        // Визуальный эффект на самом игроке
        if (this.game.player) {
            this.game.player.isFrozen = true;
            this.game.player.freezeStartTime = Date.now();
            this.game.player.freezeDuration = duration;
            this.game.player.originalSpeed = this.game.player.speed;
            this.game.player.originalCanShoot = this.game.player.canShoot;
            this.game.player.speed = 0;
            this.game.player.canShoot = false;
            this.game.player.createIceCrystals();
        }

        // ГЛУШИМ ДВИГАТЕЛЬ
        this.muteEngineDuringFreeze();
    }


    // ГЛУШЕНИЕ ДВИГАТЕЛЯ НА ВРЕМЯ ЗАМОРОЗКИ
    muteEngineDuringFreeze() {
        if (this.game.soundManager) {
            // Останавливаем оба звука двигателя
            this.game.soundManager.stopLoop('engineIdle');
            this.game.soundManager.stopLoop('engineMoving');

            // Сохраняем состояние двигателя до заморозки
            this.wasEngineMoving = this.game.isPlayerMoving;
        }
    }

    // ВОССТАНОВЛЕНИЕ ДВИГАТЕЛЯ ПОСЛЕ РАЗМОРОЗКИ
    restoreEngineAfterFreeze() {
        if (this.game.soundManager && this.game.player && !this.game.player.isDestroyed) {
            // Восстанавливаем звук двигателя в зависимости от состояния движения
            if (this.wasEngineMoving) {
                this.game.soundManager.playLoop('engineMoving');
            } else {
                this.game.soundManager.playLoop('engineIdle');
            }
        }
    }


    // СОЗДАНИЕ ЧАСТИЦ ЛЬДА
    createIceParticles() {
        this.freezeParticles = [];
        const particleCount = 20;

        for (let i = 0; i < particleCount; i++) {
            this.freezeParticles.push({
                x: (Math.random() - 0.5) * 100,
                                      y: (Math.random() - 0.5) * 100,
                                      size: 3 + Math.random() * 8,
                                      speed: 0.5 + Math.random() * 2,
                                      angle: Math.random() * Math.PI * 2,
                                      rotation: Math.random() * Math.PI * 2,
                                      rotationSpeed: (Math.random() - 0.5) * 0.2,
                                      alpha: 0.8 + Math.random() * 0.2,
                                      life: 1.0
            });
        }
    }

    // ОБНОВЛЕНИЕ СОСТОЯНИЯ ЗАМОРОЗКИ
    updateFreezeState() {
        if (!this.playerFrozen) return;

        const elapsed = Date.now() - this.freezeStartTime;
        const progress = elapsed / this.freezeDuration;

        if (progress >= 1) {
            // РАЗМОРАЖИВАЕМ ИГРОКА
            this.unfreezePlayer();
        } else if (progress > 0.9) {
            // Мерцание перед разморозкой
            const blink = Math.floor(Date.now() / 150) % 2 === 0;
            if (blink && this.game.player) {
                this.game.player.isFrozen = !this.game.player.isFrozen;
            }
        }
    }

    // РАЗМОРОЗКА ИГРОКА (ОБНОВЛЕННАЯ)
    unfreezePlayer() {
        this.playerFrozen = false;

        // ВОССТАНАВЛИВАЕМ ВОЗМОЖНОСТЬ ДВИГАТЬСЯ И СТРЕЛЯТЬ СРАЗУ
        if (this.game.player) {
            this.game.player.isFrozen = false;
            this.game.player.speed = this.game.player.originalSpeed;
            this.game.player.canShoot = this.game.player.originalCanShoot;
            this.game.player.iceCrystals = [];
        }

        // ВОССТАНАВЛИВАЕМ ДВИГАТЕЛЬ
        this.restoreEngineAfterFreeze();

        // ПРОИГРЫВАЕМ ЗВУК РАЗМОРОЗКИ ТОЛЬКО ОДИН РАЗ
        this.game.soundManager.play('playerUnfreeze');

        this.createFloatingText(
            this.game.player.position.x,
            this.game.player.position.y - 20,
            '✨ Разморозка!',
            '#00FFFF'
        );

        console.log('✨ Игрок разморожен! Двигатель восстановлен.');
    }

    // РАЗМОРОЗКА ПРИ СМЕРТИ (ОБНОВЛЕННАЯ)
    unfreezeOnDeath() {
        if (this.playerFrozen) {
            this.playerFrozen = false;

            if (this.game.player) {
                this.game.player.isFrozen = false;
                this.game.player.speed = this.game.player.originalSpeed;
                this.game.player.canShoot = this.game.player.originalCanShoot;
                this.game.player.iceCrystals = [];
            }

            this.restoreEngineAfterFreeze();
            this.game.soundManager.play('playerUnfreeze');
        }

        if (this.playerReversed) {
            this.playerReversed = false;
            this.reverseParticles = [];

            if (this.game.player) {
                this.game.player.isReversed = false;
            }
        }
    }

    // СОЗДАНИЕ ЭФФЕКТА ЗАМОРОЗКИ
    createFreezeEffect() {
        // Добавляем волну заморозки
        this.game.effectManager.addTimeWave(
            this.game.player.position.x,
            this.game.player.position.y,
            this.freezeDuration
        );
    }

    handlePowerupGift(userId, username, giftType, giftConfig) {
        // Создаем бонус на карте используя существующий тип
        const position = this.game.bonusManager.findFreeBonusPosition();
        if (position) {
            const bonus = new Bonus(
                position.x,
                position.y,
                giftConfig.bonusType, // Используем существующий тип бонуса
                this.game
            );

            // Увеличиваем время жизни бонуса
            bonus.lifetime = 15000;
            bonus.giftedBy = username; // Добавляем информацию о дарителе

            this.game.bonusManager.bonuses.push(bonus);
        }

        // Визуальный эффект и сообщение
        this.createFloatingText(
            this.game.player.position.x,
            this.game.player.position.y,
            `${giftConfig.message} ${username}`,
            this.getGiftColor(giftType)
        );

        this.game.screenShake = 8;
        this.game.soundManager.play('bonusPickup');

        console.log(`🎁 Создан бонус ${giftConfig.bonusType.id} от ${username}`);
    }

    detectGiftType(message) {
        const cleanMessage = message.toLowerCase();

        for (const [giftKey, keywords] of Object.entries(GIFT_TYPES)) {
            if (keywords.some(keyword => cleanMessage.includes(keyword))) {
                return giftKey;
            }
        }

        return null;
    }

    handleRandomGift(userId, username) {
        const randomGifts = ['rose', 'coin', 'diamond', 'cake'];
        const randomGift = randomGifts[Math.floor(Math.random() * randomGifts.length)];
        const giftConfig = GIFT_BONUSES[randomGift];

        this.handlePowerupGift(userId, username, randomGift, giftConfig);
    }

    // === СИСТЕМА ВСПЛЫВАЮЩИХ ТЕКСТОВ ===
    createFloatingText(x, y, text, color = '#FFFFFF') {
        this.floatingTexts.push({
            x: x,
            y: y,
            text: text,
            color: color,
            lifetime: 120, // 2 секунды при 60 FPS
            alpha: 1.0,
            velocity: new Vector2(0, -1.5), // Двигается вверх
                                scale: 1.0,
                                fontSize: 16,
                                originalSize: 16,
                                startX: x // Сохраняем начальную позицию для раскачивания
        });
    }

    updateFloatingTexts() {
        const currentTime = Date.now(); // ВЫНЕСИТЕ ОДИН РАЗ В НАЧАЛЕ

        for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
            const text = this.floatingTexts[i];
            text.lifetime--;

            text.alpha = Math.max(0, text.lifetime / 60);

            // ИСПОЛЬЗУЙТЕ ЕДИНОЕ ВРЕМЯ currentTime
            const swing = Math.sin(currentTime * 0.01 + i) * 2;
            text.x = text.startX + swing;
            text.y -= 1;

            const sizeProgress = Math.sin((text.lifetime / 120) * Math.PI);
            text.fontSize = text.originalSize * (0.8 + sizeProgress * 0.2);

            if (text.lifetime <= 0) {
                this.floatingTexts.splice(i, 1);
            }
        }
    }

    drawFloatingTexts(ctx) {
        if (this.floatingTexts.length === 0) return;

        ctx.save();

        this.floatingTexts.forEach(text => {
            // Тень
            ctx.fillStyle = 'rgba(0, 0, 0, ' + (text.alpha * 0.7) + ')';
            ctx.font = `bold ${text.fontSize}px Arial`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(text.text, text.x + 2, text.y + 2);

            // Основной текст
            ctx.fillStyle = text.color.replace(')', ', ' + text.alpha + ')').replace('rgb', 'rgba');
            ctx.fillText(text.text, text.x, text.y);
        });

        ctx.restore();
    }

    drawEffects(ctx) {
        this.drawFreezeEffect(ctx);
        this.drawReverseEffect(ctx);
    }

    // === УТИЛИТЫ ===
    getViewerColor(userId) {
        const colors = [
            '#FF69B4', // Розовый
            '#9370DB', // Фиолетовый
            '#00CED1', // Бирюзовый
            '#32CD32', // Лаймовый
            '#FFD700', // Золотой
            '#FF6347', // Томатный
            '#1E90FF', // Голубой
            '#FF8C00'  // Оранжевый
        ];

        // Простой хэш для получения индекса цвета
        let hash = 0;
        for (let i = 0; i < userId.length; i++) {
            hash = ((hash << 5) - hash) + userId.charCodeAt(i);
            hash = hash & hash;
        }

        return colors[Math.abs(hash) % colors.length];
    }

    getGiftColor(giftType) {
        const colors = {
            'rose': '#FF69B4',
            'coin': '#FFD700',
            'diamond': '#00FFFF',
            'cake': '#FF6B6B',
            'crown': '#FFA500',
            'rocket': '#9370DB',
            'super_star': '#FFFF00'
        };
        return colors[giftType] || '#FFFFFF';
    }

    getGiftSymbol(giftType) {
        const symbols = {
            'rose': '🌹',
            'coin': '🪙',
            'diamond': '💎',
            'cake': '🎂',
            'crown': '👑',
            'rocket': '🚀',
            'super_star': '⭐'
        };
        return symbols[giftType] || '🎁';
    }

    // === УПРАВЛЕНИЕ СОСТОЯНИЕМ ===
    markViewerTankDestroyed(userId) {
        this.destroyedViewerTanks.add(userId);

        // ДОБАВИТЬ: Обновление статистики
        const viewerTank = this.viewerTanks.get(userId);
        if (viewerTank && game) {
            game.markEnemyDestroyed(viewerTank);
        }
    }

    resetForNewRound() {
        this.destroyedViewerTanks.clear();
        this.floatingTexts = [];
        this.usedInRound.clear(); // 🔥 ОЧИЩАЕМ ИГРАВШИХ В РАУНДЕ

        console.log('🔄 Система зрителей сброшена для нового раунда');
        this.debugPoolsInfo();
    }

    debugPoolsInfo() {
        console.log('📊 Статистика массивов:');
        Object.entries(this.viewerPools).forEach(([poolName, pool]) => {
            console.log(`   ${poolName}: ${pool.length} зрителей`);
        });
        console.log(`   Играло в раунде: ${this.usedInRound.size}`);
    }

    clearAvatarCache() {
        this.avatarCache.clear();
        this.avatarLoadCallbacks.clear();
    }

    // === ОБНОВЛЕНИЕ СИСТЕМЫ ===
    update() {
        this.updateFreezeState();
        this.updateReverseState();
        this.updateFloatingTexts();

        // 🔥 УБРАЛИ ЛОГИКУ ОЧЕРЕДИ - больше не нужно

        if (this.delayedSpawn && !this.game.timeStopActive) {
            this.delayedSpawn.callback();
            this.delayedSpawn = null;
        }
    }

    drawReverseEffect(ctx) {
        // РИСУЕМ ЕСЛИ ЭФФЕКТ АКТИВЕН ИЛИ ЗАВЕРШАЕТСЯ
        if (!this.playerReversed && !this.reverseShouldEnd) return;

        ctx.save();
        ctx.translate(this.game.player.position.x, this.game.player.position.y);

        // ОТРИСОВЫВАЕМ ВСЕ ЧАСТИЦЫ
        this.reverseParticles.forEach(particle => {
            ctx.save();
            ctx.translate(particle.x, particle.y);
            ctx.rotate(particle.rotation);
            ctx.globalAlpha = particle.alpha;

            ctx.strokeStyle = '#32CD32';
            ctx.lineWidth = 1;
            ctx.setLineDash([2, 3]);

            ctx.beginPath();
            ctx.arc(0, 0, particle.size, 0, Math.PI * 2);
            ctx.stroke();

            ctx.fillStyle = 'rgba(50, 205, 50, 0.1)';
            ctx.beginPath();
            ctx.arc(0, 0, particle.size, 0, Math.PI * 2);
            ctx.fill();

            ctx.restore();
        });

        // СВЕЧЕНИЕ ВОКРУГ ТАНКА ТОЛЬКО КОГДА ЭФФЕКТ АКТИВЕН
        if (this.playerReversed) {
            const gradient = ctx.createRadialGradient(0, 0, 20, 0, 0, 60);
            gradient.addColorStop(0, 'rgba(50, 255, 50, 0.2)');
            gradient.addColorStop(1, 'rgba(50, 255, 50, 0)');

            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(0, 0, 60, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.restore();
    }


    drawFreezeEffect(ctx) {
        if (!this.playerFrozen) return;

        // Только синее свечение вокруг игрока (как у врагов)
        ctx.save();
        ctx.translate(this.game.player.position.x, this.game.player.position.y);

        const glowIntensity = 0.3;
        const gradient = ctx.createRadialGradient(0, 0, 20, 0, 0, 80);
        gradient.addColorStop(0, `rgba(100, 200, 255, ${glowIntensity})`);
        gradient.addColorStop(1, 'rgba(100, 200, 255, 0)');

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(0, 0, 80, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }
}
