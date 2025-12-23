/**
 * COMMAND DISPATCHER v2.0
 *
 * Dispatcher central que integra o novo ConversationalEngine
 * com fallback para o sistema legado.
 *
 * Features:
 * - Usa o novo Conversation Orchestrator por padrão
 * - Fallback automático para sistema legado
 * - Toggle via ENV para escolher sistema
 * - Buffer de mensagens inteligente
 * - Suporte a stickers e mídia
 */

const { PERSONAS } = require('./personas');
const conversationOrchestrator = require('./ai/conversationOrchestrator');

// Lazy load voiceIntelligence to avoid initialization errors
let voiceIntelligence = null;
function getVoiceIntelligence() {
    if (!voiceIntelligence) {
        voiceIntelligence = require('./services/voiceIntelligence');
    }
    return voiceIntelligence;
}

// Legacy imports (fallback)
const aiServiceLegacy = require('./ai/aiService');
const {
    updateState: updateStateLegacy,
    getStateInstructions: getStateInstructionsLegacy,
    detectReaction: detectReactionLegacy,
    recordUserTiming: recordUserTimingLegacy,
    calculateTypingDuration: calculateTypingDurationLegacy
} = require('./conversationState');
const clientServiceLegacy = require('./services/clientService');

// ============================================
// CONFIGURATION
// ============================================

const USE_NEW_ENGINE = process.env.USE_NEW_ENGINE !== 'false'; // Default: true
const DEBUG_MODE = process.env.DEBUG_DISPATCHER === 'true';

// ============================================
// STATE MANAGEMENT
// ============================================

const userStates = new Map();
const messageBuffers = new Map();
const processingChats = new Set();

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// ============================================
// NEW ENGINE PROCESSING
// ============================================

async function processWithNewEngine(chatId, messageObject, _voiceContext = null) {
    const bufferData = messageBuffers.get(chatId);
    if (!bufferData) return;

    messageBuffers.delete(chatId);

    const fullText = bufferData.buffer.join(' ').trim();
    console.log(`[DISPATCH:v2] Processing: "${fullText.substring(0, 50)}..."`);

    // Processar com o Orchestrator
    messageObject.body = fullText;
    const response = await conversationOrchestrator.processMessage(messageObject, chatId);

    if (!response) {
        console.log(`[DISPATCH:v2] No response from orchestrator`);
        return;
    }

    // Executar a resposta
    await conversationOrchestrator.executeResponse(messageObject, response);

    // Log de métricas
    if (DEBUG_MODE) {
        console.log(`[DISPATCH:v2] Metrics:`, response.metadata);
    }
}

// ============================================
// LEGACY ENGINE PROCESSING
// ============================================

async function processWithLegacyEngine(chatId, messageObject, voiceContext = null) {
    const bufferData = messageBuffers.get(chatId);
    if (!bufferData) return;

    messageBuffers.delete(chatId);

    const fullText = bufferData.buffer.join(' ').trim();

    console.log(`[DISPATCH:legacy] Processing: "${fullText.substring(0, 50)}..."`);

    recordUserTimingLegacy(chatId);

    const autoReaction = detectReactionLegacy(fullText);
    if (autoReaction) {
        try {
            await messageObject.react(autoReaction);
        } catch (e) { }
    }

    if (!userStates.has(chatId)) {
        userStates.set(chatId, PERSONAS.SOCIAL_MEDIA);
    }

    const clientData = clientServiceLegacy.getClient(chatId);
    updateStateLegacy(chatId, clientData);
    const stateInstructions = getStateInstructionsLegacy(chatId);

    let contactName = null;
    try {
        const contact = await messageObject.getContact();
        contactName = contact?.pushname || contact?.name || null;
    } catch (e) { }

    const currentPersona = userStates.get(chatId);

    let extraInstructions = stateInstructions;
    if (voiceContext) {
        extraInstructions += `\n\n## CONTEXTO DE VOZ
O usuário enviou um ÁUDIO (${voiceContext.duration}s).
Emoção detectada: ${voiceContext.emotion}
${voiceContext.emotion === 'frustrated' ? 'O usuário parece frustrado - seja empático.' : ''}
${voiceContext.emotion === 'excited' ? 'O usuário está empolgado - celebre!' : ''}`;
    }

    try {
        const response = await aiServiceLegacy.generateResponse(
            chatId,
            fullText,
            currentPersona,
            contactName,
            extraInstructions
        );

        await sendFormattedResponseLegacy(messageObject, response, chatId, currentPersona, voiceContext);
    } catch (err) {
        console.error('[DISPATCH:legacy] Error:', err);
        await messageObject.reply("puts, deu um bug... pode repetir? 😅");
    }
}

