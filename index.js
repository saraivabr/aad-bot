require('dotenv').config();
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const { handleMessage } = require('./src/commandDispatcher');

console.log('🚀 Starting WhatsApp Bot...');

const os = require('os');

const client = new Client({
    authStrategy: new LocalAuth({ clientId: "saraiva-bot" }),
    puppeteer: {
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
        executablePath: os.platform() === 'darwin'
            ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
            : undefined
    }
});

// Graceful Shutdown to prevent "SingletonLock" errors
const shutdown = async () => {
    console.log('\n🛑 Shutting down client...');
    try {
        await client.destroy();
        console.log('✅ Client destroyed successfully.');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error during shutdown:', error);
        process.exit(1);
    }
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

client.on('qr', (qr) => {
    qrcode.generate(qr, { small: true });
    console.log('📱 QR Code generated! Scan it with your phone.');
});

client.on('ready', () => {
    console.log('✅ Client is ready!');
});

client.on('message', async (message) => {
    try {
        // Ignora mensagens de status e broadcasts
        if (message.from === 'status@broadcast') return;
        if (message.isStatus) return;

        // Log message for debugging
        const hasMedia = message.hasMedia;
        const hasText = message.body && message.body.trim().length > 0;

        if (hasMedia) {
            console.log(`📎 [MEDIA] from ${message.from}: type=${message.type}`);
            await handleMessage(message);
        } else if (hasText) {
            console.log(`💬 [TEXT] from ${message.from}: ${message.body.substring(0, 50)}...`);
            await handleMessage(message);
        }
        // Ignora mensagens vazias sem mídia
    } catch (error) {
        console.error('❌ Error handling message:', error);
    }
});

// Evento para reações (opcional - para tracking)
client.on('message_reaction', async (reaction) => {
    console.log(`😀 [REACTION] ${reaction.reaction} from ${reaction.senderId}`);
});

client.initialize();
