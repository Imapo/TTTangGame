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

    startWebSocketServer() {
    try {
        // 🔥 ПРИНИМАЕМ ВСЕ ПОДКЛЮЧЕНИЯ (не только localhost)
        this.wss = new WebSocket.Server({ 
            port: this.port,
            host: '0.0.0.0'  // Принимаем все IP
        });
        
        console.log('✅ WebSocket сервер запущен на порту ' + this.port);
        console.log('🌐 Доступен по:');
        console.log('   - ws://localhost:' + this.port);
        console.log('   - ws://192.168.10.15:' + this.port);
        
        this.wss.on('connection', (ws, req) => {
            const clientIP = req.socket.remoteAddress;
            console.log('🎮 Игра подключена с IP: ' + clientIP);
            this.clients.add(ws);
            
            // 🔥 ОТПРАВЛЯЕМ ПРИВЕТСТВЕННОЕ СООБЩЕНИЕ
            ws.send(JSON.stringify({
                type: 'welcome',
                message: 'Connected to TikTok Server',
                serverTime: Date.now()
            }));
            
            ws.on('close', () => {
                console.log('🎮 Игра отключилась: ' + clientIP);
                this.clients.delete(ws);
            });
            
            ws.on('message', (message) => {
                console.log('📥 Сообщение от игры:', message.toString());
            });
        });
        
    } catch (error) {
        console.error('❌ Ошибка сервера:', error.message);
        process.exit(1);
    }
}

    broadcast(data) {
        const message = JSON.stringify(data);
        this.clients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(message);
            }
        });
    }

    async connectToTikTok(username) {
        try {
            console.log('Connecting to TikTok: ' + username);
            
            this.tiktokConnection = new WebcastPushConnection(username, {
                enableExtendedGiftInfo: true,
                processInitialData: true
            });

            const state = await this.tiktokConnection.connect();
            console.log('Successfully connected!');
            console.log('Room: ' + state.roomId);
            console.log('Streamer: ' + (state.owner?.nickname || username));
            
            this.setupTikTokHandlers();
            return true;
            
        } catch (error) {
            console.error('Connection error:', error.message);
            console.log('');
            console.log('Possible reasons:');
            console.log('1. Streamer is not live');
            console.log('2. Wrong username');
            console.log('3. Network issues');
            return false;
        }
    }

    setupTikTokHandlers() {
        // CHAT
        this.tiktokConnection.on('chat', data => {
            console.log('CHAT ' + data.nickname + ': ' + data.comment);
            
            this.broadcast({
                type: 'viewer_activity',
                userId: data.uniqueId,
                username: data.nickname,
                avatar: data.profilePictureUrl || '',
                activity: 'chat'
            });

            // Command !tank
            if (data.comment.toLowerCase().includes('!танк') || 
                data.comment.toLowerCase().includes('!tank')) {
                
                console.log('!TANK command from ' + data.nickname);
                
                this.broadcast({
                    type: 'spawn_tank',
                    userId: data.uniqueId,
                    username: data.nickname,
                    avatar: data.profilePictureUrl || ''
                });
            }
        });

        // LIKES
        this.tiktokConnection.on('like', data => {
            console.log('LIKE ' + data.nickname);
            
            this.broadcast({
                type: 'viewer_activity',
                userId: data.uniqueId,
                username: data.nickname,
                avatar: data.profilePictureUrl || '',
                activity: 'like'
            });
        });

        // GIFTS
        this.tiktokConnection.on('gift', data => {
            console.log('GIFT ' + data.nickname + ': ' + data.giftName + ' (x' + data.repeatCount + ')');
            
            if (data.repeatEnd || data.repeatCount === 1) {
                this.broadcast({
                    type: 'viewer_activity',
                    userId: data.uniqueId,
                    username: data.nickname,
                    avatar: data.profilePictureUrl || '',
                    activity: 'gift',
                    giftName: data.giftName
                });
            }
        });

        // NEW VIEWERS
        this.tiktokConnection.on('member', data => {
            console.log('MEMBER ' + data.nickname + ' joined');
            
            this.broadcast({
                type: 'viewer_activity',
                userId: data.uniqueId,
                username: data.nickname,
                avatar: data.profilePictureUrl || '',
                activity: 'member'
            });
        });

        // SUBSCRIPTIONS
        this.tiktokConnection.on('subscribe', data => {
            console.log('SUBSCRIBE ' + data.nickname + ' subscribed');
            
            this.broadcast({
                type: 'viewer_activity',
                userId: data.uniqueId,
                username: data.nickname,
                avatar: data.profilePictureUrl || '',
                activity: 'subscribe'
            });
        });

        // ERRORS
        this.tiktokConnection.on('error', (err) => {
            console.error('TikTok error:', err.message);
        });

        this.tiktokConnection.on('disconnected', () => {
            console.log('Disconnected from TikTok');
        });
    }

    async start(username) {
        console.log('==============================');
        console.log('TIKTOK LIVE CONNECTOR - WINDOWS');
        console.log('==============================');
        console.log('');
        
        this.startWebSocketServer();
        
        if (username) {
            const connected = await this.connectToTikTok(username);
            if (!connected) {
                console.log('');
                console.log('Usage:');
                console.log('  node tiktok-server.js streamer_username');
                console.log('  node tiktok-server.js username 8081 (if port 8080 is busy)');
                return;
            }
        }
        
        console.log('');
        console.log('SYSTEM READY!');
        console.log('Open game in browser: http://localhost:3000');
        console.log('Viewers type "!tank" to spawn tank');
        console.log('');
        console.log('==============================');
        console.log('Press Ctrl+C to stop server');
        console.log('==============================');
    }

    stop() {
        if (this.tiktokConnection) {
            this.tiktokConnection.disconnect();
        }
        if (this.wss) {
            this.wss.close();
        }
        console.log('Server stopped');
    }
}

// START
if (require.main === module) {
    const username = process.argv[2];
    const port = process.argv[3] || 8080;
    
    if (!username) {
        console.log('Specify streamer username!');
        console.log('');
        console.log('Examples:');
        console.log('  node tiktok-server.js streamer_username');
        console.log('  node tiktok-server.js username 8081');
        console.log('');
        console.log('How to find username:');
        console.log('  https://www.tiktok.com/@username/live');
        console.log('                        ^ here');
        console.log('');
        console.log('For test without TikTok:');
        console.log('  node tiktok-server.js test');
        process.exit(1);
    }
    
    const server = new TikTokServer(parseInt(port));
    
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
        console.log('');
        console.log('Stopping server...');
        server.stop();
        process.exit(0);
    });
    
    server.start(username);
}

module.exports = TikTokServer;