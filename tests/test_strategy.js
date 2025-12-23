require('dotenv').config();
const { handleMessage } = require('../src/commandDispatcher');

// Mock objects for WhatsApp Web.js
const createMockChat = () => ({
    sendStateTyping: async () => { },
    sendMessage: async (text) => console.log(`   [MSG]: "${text}"`)
});

const createMockMessage = (body, from) => {
    const chat = createMockChat();
    return {
        body,
        from,
        getChat: async () => chat,
        reply: async (text) => console.log(`   [REPLY]: "${text}"`),
        react: async (emoji) => console.log(`   [REACT]: ${emoji}`)
    };
};

async function runTests() {
    console.log("=== STRATEGY CERTIFICATION TEST (GPT-4o Mini) ===\n");
    const userId = 'user_strategy_v1';

    // 1. PRIMEIRA LINHA
    console.log("--- TEST 1: PRIMEIRA LINHA GENERATION ---");
    console.log("User: 'Cria uma Primeira Linha pra mim, sou dentista de alto padrão'");
    handleMessage(createMockMessage('Cria uma Primeira Linha pra mim, sou dentista de alto padrão', userId));
    await new Promise(r => setTimeout(r, 8000));

    // 2. DISSECAÇÃO NEURAL
    console.log("\n--- TEST 2: DISSECAÇÃO NEURAL ---");
    console.log("User: 'Faz uma dissecação neural do meu público (mães empresárias)'");
    handleMessage(createMockMessage('Faz uma dissecação neural do meu público (mães empresárias)', userId));
    await new Promise(r => setTimeout(r, 10000));

    console.log("\n=== STRATEGY TEST COMPLETE ===");
}

runTests();