async function sendFormattedResponseLegacy(message, fullResponse, chatId, persona, voiceContext = null) {
    let content = fullResponse;
    const chat = await message.getChat();

    const genMatch = content.match(/\|\|GENERATE_IMAGE:\s*(.*?)\|\|/);
    let pendingImagePromise = null;
    if (genMatch) {
        const imagePrompt = genMatch[1];
        content = content.replace(/\|\|GENERATE_IMAGE:\s*(.*?)\|\|/g, '').trim();
        pendingImagePromise = require('./services/mediaService').generateImage(imagePrompt);
    }

    const audioMatch = content.match(/\|\|SEND_AUDIO:\s*(.*?)\|\|/);
    let pendingAudioPromise = null;
    if (audioMatch) {
        const audioText = audioMatch[1];
        content = content.replace(/\|\|SEND_AUDIO:\s*(.*?)\|\|/g, '').trim();
        pendingAudioPromise = require('./services/mediaService').textToSpeech(audioText);
    }

    const reactMatch = content.match(/<REACT:(.*?)>/);
    if (reactMatch) {
        try {
            await message.react(reactMatch[1]);
        } catch (e) { }
        content = content.replace(/<REACT:(.*?)>/g, '').trim();
    }

    const chunks = content.split('<SPLIT>').map(c => c.trim()).filter(c => c.length > 0);

    const shouldSendVoiceResponse = voiceContext?.shouldRespondWithAudio ||
        getVoiceIntelligence().userPrefersAudio(chatId);

    const baseSpeed = persona === PERSONAS.CONSULTANT ? 70 : 30;

    for (const [index, chunk] of chunks.entries()) {
        const typingDuration = calculateTypingDurationLegacy(chunk, chatId, baseSpeed);
        await chat.sendStateTyping();
        await delay(typingDuration);

        if (index === 0) {
            await message.reply(chunk);
        } else {
            await chat.sendMessage(chunk);
        }

        await delay(Math.floor(Math.random() * 400) + 200);
    }

    if (shouldSendVoiceResponse && !pendingAudioPromise && chunks.length > 0) {
        const fullTextForAudio = getVoiceIntelligence().formatTextForAudio(chunks.join('. '));
        if (fullTextForAudio.length > 10) {
            await chat.sendRecordingState();
            const audioMedia = await getVoiceIntelligence().generateVoiceResponse(
                fullTextForAudio,
                voiceContext?.emotion || 'neutral',
                persona
            );
            if (audioMedia) {
                await delay(1500);
                await chat.sendMessage(audioMedia, { sendAudioAsVoice: true });
            }
        }
    }

    if (pendingImagePromise) {
        await chat.sendStateTyping();
        const media = await pendingImagePromise;
        if (media) {
            await chat.sendMessage(media, { caption: "tá na mão 🍌" });
        }
    }

    if (pendingAudioPromise) {
        await chat.sendRecordingState();
        const media = await pendingAudioPromise;
        if (media) {
            await chat.sendMessage(media, { sendAudioAsVoice: true });
        }
    }
}

// ============================================
// MAIN HANDLER
// ============================================

async function handleMessage(message) {
    const chatId = message.from;
    const textOriginal = message.body ? message.body.trim() : "";
    let voiceContext = null;

    // Evitar processamento duplicado
    if (processingChats.has(chatId)) {
        return;
    }

    // === MEDIA HANDLING ===
    if (message.hasMedia) {
        try {
            console.log(`[DISPATCH] Media: type=${message.type}`);

            // Sticker request
            if (textOriginal.toLowerCase().includes('figurinha') ||
                textOriginal.toLowerCase().includes('sticker')) {
                const media = await message.downloadMedia();
                await message.reply(media, null, { sendMediaAsSticker: true });
                return;
            }

            const media = await message.downloadMedia();
            const mediaService = require('./services/mediaService');

            if (media.mimetype.startsWith('audio/') || message.type === 'ptt') {
                getVoiceIntelligence().recordAudioReceived(chatId);
                voiceContext = await getVoiceIntelligence().transcribeWithContext(media);
                message.body = `[ÁUDIO TRANSCRITO]: ${voiceContext.text}`;
            } else if (media.mimetype.startsWith('image/')) {
                const mediaText = await mediaService.describeImage(media);
                message.body = mediaText;
            }
        } catch (e) {
            console.error("[DISPATCH] Media error:", e.message);
            return;
        }
    }

    const text = message.body ? message.body.trim() : "";
    if (!text) return;

    // === MESSAGE BUFFERING ===
    if (!messageBuffers.has(chatId)) {
        // Removed immediate typing indicator to appear more natural
        // try {
        //     const chat = await message.getChat();
        //     await chat.sendStateTyping();
        // } catch (e) {}

        const processMessage = USE_NEW_ENGINE
            ? processWithNewEngine
            : processWithLegacyEngine;

        messageBuffers.set(chatId, {
            buffer: [text],
            voiceContext: voiceContext,
            timer: setTimeout(() => processMessage(chatId, message, voiceContext), 5000)
        });
    } else {
        const data = messageBuffers.get(chatId);
        clearTimeout(data.timer);
        data.buffer.push(text);
        if (voiceContext) data.voiceContext = voiceContext;

        const processMessage = USE_NEW_ENGINE
            ? processWithNewEngine
            : processWithLegacyEngine;

        data.timer = setTimeout(() => processMessage(chatId, message, data.voiceContext), 5000);
        messageBuffers.set(chatId, data);
    }
}

// ============================================
// UTILITY EXPORTS
// ============================================

function getConversationStats(chatId) {
    if (USE_NEW_ENGINE) {
        return conversationOrchestrator.getStats(chatId);
    }
    return { message: "Legacy engine - no stats available" };
}

function resetConversation(chatId) {
    if (USE_NEW_ENGINE) {
        conversationOrchestrator.resetChat(chatId);
    }
    userStates.delete(chatId);
    messageBuffers.delete(chatId);
}

module.exports = {
    handleMessage,
    getConversationStats,
    resetConversation,
    USE_NEW_ENGINE
};
