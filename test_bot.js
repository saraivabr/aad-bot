require('dotenv').config();
const { handleMessage } = require('./src/commandDispatcher');

// Mock objects for WhatsApp Web.js
const createMockChat = () => ({
    sendStateTyping: async () => {
        console.log("   [STATE]: Typing...");
    },
    sendMessage: async (text) => {
        console.log(`   [CHAT MSG]: ${text}`);
    }
});

const createMockMessage = (body, from) => {
    const chat = createMockChat();
    return {
        body,
        from,
        getChat: async () => chat,
        reply: async (text) => {
            console.log(`   [REPLY]: ${text}`);
        },
        react: async (emoji) => {
            console.log(`   [REACTION]: ${emoji}`);
        }
    };
};

async function runTests() {
    console.log("=== TEST START: SARAIVA (DE-ROBOTIZED) ===\n");

    // 1. Activate Saraiva
    console.log("Test 1: Activate Saraiva");
    handleMessage(createMockMessage('/consultoria', 'user_saraiva_v2'));

    // Wait for activation
    await new Promise(r => setTimeout(r, 2500));

    // 2. Trigger Brutality (Expect Verbal-Only, No Asterisks)
    console.log("\nTest 2: Trigger Brutality");
    console.log("Sending: 'Não sei se compro agora, o preço tá alto'");
    handleMessage(createMockMessage('Não sei se compro agora, o preço tá alto', 'user_saraiva_v2'));

    // Wait for debounce + processing
    console.log("(Waiting for response...)");
    await new Promise(r => setTimeout(r, 6000));

    console.log("\n=== TEST END ===");
}

runTests();
