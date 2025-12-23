require('dotenv').config();
const { handleMessage } = require('../src/commandDispatcher');

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
    console.log("=== TEST START: ORGANIC ONBOARDING & SWITCHING ===\n");

    const userId = 'user_new_' + Date.now(); // Ensure fresh user

    // 1. New User Greeting (Default to Social Media)
    console.log("Test 1: New User says 'Oi'");
    handleMessage(createMockMessage('Oi, tudo bem?', userId));

    await new Promise(r => setTimeout(r, 6000)); // Wait for debounce + generation

    // 2. Switching to Saraiva
    console.log("\nTest 2: Switching to Saraiva ('quero consultoria')");
    handleMessage(createMockMessage('Eu quero consultoria brutal', userId));

    await new Promise(r => setTimeout(r, 6000));

    // 3. Saraiva Interaction
    console.log("\nTest 3: Saraiva Interaction ('tenho medo de falhar')");
    handleMessage(createMockMessage('tenho medo de falhar', userId));

    await new Promise(r => setTimeout(r, 6000));

    // 4. Switch back to Support
    console.log("\nTest 4: Switch back to Support ('preciso de ajuda com o bot')");
    handleMessage(createMockMessage('preciso de ajuda, como uso o bot?', userId));

    await new Promise(r => setTimeout(r, 6000));

    console.log("\n=== TEST END ===");
}

runTests();
