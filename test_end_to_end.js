require('dotenv').config();
const { handleMessage } = require('./src/commandDispatcher');

// Mock objects for WhatsApp Web.js
const createMockChat = () => ({
    sendStateTyping: async () => {
        // silent to keep logs clean
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
    console.log("=== FINAL CERTIFICATION TEST ===\n");
    const userId = 'user_final_v1';

    // 1. ORGANIC ONBOARDING
    console.log("--- PHASE 1: ORGANIC ONBOARDING ---");
    console.log("User: 'Oi'");
    handleMessage(createMockMessage('Oi', userId));
    await new Promise(r => setTimeout(r, 6000));

    // 2. CONTEXT SWITCHING
    console.log("\n--- PHASE 2: SWITCHING TO SARAIVA ---");
    console.log("User: 'Quero falar com o Saraiva'");
    handleMessage(createMockMessage('Quero falar com o Saraiva', userId));
    await new Promise(r => setTimeout(r, 6000));

    // 3. KNOWLEDGE & BRUTALITY (MÉTODO MD)
    console.log("\n--- PHASE 3: KNOWLEDGE TEST (MÉTODO MD) ---");
    console.log("User: 'Não consigo ter resultados, tenho medo'");
    handleMessage(createMockMessage('Não consigo ter resultados, tenho medo', userId));
    await new Promise(r => setTimeout(r, 8000));

    // 4. SWITCH BACK
    console.log("\n--- PHASE 4: RETURN TO SUPPORT ---");
    console.log("User: 'Preciso de ajuda técnica'");
    handleMessage(createMockMessage('Preciso de ajuda técnica', userId));
    await new Promise(r => setTimeout(r, 6000));

    console.log("\n=== CERTIFICATION COMPLETE ===");
}

runTests();
