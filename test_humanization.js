require('dotenv').config();
const { handleMessage } = require('./src/commandDispatcher');

// Mock objects for WhatsApp Web.js
const createMockChat = () => ({
    sendStateTyping: async () => {
        // silent
    },
    sendMessage: async (text) => {
        console.log(`   [MSG]: "${text}"`);
    }
});

const createMockMessage = (body, from) => {
    const chat = createMockChat();
    return {
        body,
        from,
        getChat: async () => chat,
        reply: async (text) => {
            console.log(`   [REPLY]: "${text}"`);
        },
        react: async (emoji) => {
            console.log(`   [REACT]: ${emoji}`);
        }
    };
};

async function runTests() {
    console.log("=== HUMANIZATION TURING TEST ===\n");
    const userId = 'user_human_' + Date.now();

    // 1. Social Media Welcome
    console.log("--- TEST 1: SOCIAL MEDIA WELCOME ---");
    handleMessage(createMockMessage('Oi', userId));
    await new Promise(r => setTimeout(r, 6000));

    // 2. Saraiva Brutality
    console.log("\n--- TEST 2: SARAIVA BRUTALITY ---");
    handleMessage(createMockMessage('Quero consultoria', userId));
    await new Promise(r => setTimeout(r, 6000));

    handleMessage(createMockMessage('Meu problema é que não tenho tempo', userId));
    await new Promise(r => setTimeout(r, 8000));

    console.log("\n=== END OF TEST ===");
}

runTests();
